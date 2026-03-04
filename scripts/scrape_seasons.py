"""
Scrape college basketball season-by-season data from Sports Reference school pages.
Produces seasons.json (per-season records), schools.json (aggregated), coaches.json (aggregated).

Usage: python scripts/scrape_seasons.py
Output: public/data/seasons.json, public/data/schools.json, public/data/coaches.json
"""

import json
import time
import re
import os
import sys
import requests
from bs4 import BeautifulSoup, Comment

BASE_URL = "https://www.sports-reference.com/cbb"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CBB-Tracker/1.0)"}
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")
START_YEAR = 1985
MIN_COACH_WINS = 100

# --- ESPN ID mapping ---

ESPN_TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500"

# Manual overrides for SR name -> ESPN name mismatches
SR_TO_ESPN_NAME = {
    "Connecticut": "UConn",
    "Nevada-Las Vegas": "UNLV",
    "St. John's (NY)": "St. John's",
    "Southern California": "USC",
    "Pittsburgh": "Pitt",
    "Loyola (IL)": "Loyola Chicago",
    "Hawaii": "Hawai'i",
    "Louisiana State": "LSU",
    "North Carolina State": "NC State",
    "Mississippi": "Ole Miss",
    "Southern Methodist": "SMU",
    "Texas Christian": "TCU",
    "Central Florida": "UCF",
    "Alabama-Birmingham": "UAB",
    "Virginia Commonwealth": "VCU",
    "Brigham Young": "BYU",
    "South Florida": "USF",
    "Massachusetts": "UMass",
    "Middle Tennessee State": "Middle Tennessee",
    "Louisiana-Lafayette": "Louisiana",
    "Texas-San Antonio": "UTSA",
    "Texas-El Paso": "UTEP",
    "Cal State Fullerton": "CSU Fullerton",
    "Cal State Bakersfield": "CSU Bakersfield",
    "Cal State Northridge": "CSU Northridge",
    "Detroit Mercy": "Detroit Mercy",
    "Miami (FL)": "Miami",
    "Miami (OH)": "Miami (OH)",
    "Saint Mary's (CA)": "Saint Mary's",
    "Saint Joseph's": "Saint Joseph's",
    "Saint Peter's": "Saint Peter's",
    "Saint Louis": "Saint Louis",
    "Wisconsin-Green Bay": "Green Bay",
    "Wisconsin-Milwaukee": "Milwaukee",
    "Louisiana-Monroe": "UL Monroe",
    "Arkansas-Little Rock": "Little Rock",
    "Texas-Arlington": "UT Arlington",
    "College of Charleston": "Charleston",
    "California": "Cal",
    "Pennsylvania": "Penn",
    "Appalachian State": "App State",
    "Southern Mississippi": "Southern Miss",
    "Illinois-Chicago": "UIC",
    "McNeese State": "McNeese",
    "Nicholls State": "Nicholls",
    "Southeastern Louisiana": "SE Louisiana",
    "Maryland-Baltimore County": "UMBC",
    "Texas-Rio Grande Valley": "UT Rio Grande Valley",
    "Central Connecticut State": "Central Connecticut",
    "Virginia Military Institute": "VMI",
    "San Jose State": "San José State",
    "Tennessee-Martin": "UT Martin",
    "Albany (NY)": "UAlbany",
    "Seattle": "Seattle U",
    "Southern Illinois-Edwardsville": "SIU Edwardsville",
    "Massachusetts-Lowell": "UMass Lowell",
    "Saint Francis (PA)": "Saint Francis",
    "Southern Indiana": "Southern Indiana",
    "Lindenwood": "Lindenwood",
    "St. Francis (NY) Terriers": "St. Francis Brooklyn",
}


def fetch_espn_ids() -> dict[str, int]:
    """Fetch ESPN team IDs for all D1 teams. Returns normalized_name -> espnId."""
    print("Fetching ESPN team IDs...")
    mapping = {}
    page = 1
    while True:
        url = f"{ESPN_TEAMS_URL}&page={page}"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
        if not teams:
            break
        for entry in teams:
            team = entry.get("team", {})
            espn_id = int(team["id"])
            name = team.get("displayName", "")
            short = team.get("shortDisplayName", "")
            abbr = team.get("abbreviation", "")
            location = team.get("location", "")
            nickname = team.get("nickname", "")
            # Store all name variants
            for n in [name, short, location, nickname]:
                if n:
                    mapping[_normalize(n)] = espn_id
            if abbr:
                mapping[_normalize(abbr)] = espn_id
        page_count = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("pageCount", 1)
        if page >= page_count:
            break
        page += 1
    print(f"  Got {len(mapping)} ESPN name mappings")
    return mapping


