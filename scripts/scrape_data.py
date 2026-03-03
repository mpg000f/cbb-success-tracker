"""
Scrape college basketball data from Sports Reference and compile into JSON files.
Covers the 64-team tournament era (1985-present).

Usage: python scripts/scrape_data.py
Output: public/data/schools.json, public/data/coaches.json
"""

import json
import time
import re
import os
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.sports-reference.com/cbb"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CBB-Tracker/1.0)"}
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")
START_YEAR = 1985  # 64-team era

# ESPN team ID mapping for logos - manually curated for major programs
ESPN_IDS = {
    "Duke": 150, "North Carolina": 153, "Kansas": 2305, "Kentucky": 96,
    "UCLA": 26, "Connecticut": 41, "Villanova": 222, "Michigan State": 127,
    "Louisville": 97, "Indiana": 84, "Syracuse": 183, "Arizona": 12,
    "Georgetown": 46, "Florida": 57, "Ohio State": 194, "Michigan": 130,
    "Gonzaga": 2250, "Virginia": 258, "Wisconsin": 275, "Purdue": 2509,
    "Tennessee": 2633, "Alabama": 333, "Houston": 248, "Baylor": 239,
    "Texas": 251, "Auburn": 2, "Iowa State": 66, "Oklahoma": 201,
    "Memphis": 235, "Pittsburgh": 221, "Maryland": 120, "Illinois": 356,
    "Xavier": 2752, "Cincinnati": 2132, "Marquette": 269, "Creighton": 156,
    "Oregon": 2483, "West Virginia": 277, "Stanford": 24, "Florida State": 52,
    "Texas Tech": 2641, "Arkansas": 8, "Iowa": 2294, "Oklahoma State": 197,
    "NC State": 152, "Virginia Tech": 259, "Wake Forest": 154, "Notre Dame": 87,
    "LSU": 99, "Colorado": 38, "Georgia Tech": 59, "BYU": 252,
    "Seton Hall": 2550, "Clemson": 228, "Mississippi State": 344,
    "Providence": 2507, "Dayton": 2168, "Southern California": 30,
    "Nevada-Las Vegas": 2439, "Butler": 2169, "Wichita State": 2724,
    "San Diego State": 21, "St. John's (NY)": 2599, "VCU": 2670,
    "Oregon State": 204, "George Mason": 2244, "Loyola (IL)": 2341,
    "South Carolina": 2579, "Kansas State": 2306, "Minnesota": 135,
    "Rutgers": 164, "Nebraska": 158, "Penn State": 213, "Northwestern": 77,
    "Washington": 264, "Texas A&M": 245, "Missouri": 142, "Georgia": 61,
    "Ole Miss": 145, "Vanderbilt": 238, "South Florida": 58, "TCU": 2628,
    "UCF": 2116, "SMU": 2567, "Tulane": 2655, "UAB": 5,
    "DePaul": 305, "Saint Louis": 139, "George Washington": 45,
    "Connecticut": 41, "UConn": 41, "Miami (FL)": 2390, "Boston College": 103,
    "Colorado State": 36, "Utah": 254, "New Mexico": 167, "UNLV": 2439,
    "Fresno State": 278, "San Jose State": 23, "Air Force": 2005,
    "Wyoming": 2704, "Boise State": 68, "Hawaii": 62,
}

# Mapping from Sports Reference school URL slugs to display names
# will be populated during scraping

