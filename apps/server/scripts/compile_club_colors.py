"""Compile primary kit colours for every club in the DraftOff DB.

Sources (in priority order):
  1. Built-in manual overrides for common name variants
  2. clubcolorcodes.com league pages (scraped)
  3. Wikidata P465 (official colour) via SPARQL
  4. League default palette (explicit per league — never hash)

Run from apps/server:
  .venv/Scripts/python.exe scripts/compile_club_colors.py

Output: apps/web/lib/clubColors.generated.ts
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER / "src"))

from sqlalchemy import func, select  # noqa: E402

from draftoff.db.models import Player, TeamEntry  # noqa: E402
from draftoff.db.session import get_session  # noqa: E402
from draftoff.team_match import resolve_team_name  # noqa: E402

OUT_PATH = ROOT / "apps" / "web" / "lib" / "clubColors.generated.ts"

# Explicit league defaults when no club-specific colour is found.
LEAGUE_DEFAULT: dict[str, str] = {
    "Premier League": "#3D195B",
    "La Liga": "#EE8707",
    "Bundesliga": "#D20515",
    "Serie A": "#008FD7",
    "Ligue 1": "#091C3E",
    "Eredivisie": "#F39200",
    "Primeira Liga": "#006600",
    "Major League Soccer": "#005290",
    "Süper Lig": "#E30613",
    "Super Lig": "#E30613",
    "Championship": "#1C2C5B",
    "La Liga 2": "#C8102E",
    "Serie B": "#008FD7",
    "Liga Profesional de Fútbol": "#75AADB",
    "J1 League": "#E60012",
    "K League 1": "#C8102E",
    "Allsvenskan": "#FFCD00",
    "Scottish Premiership": "#003876",
    "Belgian Pro League": "#ED1C24",
    "Super League": "#FF0000",
    "1. Division": "#006747",
    "Bundesliga 2": "#D20515",
    "Ligue 2": "#091C3E",
}

# Curated primary colours (SoFIFA / common display names).
MANUAL: dict[str, str] = {
    "Arsenal": "#EF0107",
    "Manchester City": "#6CABDD",
    "Manchester United": "#DA291C",
    "Liverpool": "#C8102E",
    "Chelsea": "#034694",
    "Tottenham Hotspur": "#132257",
    "Newcastle United": "#241F20",
    "Aston Villa": "#95BFE5",
    "West Ham United": "#7A263A",
    "Everton": "#003399",
    "Leicester City": "#003090",
    "Brighton & Hove Albion": "#0057B8",
    "Crystal Palace": "#1B458F",
    "Wolverhampton Wanderers": "#FDB913",
    "Nottingham Forest": "#DD0000",
    "Fulham": "#000000",
    "Brentford": "#E30613",
    "AFC Bournemouth": "#DA291C",
    "Ipswich Town": "#003087",
    "Southampton": "#D71920",
    "Barcelona": "#A50044",
    "Real Madrid": "#FEBE10",
    "Atletico Madrid": "#CB3524",
    "Atlético Madrid": "#CB3524",
    "Sevilla": "#D01012",
    "Valencia": "#EE3524",
    "Villarreal": "#FFE667",
    "Real Betis": "#00954C",
    "Athletic Bilbao": "#EE2523",
    "Real Sociedad": "#00529F",
    "Bayern Munich": "#DC052D",
    "Borussia Dortmund": "#FDE100",
    "Bayer Leverkusen": "#E32221",
    "RB Leipzig": "#DD0741",
    "Eintracht Frankfurt": "#E1000F",
    "VfB Stuttgart": "#E32219",
    "VfL Wolfsburg": "#65B32E",
    "1. FC Union Berlin": "#EB1923",
    "SC Freiburg": "#E30613",
    "1. FC Heidenheim 1846": "#006633",
    "Inter": "#010E80",
    "Juventus": "#000000",
    "AC Milan": "#FB090B",
    "Napoli": "#12A0D7",
    "Roma": "#8E1F2F",
    "Lazio": "#87D8F7",
    "Atalanta": "#1A2F48",
    "Fiorentina": "#482E92",
    "Paris Saint-Germain": "#004170",
    "Marseille": "#2FAEE0",
    "Monaco": "#E30613",
    "Lyon": "#103478",
    "Lille": "#E30613",
    "Benfica": "#FF0000",
    "Porto": "#003893",
    "Sporting CP": "#008057",
    "Ajax": "#D2122E",
    "PSV Eindhoven": "#ED1C24",
    "Feyenoord": "#E30613",
    "Celtic": "#008057",
    "Rangers": "#1B458F",
    "Galatasaray": "#A90432",
    "Fenerbahçe": "#FFED00",
    "Boca Juniors": "#003087",
    "River Plate": "#ED1C24",
    "Flamengo": "#C8102E",
    "Palmeiras": "#006437",
    "Santos": "#000000",
    "São Paulo": "#FF0000",
    "Corinthians": "#000000",
    "Inter Miami": "#F7B5CD",
    "LA Galaxy": "#00245D",
    "Seattle Sounders FC": "#5D9741",
    "Club Brugge": "#0066B3",
    "Red Bull Salzburg": "#DD0741",
    "Shakhtar Donetsk": "#FF6600",
    "Dynamo Kyiv": "#005BBB",
    "Olympiacos FC": "#E30613",
    "Olympiacos": "#E30613",
    "Panathinaikos": "#006747",
    "Copenhagen": "#00529F",
    "Bodo/Glimt": "#FFCC00",
    "Bodø/Glimt": "#FFCC00",
    "Qarabag": "#000000",
    "Slavia Prague": "#E30613",
    "Sparta Prague": "#8B0000",
    "Young Boys": "#FFCC00",
    "Basel": "#E30613",
    "Stuttgart": "#E32219",
    "Heidenheim": "#006633",
    "Kairat": "#FFD700",
    "Pafos": "#0066CC",
    "Kairat Almaty": "#FFD700",
}

CLUBCOLORCODES_LEAGUES = [
    ("premier-league-color-codes", "Premier League"),
    ("la-liga-color-codes", "La Liga"),
    ("bundesliga-team-color-codes", "Bundesliga"),
    ("serie-a-color-codes", "Serie A"),
    ("ligue-1-color-codes", "Ligue 1"),
    ("eredivisie-color-codes", "Eredivisie"),
    ("primeira-liga-color-codes", "Primeira Liga"),
    ("mls-team-color-codes", "Major League Soccer"),
    ("super-lig-color-codes", "Süper Lig"),
    ("championship-color-codes", "Championship"),
    ("scottish-premiership-color-codes", "Scottish Premiership"),
    ("j-league-color-codes", "J1 League"),
    ("liga-mx-color-codes", "Liga MX"),
    ("brazilian-serie-a-color-codes", "Campeonato Brasileiro"),
]

HEX_RE = re.compile(r"#([0-9A-Fa-f]{6})\b")
NAME_RE = re.compile(
    r"##\s+(.+?)\s+(?:F\.C\.|FC|AFC|CF|SC|SK|FK|AC|AS|SS|US|CD|SD|RC|CF|BSC|TSV|SV|VfL|VfB|1\.\s+FC)?",
    re.I,
)


def normalize_name(name: str) -> str:
    n = name.strip()
    n = re.sub(r"\s+F\.C\.$", "", n, flags=re.I)
    n = re.sub(r"\s+FC$", "", n, flags=re.I)
    n = re.sub(r"\s+AFC$", "", n, flags=re.I)
    return n.strip()


def fetch_url(url: str, retries: int = 3) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "DraftOff-ColorCompiler/1.0 (educational project)"},
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise
    return ""


def scrape_clubcolorcodes() -> dict[str, str]:
    out: dict[str, str] = {}
    base = "https://www.teamcolorcodes.com/soccer/"
    for slug, _league in CLUBCOLORCODES_LEAGUES:
        url = base + slug + "/"
        print(f"  scraping {url}")
        try:
            html = fetch_url(url)
        except Exception as exc:
            print(f"    skip: {exc}")
            continue
        # Each team section: ## Team Name ... first hex in Primary Colors block
        sections = re.split(r"(?=##\s+)", html)
        for section in sections:
            m = re.match(r"##\s+(.+?)\s*$", section.split("\n", 1)[0])
            if not m:
                continue
            raw_name = normalize_name(m.group(1))
            if not raw_name or len(raw_name) < 3:
                continue
            # First hex after "Primary" or first hex in section
            primary_block = section
            pm = re.search(r"Primary Colors[\s\S]{0,800}?(#[0-9A-Fa-f]{6})", primary_block, re.I)
            if pm:
                out[raw_name] = pm.group(1).upper()
                continue
            hexes = HEX_RE.findall(section[:1200])
            if hexes:
                out[raw_name] = f"#{hexes[0].upper()}"
        time.sleep(0.5)
    return out


def fetch_wikidata_colors() -> dict[str, str]:
    """Map English label -> hex from Wikidata official colour (P465)."""
    query = """
    SELECT ?clubLabel ?color WHERE {
      ?club wdt:P31/wdt:P279* wd:Q476028 .
      ?club wdt:P465 ?color .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    """
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode(
        {"format": "json", "query": query}
    )
    print("  fetching Wikidata colours…")
    req = urllib.request.Request(url, headers={"User-Agent": "DraftOff/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    out: dict[str, str] = {}
    for row in data.get("results", {}).get("bindings", []):
        label = row.get("clubLabel", {}).get("value", "")
        color_uri = row.get("color", {}).get("value", "")
        if not label or not color_uri:
            continue
        # colour URI like http://www.wikidata.org/entity/Q123 -> need hex
        # P465 often links to item with P465 string; skip non-hex
        if color_uri.startswith("#"):
            out[normalize_name(label)] = color_uri.upper()
    return out


def load_db_teams() -> tuple[list[str], dict[str, str]]:
    """Return sorted team names and team -> most common league (FC 26)."""
    with get_session() as session:
        names = set(
            session.execute(
                select(Player.team).where(Player.team != "").distinct()
            ).scalars()
        )
        names |= set(
            session.execute(
                select(TeamEntry.team).where(TeamEntry.team != "").distinct()
            ).scalars()
        )
        league_rows = session.execute(
            select(Player.team, Player.league, func.count())
            .where(Player.edition == "FC 26", Player.team != "", Player.league != "")
            .group_by(Player.team, Player.league)
        ).all()
    league_by_team: dict[str, str] = {}
    counts: dict[str, dict[str, int]] = {}
    for team, league, cnt in league_rows:
        counts.setdefault(team, {})[league] = int(cnt)
    for team, leagues in counts.items():
        league_by_team[team] = max(leagues, key=leagues.get)
    return sorted(names), league_by_team


def resolve_color(
    team: str,
    league_by_team: dict[str, str],
    scraped: dict[str, str],
    wikidata: dict[str, str],
) -> tuple[str, str]:
    """Return (hex, source)."""
    if team in MANUAL:
        return MANUAL[team], "manual"
    norm = normalize_name(team)
    if norm in MANUAL:
        return MANUAL[norm], "manual"
    if team in scraped:
        return scraped[team], "clubcolorcodes"
    if norm in scraped:
        return scraped[norm], "clubcolorcodes"
    # fuzzy via resolve_team_name against scraped keys
    scraped_set = set(scraped.keys())
    resolved = resolve_team_name(norm, scraped_set)
    if resolved and resolved in scraped:
        return scraped[resolved], "clubcolorcodes-fuzzy"
    if norm in wikidata:
        return wikidata[norm], "wikidata"
    resolved_wd = resolve_team_name(norm, set(wikidata.keys()))
    if resolved_wd and resolved_wd in wikidata:
        return wikidata[resolved_wd], "wikidata-fuzzy"
    league = league_by_team.get(team, "")
    if league in LEAGUE_DEFAULT:
        return LEAGUE_DEFAULT[league], f"league:{league}"
    # Last resort: explicit grey for unknown — NOT hash
    return "#4B5563", "unknown"


def write_ts(colors: dict[str, str], meta: dict[str, str]) -> None:
    lines = [
        "/** Auto-generated by apps/server/scripts/compile_club_colors.py — do not edit. */",
        "",
        "export const CLUB_PRIMARY: Readonly<Record<string, string>> = {",
    ]
    for team in sorted(colors.keys()):
        esc = team.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  "{esc}": "{colors[team]}",')
    lines.append("} as const;")
    lines.append("")
    lines.append("export type ClubColorSource =")
    lines.append('  | "manual" | "clubcolorcodes" | "clubcolorcodes-fuzzy" | "wikidata" | "wikidata-fuzzy" | "league" | "unknown";')
    lines.append("")
    lines.append("/** Compile-time metadata (source per team) — stripped in production if needed. */")
    lines.append("export const CLUB_COLOR_SOURCE: Readonly<Record<string, ClubColorSource>> = {")
    for team in sorted(meta.keys()):
        esc = team.replace("\\", "\\\\").replace('"', '\\"')
        src = meta[team].split(":")[0] if meta[team].startswith("league:") else meta[team]
        if meta[team].startswith("league:"):
            src = "league"
        lines.append(f'  "{esc}": "{src}",')
    lines.append("} as const;")
    lines.append("")
    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(colors)} teams)")


def main() -> None:
    print("Loading DB teams…")
    teams, league_by_team = load_db_teams()
    print(f"  {len(teams)} unique clubs")

    print("Scraping clubcolorcodes.com…")
    scraped = scrape_clubcolorcodes()
    print(f"  {len(scraped)} scraped entries")

    wikidata: dict[str, str] = {}
    try:
        wikidata = fetch_wikidata_colors()
        print(f"  {len(wikidata)} wikidata entries")
    except Exception as exc:
        print(f"  wikidata skipped: {exc}")

    colors: dict[str, str] = {}
    meta: dict[str, str] = {}
    stats: dict[str, int] = {}

    for team in teams:
        color, source = resolve_color(team, league_by_team, scraped, wikidata)
        colors[team] = color
        meta[team] = source
        key = source.split(":")[0]
        stats[key] = stats.get(key, 0) + 1

    print("Sources:", stats)
    unknown = [t for t, s in meta.items() if s == "unknown"]
    if unknown:
        print(f"  {len(unknown)} teams still unknown (using #4B5563)")
        for t in unknown[:15]:
            print(f"    - {t}")
        if len(unknown) > 15:
            print(f"    … and {len(unknown) - 15} more")

    write_ts(colors, meta)


if __name__ == "__main__":
    main()