def _normalize(name: str) -> str:
    """Normalize a name for fuzzy matching."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def resolve_espn_id(sr_name: str, espn_map: dict[str, int]) -> int:
    """Resolve SR school name to ESPN ID."""
    # Try manual override first
    espn_name = SR_TO_ESPN_NAME.get(sr_name, sr_name)
    norm = _normalize(espn_name)
    if norm in espn_map:
        return espn_map[norm]
    # Try the original SR name
    norm_sr = _normalize(sr_name)
    if norm_sr in espn_map:
        return espn_map[norm_sr]
    return 0


# --- SR scraping ---

def fetch_sr(url: str) -> str:
    """Fetch a URL with rate limiting, return raw HTML."""
    time.sleep(3.5)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_sr_html(html: str) -> BeautifulSoup:
    """Parse HTML, expanding commented-out tables (SR hides some in comments)."""
    soup = BeautifulSoup(html, "html.parser")
    # SR wraps some tables in HTML comments; unwrap them
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        if "<table" in comment:
            fragment = BeautifulSoup(comment, "html.parser")
            comment.replace_with(fragment)
    return soup


def get_school_slugs() -> list[tuple[str, str]]:
    """Fetch SR school index -> list of (display_name, slug)."""
    print("Fetching school index...")
    html = fetch_sr(f"{BASE_URL}/schools/")
    soup = parse_sr_html(html)

    table = soup.find("table", {"id": "NCAAM_schools"})
    if not table:
        print("ERROR: Could not find schools table")
        return []

    schools = []
    for row in table.find_all("tr"):
        name_cell = row.find(["th", "td"], {"data-stat": "school_name"})
        if not name_cell:
            continue
        link = name_cell.find("a")
        if not link:
            continue
        name = link.text.strip()
        href = link["href"]  # e.g. /cbb/schools/duke/men/
        # Extract slug
        m = re.search(r"/cbb/schools/([^/]+)/", href)
        if m:
            schools.append((name, m.group(1)))

    # Filter to currently active D1 schools
    # SR marks years active - we want schools with recent seasons
    # We'll filter later based on whether they have data >= START_YEAR
    print(f"  Found {len(schools)} schools")
    return schools


def get_conference_slugs() -> list[str]:
    """Fetch SR conference index -> list of conference slugs."""
    print("Fetching conference index...")
    html = fetch_sr(f"{BASE_URL}/conferences/")
    soup = parse_sr_html(html)

    slugs = set()
    for link in soup.find_all("a", href=True):
        m = re.search(r"/cbb/conferences/([^/]+)/men/", link["href"])
        if m:
            slugs.add(m.group(1))

    print(f"  Found {len(slugs)} conferences")
    return sorted(slugs)


def scrape_conf_champions(slug: str, school_slug_to_name: dict[str, str]) -> dict[tuple[str, int], dict]:
    """Scrape a conference page for per-year reg season + tourney champions.
    Returns {(school_display_name, year): {"confRegSeason": 0/1, "confTourney": 0/1}}
    """
    url = f"{BASE_URL}/conferences/{slug}/men/"
    try:
        html = fetch_sr(url)
    except Exception as e:
        print(f"  WARNING: Could not fetch conference {slug}: {e}")
        return {}

    soup = parse_sr_html(html)

    # Table id matches the conference slug
    table = soup.find("table", {"id": slug})
    if not table:
        # Try finding any table with conf_champ column
        for t in soup.find_all("table"):
            if t.find(["th", "td"], {"data-stat": "conf_champ"}):
                table = t
                break
    if not table:
        return {}

    results = {}
    for row in table.find_all("tr"):
        if row.get("class") and "thead" in row.get("class", []):
            continue

        # Parse year from season cell
        season_cell = row.find(["th", "td"], {"data-stat": "season"})
        if not season_cell:
            continue
        link = season_cell.find("a")
        if link and link.get("href"):
            m = re.search(r"/(\d{4})\.html", link["href"])
            if m:
                year = int(m.group(1))
            else:
                continue
        else:
            m = re.search(r"(\d{4})", season_cell.text)
            if not m:
                continue
            # Text is like "2024-25 ACC" — extract start year + 1
            year = int(m.group(1)) + 1
        if year < START_YEAR:
            continue

        # Regular season champion(s)
        reg_cell = row.find("td", {"data-stat": "conf_champ"})
        if reg_cell:
            for a in reg_cell.find_all("a"):
                name = _resolve_conf_school_name(a, school_slug_to_name)
                if name:
                    key = (name, year)
                    results.setdefault(key, {"confRegSeason": 0, "confTourney": 0})
                    results[key]["confRegSeason"] = 1

        # Tournament champion(s)
        post_cell = row.find("td", {"data-stat": "conf_champ_post"})
        if post_cell:
            for a in post_cell.find_all("a"):
                name = _resolve_conf_school_name(a, school_slug_to_name)
                if name:
                    key = (name, year)
                    results.setdefault(key, {"confRegSeason": 0, "confTourney": 0})
                    results[key]["confTourney"] = 1

    return results


def _resolve_conf_school_name(a_tag, school_slug_to_name: dict[str, str]) -> str:
    """Resolve a conference page school <a> tag to our canonical display name.
    First tries matching via the href slug, falls back to link text.
    """
    href = a_tag.get("href", "")
    m = re.search(r"/cbb/schools/([^/]+)/", href)
    if m:
        slug = m.group(1)
        if slug in school_slug_to_name:
            return school_slug_to_name[slug]
    # Fallback: use the link text directly
    return a_tag.text.strip()


def get_all_conf_champions(school_slug_to_name: dict[str, str]) -> dict[tuple[str, int], dict]:
    """Scrape all conference pages and build a combined lookup."""
    conf_slugs = get_conference_slugs()
    all_champs = {}
    total = len(conf_slugs)
    for i, slug in enumerate(conf_slugs):
        print(f"[{i+1}/{total}] Conference: {slug}")
        champs = scrape_conf_champions(slug, school_slug_to_name)
        all_champs.update(champs)
        if champs:
            print(f"  -> {len(champs)} champion entries")
    print(f"Total conference champion entries: {len(all_champs)}")
    return all_champs


def apply_conf_champions(seasons: list[dict], conf_champs: dict[tuple[str, int], dict]):
    """Patch season records with conference championship data."""
    patched = 0
    for s in seasons:
        key = (s["school"], s["year"])
        if key in conf_champs:
            s["confRegSeason"] = conf_champs[key].get("confRegSeason", 0)
            s["confTourney"] = conf_champs[key].get("confTourney", 0)
            patched += 1
    print(f"Patched {patched} season records with conference championship data")


def parse_tournament_result(round_max: str) -> dict:
    """Parse SR round_max text into achievement flags.
    Actual SR values:
      'Won NCAA Tournament National Final'
      'Lost NCAA Tournament National Final'
      'Lost NCAA Tournament National Semifinal'
      'Lost NCAA Tournament Regional Final'
      'Lost NCAA Tournament Regional Semifinal'
      'Lost NCAA Tournament Second Round'
      'Lost NCAA Tournament First Round'
    """
    text = round_max.strip().lower() if round_max else ""
    result = {
        "tournamentApp": 0,
        "sweet16": 0,
        "elite8": 0,
        "finalFour": 0,
        "champGame": 0,
        "title": 0,
    }
    if not text:
        return result

    # Any non-empty round_max means tournament appearance
    result["tournamentApp"] = 1

    if "won" in text and "national final" in text:
        # Won NCAA Tournament National Final = champion
        result["title"] = 1
        result["champGame"] = 1
        result["finalFour"] = 1
        result["elite8"] = 1
        result["sweet16"] = 1
    elif "lost" in text and "national final" in text:
        # Lost NCAA Tournament National Final = runner-up
        result["champGame"] = 1
        result["finalFour"] = 1
        result["elite8"] = 1
        result["sweet16"] = 1
    elif "national semifinal" in text:
        # Lost NCAA Tournament National Semifinal = Final Four
        result["finalFour"] = 1
        result["elite8"] = 1
        result["sweet16"] = 1
    elif "regional final" in text:
        # Lost NCAA Tournament Regional Final = Elite Eight
        result["elite8"] = 1
        result["sweet16"] = 1
    elif "regional semifinal" in text:
        # Lost NCAA Tournament Regional Semifinal = Sweet Sixteen
        result["sweet16"] = 1
    # Second Round, First Round, First Four = just tournament appearance

    return result


def _parse_coaches_cell(cell) -> list[tuple[str, int, int]]:
    """Parse a coaches cell into [(name, wins, losses), ...].
    Cell format: '<a>Coach Name</a> (W-L)' or multiple comma-separated.
    """
    entries = []
    text = cell.get_text()
    links = cell.find_all("a")

    if not links:
        # No links — try plain text
        name = re.sub(r"\s*\(\d+-\d+\)\s*", "", text).strip()
        m = re.search(r"\((\d+)-(\d+)\)", text)
        if name and m:
            entries.append((name, int(m.group(1)), int(m.group(2))))
        elif name:
            entries.append((name, 0, 0))
        return entries

    # Walk through each <a> tag and find the (W-L) that follows it
    full_html = str(cell)
    for link in links:
        coach_name = link.text.strip()
        if not coach_name:
            continue
        # Find the (W-L) after this coach's link in the raw HTML
        link_end = full_html.find(str(link)) + len(str(link))
        after = full_html[link_end:link_end + 30]
        m = re.search(r"\((\d+)-(\d+)\)", after)
        if m:
            entries.append((coach_name, int(m.group(1)), int(m.group(2))))
        else:
            entries.append((coach_name, 0, 0))

    return entries


def scrape_school_seasons(slug: str, display_name: str, espn_id: int) -> list[dict]:
    """Scrape a single school's year-by-year table. Returns list of season records."""
    url = f"{BASE_URL}/schools/{slug}/men/"
    try:
        html = fetch_sr(url)
    except Exception as e:
        print(f"  WARNING: Could not fetch {display_name} ({slug}): {e}")
        return []

    soup = parse_sr_html(html)

    # Find the main season table - could be 'seasons' or the school-slug table
    table = None
    for table_id in [f"{slug}", "seasons"]:
        table = soup.find("table", {"id": table_id})
        if table:
            break
    if not table:
        # Try finding any table with year data
        tables = soup.find_all("table")
        for t in tables:
            if t.find("th", {"data-stat": "year_id"}):
                table = t
                break
    if not table:
        return []

    seasons = []
    for row in table.find_all("tr"):
        # Skip header rows
        if row.get("class") and "thead" in row.get("class", []):
            continue

        # Season column: "2024-25" format, use ending year (= tournament year)
        season_cell = row.find(["th", "td"], {"data-stat": "season"})
        if not season_cell:
            continue

        season_text = season_cell.text.strip()
        # Parse ending year: "2024-25" -> 2025, "1999-00" -> 2000
        link = season_cell.find("a")
        if link and link.get("href"):
            # Extract year from URL: /cbb/schools/duke/men/2025.html
            m = re.search(r"/(\d{4})\.html", link["href"])
            if m:
                year = int(m.group(1))
            else:
                continue
        else:
            # Fallback: parse from text "YYYY-YY"
            m = re.match(r"(\d{4})-(\d{2,4})", season_text)
            if not m:
                continue
            start = int(m.group(1))
            end_part = m.group(2)
            if len(end_part) == 2:
                century = start // 100 * 100
                year = century + int(end_part)
                if year <= start:
                    year += 100  # handle century boundary: 1999-00 -> 2000
            else:
                year = int(end_part)

        if year < START_YEAR:
            continue

        # Extract coach(es) — column is "coaches" (plural)
        # Format: "Coach Name (W-L)" or "Coach1 (W1-L1), Coach2 (W2-L2)"
        coaches_cell = row.find("td", {"data-stat": "coaches"})
        if not coaches_cell:
            continue

        # Parse each coach's <a> tag and their parenthetical W-L
        coach_entries = _parse_coaches_cell(coaches_cell)
        if not coach_entries:
            continue

        # Extract conference
        conf_cell = row.find("td", {"data-stat": "conf_abbr"})
        conference = conf_cell.text.strip() if conf_cell else ""

        # Extract total W/L from the row
        wins_cell = row.find("td", {"data-stat": "wins"})
        losses_cell = row.find("td", {"data-stat": "losses"})
        try:
            total_wins = int(wins_cell.text.strip()) if wins_cell and wins_cell.text.strip() else 0
            total_losses = int(losses_cell.text.strip()) if losses_cell and losses_cell.text.strip() else 0
        except ValueError:
            continue

        # Extract tournament result from round_max column
        round_cell = row.find("td", {"data-stat": "round_max"})
        round_text = round_cell.text.strip() if round_cell else ""
        tourney = parse_tournament_result(round_text)

        # No notes/conf awards column on school pages — conf titles will be
        # added in a future enhancement if SR exposes them elsewhere
        conf_reg = 0
        conf_tourney = 0

        if len(coach_entries) == 1:
            # Single coach — use row-level W/L (more reliable)
            coach_name = coach_entries[0][0]
            seasons.append({
                "coach": coach_name,
                "school": display_name,
                "espnId": espn_id,
                "year": year,
                "conference": conference,
                "wins": total_wins,
                "losses": total_losses,
                **tourney,
                "confRegSeason": conf_reg,
                "confTourney": conf_tourney,
            })
        else:
            # Multiple coaches (mid-season change) — use per-coach W-L from parens
            # Tournament/conf awards go to the primary coach (most wins)
            primary_idx = max(range(len(coach_entries)), key=lambda i: coach_entries[i][1])
            for idx, (coach_name, w, l) in enumerate(coach_entries):
                is_primary = idx == primary_idx
                seasons.append({
                    "coach": coach_name,
                    "school": display_name,
                    "espnId": espn_id,
                    "year": year,
                    "conference": conference,
                    "wins": w,
                    "losses": l,
                    **(tourney if is_primary else parse_tournament_result("")),
                    "confRegSeason": conf_reg if is_primary else 0,
                    "confTourney": conf_tourney if is_primary else 0,
                })

    return seasons