def fetch(url: str) -> BeautifulSoup:
    """Fetch a URL and return a BeautifulSoup object, with rate limiting."""
    time.sleep(3.5)  # Be polite to Sports Reference
    print(f"  Fetching: {url}")
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def get_tournament_results() -> dict:
    """Get NCAA tournament results by school since 1985.
    Returns dict of school -> {tournamentApps, sweet16, elite8, finalFour, champGame, titles}
    """
    results: dict[str, dict] = {}

    # Scrape the NCAA tournament history page
    soup = fetch(f"{BASE_URL}/postseason/ncaa-men/")

    # Find all tournament year links
    table = soup.find("table", {"id": "ncaa_men"})
    if not table:
        print("WARNING: Could not find tournament table")
        return results

    tbody = table.find("tbody")
    if not tbody:
        return results

    for row in tbody.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue

        year_cell = cells[0]
        year_link = year_cell.find("a")
        if not year_link:
            continue

        year_text = year_link.text.strip()
        try:
            year = int(year_text)
        except ValueError:
            continue

        if year < START_YEAR:
            continue

        # Get champion from this row
        champ_cell = row.find("td", {"data-stat": "champion"})
        runner_up_cell = row.find("td", {"data-stat": "runner_up"})

        if champ_cell:
            champ_link = champ_cell.find("a")
            if champ_link:
                champ_name = champ_link.text.strip()
                if champ_name not in results:
                    results[champ_name] = _empty_tourney()
                results[champ_name]["titles"] += 1
                results[champ_name]["champGame"] += 1
                results[champ_name]["finalFour"] += 1
                results[champ_name]["elite8"] += 1
                results[champ_name]["sweet16"] += 1
                results[champ_name]["tournamentApps"] += 1

        if runner_up_cell:
            ru_link = runner_up_cell.find("a")
            if ru_link:
                ru_name = ru_link.text.strip()
                if ru_name not in results:
                    results[ru_name] = _empty_tourney()
                results[ru_name]["champGame"] += 1
                results[ru_name]["finalFour"] += 1
                results[ru_name]["elite8"] += 1
                results[ru_name]["sweet16"] += 1
                results[ru_name]["tournamentApps"] += 1

    # Now get detailed bracket data for each year
    for year in range(START_YEAR, 2026):
        if year == 2020:  # COVID - no tournament
            continue
        _scrape_tournament_year(year, results)

    return results


def _empty_tourney() -> dict:
    return {
        "tournamentApps": 0, "sweet16": 0, "elite8": 0,
        "finalFour": 0, "champGame": 0, "titles": 0,
    }


def _scrape_tournament_year(year: int, results: dict):
    """Scrape a single tournament year's bracket page for round-by-round results."""
    try:
        soup = fetch(f"{BASE_URL}/postseason/ncaa-men/{year}.html")
    except Exception as e:
        print(f"  WARNING: Could not fetch {year} tournament: {e}")
        return

    bracket = soup.find("div", {"id": "brackets"})
    if not bracket:
        return

    # Find all teams that appeared in the tournament
    # Each round is structured differently, so we parse the bracket div
    teams_in_rounds: dict[str, str] = {}  # team -> deepest round reached

    for link in bracket.find_all("a"):
        href = link.get("href", "")
        if "/cbb/schools/" in href:
            team_name = link.text.strip()
            if team_name and team_name not in teams_in_rounds:
                teams_in_rounds[team_name] = "R64"

    # Parse round winners from the bracket structure
    # The bracket uses <div> elements with round identifiers
    rounds_order = ["R64", "R32", "S16", "E8", "F4", "CG", "champ"]

    for div in bracket.find_all("div", class_=re.compile(r"round")):
        round_class = div.get("class", [])
        round_id = None
        for cls in round_class:
            if "final-four" in cls or "national" in cls:
                round_id = "F4"
            elif "elite" in cls or "regional-final" in cls:
                round_id = "E8"
            elif "sweet" in cls or "regional-semi" in cls:
                round_id = "S16"

        if round_id:
            for link in div.find_all("a"):
                href = link.get("href", "")
                if "/cbb/schools/" in href:
                    team_name = link.text.strip()
                    if team_name:
                        teams_in_rounds[team_name] = round_id

    # All teams that appeared = tournament appearance
    for team in teams_in_rounds:
        if team not in results:
            results[team] = _empty_tourney()


def get_school_records() -> list[dict]:
    """Get win/loss records for all D1 schools since 1985."""
    schools = {}

    # Get the list of schools from Sports Reference
    soup = fetch(f"{BASE_URL}/schools/")

    table = soup.find("table", {"id": "schools"})
    if not table:
        print("WARNING: Could not find schools table")
        return []

    tbody = table.find("tbody")
    if not tbody:
        return []

    school_links = []
    for row in tbody.find_all("tr"):
        if row.get("class") and "thead" in row.get("class", []):
            continue
        name_cell = row.find("td", {"data-stat": "school_name"})
        if not name_cell:
            continue
        link = name_cell.find("a")
        if link:
            school_links.append((link.text.strip(), link["href"]))

    print(f"Found {len(school_links)} schools")

    for school_name, href in school_links:
        _scrape_school(school_name, href, schools)

    return list(schools.values())


