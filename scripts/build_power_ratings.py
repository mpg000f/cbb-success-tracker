"""Scrape SRS ratings from Sports Reference and build power_ratings.json.

Uses the same SR-to-ESPN name mapping as scrape_seasons.py.
Output: public/data/power_ratings.json  { "1985": { "<espnId>": srs, ... }, ... }
"""

import json
import time
import re
import os
import requests
from bs4 import BeautifulSoup, Comment

# Reuse the SR infrastructure from scrape_seasons
from scrape_seasons import (
    SR_TO_ESPN_NAME, ESPN_TEAMS_URL, _normalize,
    resolve_espn_id, fetch_sr, parse_sr_html,
)

BASE_URL = "https://www.sports-reference.com/cbb"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "power_ratings.json")
START_YEAR = 1985
END_YEAR = 2026


def fetch_espn_ids() -> dict[str, int]:
    """Fetch ESPN team IDs. Returns normalized_name -> espnId."""
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
            for n in [team.get("displayName", ""), team.get("shortDisplayName", ""),
                       team.get("location", ""), team.get("nickname", "")]:
                if n:
                    mapping[_normalize(n)] = espn_id
            abbr = team.get("abbreviation", "")
            if abbr:
                mapping[_normalize(abbr)] = espn_id
        page_count = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("pageCount", 1)
        if page >= page_count:
            break
        page += 1
    print(f"  Got {len(mapping)} ESPN name mappings")
    return mapping


def scrape_srs_year(year: int, espn_map: dict[str, int]) -> dict[str, float]:
    """Scrape SRS ratings for a single season. Returns { espnId_str: srs_value }."""
    url = f"{BASE_URL}/seasons/men/{year}-ratings.html"
    try:
        html = fetch_sr(url)
    except Exception as e:
        print(f"  {year}: skipped ({e})")
        return {}

    soup = parse_sr_html(html)
    table = soup.find("table", {"id": "ratings"})
    if not table:
        print(f"  {year}: no ratings table found")
        return {}

    result = {}
    for row in table.find_all("tr"):
        school_cell = row.find(["th", "td"], {"data-stat": "school_name"})
        srs_cell = row.find("td", {"data-stat": "srs"})
        if not school_cell or not srs_cell:
            continue
        link = school_cell.find("a")
        if not link:
            continue
        sr_name = link.text.strip()
        try:
            srs = round(float(srs_cell.text.strip()), 1)
        except (ValueError, AttributeError):
            continue

        espn_id = resolve_espn_id(sr_name, espn_map)
        if espn_id:
            result[str(espn_id)] = srs

    return result


def main():
    espn_map = fetch_espn_ids()
    combined = {}

    print(f"Scraping SRS ratings for {START_YEAR}-{END_YEAR}...")
    for year in range(START_YEAR, END_YEAR + 1):
        ratings = scrape_srs_year(year, espn_map)
        if ratings:
            combined[str(year)] = ratings
            print(f"  {year}: {len(ratings)} teams")

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(combined, f, separators=(",", ":"))
    print(f"Wrote {len(combined)} years to {OUT_PATH}")


if __name__ == "__main__":
    main()