def derive_schools(seasons: list[dict]) -> list[dict]:
    """Aggregate season records into per-school totals."""
    by_school: dict[str, dict] = {}
    # Track latest conference per school
    latest_conf: dict[str, tuple[int, str]] = {}

    for s in seasons:
        name = s["school"]
        if name not in by_school:
            by_school[name] = {
                "school": name,
                "espnId": s["espnId"],
                "conference": "",
                "wins": 0, "losses": 0, "winPct": 0,
                "tournamentApps": 0, "sweet16": 0, "elite8": 0,
                "finalFour": 0, "champGame": 0, "titles": 0,
                "confRegularSeason": 0, "confTournament": 0,
            }
        rec = by_school[name]
        rec["wins"] += s["wins"]
        rec["losses"] += s["losses"]
        rec["tournamentApps"] += s["tournamentApp"]
        rec["sweet16"] += s["sweet16"]
        rec["elite8"] += s["elite8"]
        rec["finalFour"] += s["finalFour"]
        rec["champGame"] += s["champGame"]
        rec["titles"] += s["title"]
        rec["confRegularSeason"] += s["confRegSeason"]
        rec["confTournament"] += s["confTourney"]
        if s["espnId"]:
            rec["espnId"] = s["espnId"]

        # Track latest conference
        prev = latest_conf.get(name, (0, ""))
        if s["year"] >= prev[0] and s.get("conference"):
            latest_conf[name] = (s["year"], s["conference"])

    for name, rec in by_school.items():
        total = rec["wins"] + rec["losses"]
        rec["winPct"] = round(rec["wins"] / total, 3) if total > 0 else 0
        rec["conference"] = latest_conf.get(name, (0, ""))[1]

    schools = sorted(by_school.values(), key=lambda s: s["wins"], reverse=True)
    return schools