def _scrape_school(name: str, href: str, schools: dict):
    """Scrape a single school's historical record."""
    try:
        soup = fetch(f"https://www.sports-reference.com{href}")
    except Exception as e:
        print(f"  WARNING: Could not fetch {name}: {e}")
        return

    # Find the season-by-season table
    table = soup.find("table", {"id": re.compile(r"(seasons|results)")})
    if not table:
        return

    tbody = table.find("tbody")
    if not tbody:
        return

    total_wins = 0
    total_losses = 0
    conf_reg = 0
    conf_tourney = 0

    for row in tbody.find_all("tr"):
        if row.get("class") and "thead" in row.get("class", []):
            continue

        year_cell = row.find("th", {"data-stat": "year_id"})
        if not year_cell:
            continue

        year_text = year_cell.text.strip()
        match = re.search(r"(\d{4})", year_text)
        if not match:
            continue

        year = int(match.group(1))
        if year < START_YEAR:
            continue

        wins_cell = row.find("td", {"data-stat": "wins"})
        losses_cell = row.find("td", {"data-stat": "losses"})

        if wins_cell and losses_cell:
            try:
                total_wins += int(wins_cell.text.strip())
                total_losses += int(losses_cell.text.strip())
            except ValueError:
                pass

        # Check for conference titles
        notes_cell = row.find("td", {"data-stat": "notes"})
        if notes_cell:
            notes = notes_cell.text.strip().lower()
            if "reg. season champ" in notes or "regular season" in notes:
                conf_reg += 1
            if "conf. tourney champ" in notes or "conference tournament" in notes:
                conf_tourney += 1

    if total_wins + total_losses == 0:
        return

    conference = ""
    conf_cell = soup.find("td", {"data-stat": "conf_abbr"})
    if conf_cell:
        conference = conf_cell.text.strip()

    # Try to find current conference from the most recent row
    for row in reversed(list(tbody.find_all("tr"))):
        cc = row.find("td", {"data-stat": "conf_abbr"})
        if cc and cc.text.strip():
            conference = cc.text.strip()
            break

    schools[name] = {
        "school": name,
        "espnId": ESPN_IDS.get(name, 0),
        "conference": conference,
        "wins": total_wins,
        "losses": total_losses,
        "winPct": round(total_wins / (total_wins + total_losses), 3) if (total_wins + total_losses) > 0 else 0,
        "tournamentApps": 0,
        "sweet16": 0,
        "elite8": 0,
        "finalFour": 0,
        "champGame": 0,
        "titles": 0,
        "confRegularSeason": conf_reg,
        "confTournament": conf_tourney,
    }


def get_coach_records() -> list[dict]:
    """Get coaching records from Sports Reference."""
    coaches = []

    # Scrape the coaches index
    soup = fetch(f"{BASE_URL}/coaches/")

    table = soup.find("table", {"id": "coaches"})
    if not table:
        print("WARNING: Could not find coaches table")
        return []

    tbody = table.find("tbody")
    if not tbody:
        return []

    for row in tbody.find_all("tr"):
        if row.get("class") and "thead" in row.get("class", []):
            continue

        name_cell = row.find("td", {"data-stat": "coach"})
        if not name_cell:
            continue

        link = name_cell.find("a")
        if not link:
            continue

        coach_name = link.text.strip()
        href = link["href"]

        # Get coach details
        _scrape_coach(coach_name, href, coaches)

    return coaches


