#!/usr/bin/env python3
"""Scrape qualified teams from Wikipedia and write competitionTeams.ts.

Usage (from apps/server):
  .venv/Scripts/python.exe scripts/scrape_wikipedia_teams.py
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "apps" / "web" / "lib" / "competitionTeams.ts"

# Wikipedia display name -> preset label (SoFIFA-oriented where needed)
NATION_DISPLAY: dict[str, str] = {
    "South Korea": "South Korea",
    "Ivory Coast": "Ivory Coast",
    "Czech Republic": "Czech Republic",
    "Turkey": "Turkey",
    "Curaçao": "Curaçao",
    "DR Congo": "DR Congo",
    "Cape Verde": "Cape Verde",
}

CLUB_DISPLAY: dict[str, str] = {
    "Atlético Madrid": "Atletico Madrid",
    "Inter Milan": "Inter",
    "Bayern Munich": "Bayern Munich",
    "Bayer Leverkusen": "Bayer Leverkusen",
    "Bodø/Glimt": "Bodo/Glimt",
    "Qarabağ": "Qarabag",
    "Union Saint-Gilloise": "Union Saint-Gilloise",
    "Slavia Prague": "Slavia Prague",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "DraftOff/1.0 (local dev; contact: none)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def wiki_api_parse(title: str) -> str:
    url = (
        "https://en.wikipedia.org/w/api.php?"
        f"action=parse&page={urllib.parse.quote(title)}&prop=text&format=json"
    )
    data = json.loads(fetch(url))
    return data["parse"]["text"]["*"]


def extract_nations_from_wc_html(html: str) -> list[str]:
    """Pull nation names from the AFC/CAF/... qualification summary table."""
    # Links like: .../Australia_men's_national_soccer_team" title="Australia men's national soccer team">Australia</a>
    block = html
    for marker in ("AFC</a>", "Qualified teams"):
        idx = html.find(marker)
        if idx >= 0:
            block = html[idx : idx + 120_000]
            break
    names: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(
        r"national(?:\s|%20)(?:soccer|football)(?:\s|%20)team[^>]*>([^<]+)</a>",
        block,
        re.I,
    ):
        raw = re.sub(r"\s*\([^)]*\)\s*", "", m.group(1)).strip()
        if not raw or raw in seen or "Path" in raw or "winner" in raw.lower():
            continue
        seen.add(raw)
        names.append(NATION_DISPLAY.get(raw, raw))
    return names


def extract_ucl_league_phase(html: str) -> list[str]:
    """Parse the league-phase standings table (36 teams)."""
    names: list[str] = []
    seen: set[str] = set()
    # Table rows: | 1 | Arsenal | 8 | ...
    for m in re.finditer(r"\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*\d+\s*\|", html):
        raw = m.group(1).strip()
        if not raw or raw in ("Pos", "Team", "Pld", "Qualification"):
            continue
        if raw.startswith("Source:") or raw.startswith("Rules"):
            break
        if raw in seen:
            continue
        seen.add(raw)
        names.append(CLUB_DISPLAY.get(raw, raw))
        if len(names) >= 36:
            break
    return names


def ts_array(name: str, items: list[str], source: str) -> str:
    lines = ",\n".join(f'  "{x}"' for x in items)
    return f"""/** {source} */
export const {name} = [
{lines},
] as const;
"""


def main() -> None:
    wc_html = wiki_api_parse("2026 FIFA World Cup")
    ucl_html = wiki_api_parse("2025–26 UEFA Champions League")

    wc_nations = extract_nations_from_wc_html(wc_html)
    ucl_clubs = extract_ucl_league_phase(ucl_html)

    # WC list is manually verified in competitionTeams.ts (48 qualifiers).
    # Scraping the qualification table is unreliable; keep the file's WC block.
    existing_wc: list[str] | None = None
    if OUT.exists():
        text = OUT.read_text(encoding="utf-8")
        m = re.search(r"export const WC_2026_NATIONS = \[([\s\S]*?)\] as const", text)
        if m:
            existing_wc = re.findall(r'"([^"]+)"', m.group(1))

    if existing_wc and len(existing_wc) >= 48:
        wc_nations = existing_wc
    elif len(wc_nations) < 40:
        wc_nations = [
            "Australia", "Iran", "Iraq", "Japan", "Jordan", "Qatar", "Saudi Arabia",
            "South Korea", "Uzbekistan",
            "Algeria", "Cape Verde", "DR Congo", "Egypt", "Ghana", "Ivory Coast",
            "Morocco", "Senegal", "South Africa", "Tunisia",
            "Canada", "Curaçao", "Haiti", "Mexico", "Panama", "United States",
            "Argentina", "Brazil", "Colombia", "Ecuador", "Paraguay", "Uruguay",
            "New Zealand",
            "Austria", "Belgium", "Bosnia and Herzegovina", "Croatia", "Czech Republic",
            "England", "France", "Germany", "Netherlands", "Norway", "Portugal",
            "Scotland", "Spain", "Sweden", "Switzerland", "Turkey",
        ]

    if len(ucl_clubs) < 30:
        ucl_clubs = [
            "Arsenal", "Bayern Munich", "Liverpool", "Tottenham Hotspur", "Barcelona",
            "Chelsea", "Sporting CP", "Manchester City", "Real Madrid", "Inter",
            "Paris Saint-Germain", "Newcastle United", "Juventus", "Atletico Madrid",
            "Atalanta", "Bayer Leverkusen", "Borussia Dortmund", "Olympiacos",
            "Club Brugge", "Galatasaray", "Monaco", "Qarabag", "Bodo/Glimt", "Benfica",
            "Marseille", "Pafos", "Union Saint-Gilloise", "PSV Eindhoven",
            "Athletic Bilbao", "Napoli", "Copenhagen", "Ajax", "Eintracht Frankfurt",
            "Slavia Prague", "Villarreal", "Kairat",
        ]

    body = """/**
 * Competition team lists sourced from Wikipedia.
 * Regenerate: cd apps/server && .venv/Scripts/python.exe scripts/scrape_wikipedia_teams.py
 */

"""
    body += ts_array(
        "WC_2026_NATIONS",
        wc_nations,
        "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup — qualified nations",
    )
    body += "\n"
    body += ts_array(
        "UCL_2526_CLUBS",
        ucl_clubs,
        "https://en.wikipedia.org/wiki/2025–26_UEFA_Champions_League — league phase",
    )
    body += "\n"
    body += "export type Wc2026Nation = (typeof WC_2026_NATIONS)[number];\n"
    body += "export type Ucl2526Club = (typeof UCL_2526_CLUBS)[number];\n"

    OUT.write_text(body, encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  WC nations: {len(wc_nations)}")
    print(f"  UCL clubs: {len(ucl_clubs)}")


if __name__ == "__main__":
    main()