def derive_coaches(seasons: list[dict]) -> list[dict]:
    """Aggregate season records into per-coach-stint totals. Filter to 100+ wins."""
    by_stint: dict[str, dict] = {}

    for s in seasons:
        key = f"{s['coach']}|||{s['school']}"
        if key not in by_stint:
            by_stint[key] = {
                "coach": s["coach"],
                "school": s["school"],
                "espnId": s["espnId"],
                "startYear": s["year"], "endYear": s["year"],
                "wins": 0, "losses": 0, "winPct": 0,
                "tournamentApps": 0, "sweet16": 0, "elite8": 0,
                "finalFour": 0, "champGame": 0, "titles": 0,
                "confRegularSeason": 0, "confTournament": 0,
            }
        rec = by_stint[key]
        rec["wins"] += s["wins"]
        rec["losses"] += s["losses"]
        rec["tournamentApps"] += s["tournamentApp"]
        rec["sweet16"] += s["sweet16"]
        rec["elite8"] += s["elite8"]
        rec["finalFour"] += s["finalFour"]
        rec["champGame"] += s["champGame"]
        rec["titles"] += s["title"]
        rec["confRegularSeason"] += s["confRegSeason"]
        rec["confTournament"] += s["confTourney"]
        rec["startYear"] = min(rec["startYear"], s["year"])
        rec["endYear"] = max(rec["endYear"], s["year"])
        if s["espnId"]:
            rec["espnId"] = s["espnId"]

    # Compute winPct and years string, filter to 100+ wins
    coaches = []
    for rec in by_stint.values():
        total = rec["wins"] + rec["losses"]
        rec["winPct"] = round(rec["wins"] / total, 3) if total > 0 else 0
        rec["years"] = f"{rec['startYear']}-{rec['endYear']}"
        if rec["wins"] >= MIN_COACH_WINS:
            coaches.append(rec)

    coaches.sort(key=lambda c: c["wins"], reverse=True)
    return coaches


