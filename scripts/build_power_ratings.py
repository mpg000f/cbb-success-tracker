"""Download power ratings from cbb_power_rating repo and combine into one JSON file."""

import json
import urllib.request
import os

BASE_URL = "https://raw.githubusercontent.com/mpg000f/cbb_power_rating/main/docs/data"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "power_ratings.json")
YEARS = range(2005, 2027)


def fetch_year(year):
    url = f"{BASE_URL}/ratings_{year}.json"
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())
        result = {}
        for team in data.get("ratings", []):
            eff = round(team["adjO"] - team["adjD"], 1)
            result[str(team["teamId"])] = eff
        print(f"  {year}: {len(result)} teams")
        return result
    except Exception as e:
        print(f"  {year}: skipped ({e})")
        return None


def main():
    combined = {}
    print("Fetching power ratings...")
    for year in YEARS:
        ratings = fetch_year(year)
        if ratings:
            combined[str(year)] = ratings

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(combined, f, separators=(",", ":"))
    print(f"Wrote {len(combined)} years to {OUT_PATH}")


if __name__ == "__main__":
    main()