def _scrape_coach(name: str, href: str, coaches: list):
    """Scrape a single coach's career record."""
    try:
        soup = fetch(f"https://www.sports-reference.com{href}")
    except Exception as e:
        print(f"  WARNING: Could not fetch coach {name}: {e}")
        return

    table = soup.find("table", {"id": re.compile(r"(coaches|results)")})
    if not table:
        return

    tbody = table.find("tbody")
    if not tbody:
        return

    # Track per-school stints
    stints: dict[str, dict] = {}

    for row in tbody.find_all("tr"):
        if row.get("class") and "thead" in row.get("class", []):
            continue

        year_cell = row.find("th", {"data-stat": "year_id"})
        school_cell = row.find("td", {"data-stat": "school_name"})
        wins_cell = row.find("td", {"data-stat": "wins"})
        losses_cell = row.find("td", {"data-stat": "losses"})

        if not year_cell or not school_cell or not wins_cell or not losses_cell:
            continue

        year_text = year_cell.text.strip()
        match = re.search(r"(\d{4})", year_text)
        if not match:
            continue
        year = int(match.group(1))
        if year < START_YEAR:
            continue

        school_link = school_cell.find("a")
        school_name = school_link.text.strip() if school_link else school_cell.text.strip()
        if not school_name:
            continue

        if school_name not in stints:
            stints[school_name] = {
                "coach": name,
                "school": school_name,
                "espnId": ESPN_IDS.get(school_name, 0),
                "startYear": year,
                "endYear": year,
                "wins": 0,
                "losses": 0,
                "tournamentApps": 0,
                "sweet16": 0,
                "elite8": 0,
                "finalFour": 0,
                "champGame": 0,
                "titles": 0,
                "confRegularSeason": 0,
                "confTournament": 0,
            }

        stint = stints[school_name]
        stint["endYear"] = max(stint["endYear"], year)
        stint["startYear"] = min(stint["startYear"], year)

        try:
            stint["wins"] += int(wins_cell.text.strip())
            stint["losses"] += int(losses_cell.text.strip())
        except ValueError:
            pass

        # Check for conference titles / tourney in notes
        notes_cell = row.find("td", {"data-stat": "notes"})
        if notes_cell:
            notes = notes_cell.text.strip().lower()
            if "reg. season champ" in notes:
                stint["confRegularSeason"] += 1
            if "conf. tourney champ" in notes:
                stint["confTournament"] += 1
            if "ncaa" in notes.lower():
                stint["tournamentApps"] += 1

    for school_name, stint in stints.items():
        total = stint["wins"] + stint["losses"]
        stint["winPct"] = round(stint["wins"] / total, 3) if total > 0 else 0
        stint["years"] = f"{stint['startYear']}-{stint['endYear']}"
        coaches.append(stint)


def merge_tournament_data(schools: list[dict], coaches: list[dict], tourney: dict):
    """Merge tournament results into school and coach records."""
    # Merge into schools
    for school in schools:
        name = school["school"]
        if name in tourney:
            for key in ["tournamentApps", "sweet16", "elite8", "finalFour", "champGame", "titles"]:
                school[key] = tourney[name][key]

    # For coaches, we need per-year tournament data which we don't have at coach granularity
    # from the summary scrape. Tournament stats will come from the coach page scraping.


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=== Scraping Tournament Results ===")
    tourney = get_tournament_results()
    print(f"Got tournament data for {len(tourney)} schools")

    print("\n=== Scraping School Records ===")
    schools = get_school_records()
    print(f"Got records for {len(schools)} schools")

    print("\n=== Scraping Coach Records ===")
    coaches = get_coach_records()
    print(f"Got records for {len(coaches)} coach stints")

    print("\n=== Merging Tournament Data ===")
    merge_tournament_data(schools, coaches, tourney)

    # Filter to schools with meaningful records
    schools = [s for s in schools if s["wins"] >= 100]
    schools.sort(key=lambda s: s["wins"], reverse=True)

    # Filter coaches with meaningful records
    coaches = [c for c in coaches if c["wins"] >= 50]
    coaches.sort(key=lambda c: c["wins"], reverse=True)

    print(f"\nWriting {len(schools)} schools and {len(coaches)} coach stints")

    with open(os.path.join(OUTPUT_DIR, "schools.json"), "w") as f:
        json.dump(schools, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "coaches.json"), "w") as f:
        json.dump(coaches, f, indent=2)

    print("Done!")


if __name__ == "__main__":
    main()