def verify(seasons, schools, coaches):
    """Print verification stats."""
    print("\n=== Verification ===")
    print(f"Total season records: {len(seasons)}")
    print(f"Total schools: {len(schools)}")
    print(f"Total coach stints (100+ wins): {len(coaches)}")

    # Title counts by school
    title_counts = {}
    for s in seasons:
        if s["title"]:
            title_counts[s["school"]] = title_counts.get(s["school"], 0) + 1
    print("\nTitles by school:")
    for school, count in sorted(title_counts.items(), key=lambda x: -x[1]):
        print(f"  {school}: {count}")

    # Spot checks
    duke_seasons = [s for s in seasons if s["school"] == "Duke"]
    duke_titles = sum(s["title"] for s in duke_seasons)
    print(f"\nDuke: {len(duke_seasons)} seasons, {duke_titles} titles")

    izzo = [s for s in seasons if s["coach"] == "Tom Izzo"]
    izzo_apps = sum(s["tournamentApp"] for s in izzo)
    print(f"Tom Izzo: {len(izzo)} seasons, {izzo_apps} tourney apps")

    # Schools with ESPN IDs
    with_logo = sum(1 for s in schools if s["espnId"] > 0)
    print(f"\nSchools with ESPN logo: {with_logo}/{len(schools)}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Get ESPN ID mapping
    espn_map = fetch_espn_ids()

    # Step 2: Get all school slugs from SR
    school_slugs = get_school_slugs()

    # Step 3: Scrape each school's season table
    all_seasons = []
    total = len(school_slugs)
    for i, (name, slug) in enumerate(school_slugs):
        espn_id = resolve_espn_id(name, espn_map)
        print(f"[{i+1}/{total}] {name} (slug={slug}, espnId={espn_id})")
        school_seasons = scrape_school_seasons(slug, name, espn_id)
        all_seasons.extend(school_seasons)
        if school_seasons:
            print(f"  -> {len(school_seasons)} seasons")

    all_seasons.sort(key=lambda s: (s["year"], s["school"]))

    # Step 4: Scrape conference championship data
    # Build slug -> display name mapping from the school slugs we already have
    school_slug_to_name = {slug: name for name, slug in school_slugs}
    print(f"\n=== Scraping Conference Championships ({len(school_slug_to_name)} school mappings) ===")
    conf_champs = get_all_conf_champions(school_slug_to_name)
    apply_conf_champions(all_seasons, conf_champs)

    # Strip conference from season records before writing (not in frontend types)
    seasons_output = []
    for s in all_seasons:
        rec = {k: v for k, v in s.items() if k != "conference"}
        seasons_output.append(rec)

    # Step 5: Derive aggregates
    schools = derive_schools(all_seasons)
    coaches = derive_coaches(all_seasons)

    # Step 6: Write output files
    print(f"\nWriting {len(seasons_output)} seasons, {len(schools)} schools, {len(coaches)} coach stints")

    with open(os.path.join(OUTPUT_DIR, "seasons.json"), "w") as f:
        json.dump(seasons_output, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "schools.json"), "w") as f:
        json.dump(schools, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "coaches.json"), "w") as f:
        json.dump(coaches, f, indent=2)

    verify(all_seasons, schools, coaches)
    print("\nDone!")


if __name__ == "__main__":
    main()
