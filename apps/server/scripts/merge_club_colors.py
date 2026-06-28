"""Merge scraped + curated knowledge colours for every DB club.

Priority: scraped (teamcolorcodes) > curated knowledge > Wikidata P465 > league default.

Run: .venv/Scripts/python.exe scripts/merge_club_colors.py
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER / "src"))

from sqlalchemy import func, select  # noqa: E402

from draftoff.db.models import Player, TeamEntry  # noqa: E402
from draftoff.db.session import get_session  # noqa: E402
from draftoff.team_match import resolve_team_name  # noqa: E402

OUT_TS = ROOT / "apps" / "web" / "lib" / "clubColors.generated.ts"
CACHE_JSON = SERVER / "data" / "club_colors_cache.json"
KNOWN_JSON = SERVER / "data" / "club_colors_known.json"
REPORT_JSON = SERVER / "data" / "club_colors_report.json"

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
    "3. Liga": "#D20515",
    "Liga Portugal 2": "#006600",
    "EFL League One": "#1C2C5B",
    "EFL League Two": "#1C2C5B",
}


def core_name(team: str) -> str:
    s = re.sub(r"^\d{2}\s+", "", team)
    s = re.sub(r"\s+(II|III|B|U\d{2}|U-\d{2})$", "", s, flags=re.I)
    return s.strip()


def norm_key(name: str) -> str:
    s = unicodedata.normalize("NFKD", name)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"^\d{2}\s+", "", s)
    s = re.sub(r"\b(f\.?c\.?|c\.?f\.?|s\.?k\.?|a\.?c\.?|s\.?c\.?|fk|sv|tsv|vfb|vfl)\b", " ", s, flags=re.I)
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    for a, b in (("munich", "munchen"), ("cologne", "koln")):
        s = s.replace(a, b)
    tokens = [t for t in s.split() if len(t) > 2 or t.isdigit()]
    return " ".join(tokens)


def load_scraped() -> dict[str, str]:
    if not CACHE_JSON.exists():
        return {}
    cache = json.loads(CACHE_JSON.read_text(encoding="utf-8"))
    by_name: dict[str, str] = {}
    by_norm: dict[str, str] = {}
    for entry in cache.values():
        if not isinstance(entry, dict) or "hex" not in entry:
            continue
        name = entry.get("name", "")
        hex_color = entry["hex"]
        if name:
            by_name[name] = hex_color
            by_norm[norm_key(name)] = hex_color
    return {"by_name": by_name, "by_norm": by_norm}


def load_known() -> dict[str, str]:
    if KNOWN_JSON.exists():
        return json.loads(KNOWN_JSON.read_text(encoding="utf-8"))
    return {}


def fetch_wikidata() -> dict[str, str]:
    query = """
    SELECT ?clubLabel ?colorLabel WHERE {
      ?club wdt:P31/wdt:P279* wd:Q476028 .
      ?club wdt:P465 ?color .
      ?color rdfs:label ?colorLabel .
      FILTER(LANG(?colorLabel) = "en")
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  """
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode(
        {"format": "json", "query": query}
    )
    req = urllib.request.Request(url, headers={"User-Agent": "DraftOff/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    out: dict[str, str] = {}
    color_map = {
        "red": "#DC2626", "blue": "#2563EB", "white": "#F8FAFC", "black": "#111827",
        "green": "#16A34A", "yellow": "#EAB308", "orange": "#EA580C", "navy blue": "#1E3A8A",
        "maroon": "#7F1D1D", "claret": "#7F1D1D", "sky blue": "#38BDF8", "royal blue": "#1D4ED8",
        "burgundy": "#7F1D1D", "gold": "#CA8A04", "purple": "#7C3AED", "crimson": "#BE123C",
    }
    for row in data.get("results", {}).get("bindings", []):
        label = row.get("clubLabel", {}).get("value", "")
        color_name = row.get("colorLabel", {}).get("value", "").lower()
        if not label:
            continue
        hex_color = color_map.get(color_name)
        if hex_color:
            out[label] = hex_color
    return out


def load_db_teams() -> tuple[list[str], dict[str, str]]:
    with get_session() as session:
        names = set(
            session.execute(select(Player.team).where(Player.team != "").distinct()).scalars()
        )
        names |= set(
            session.execute(select(TeamEntry.team).where(TeamEntry.team != "").distinct()).scalars()
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


def lookup(
    team: str,
    scraped: dict,
    known: dict[str, str],
    wikidata: dict[str, str],
    league_by_team: dict[str, str],
) -> tuple[str | None, str]:
    by_name = scraped["by_name"]
    by_norm = scraped["by_norm"]
    core = core_name(team)

    for candidate in (team, core):
        if candidate in by_name:
            return by_name[candidate], "scraped"
        if candidate in known:
            return known[candidate], "known"
        nk = norm_key(candidate)
        if nk in by_norm:
            return by_norm[nk], "scraped-norm"
        if nk in {norm_key(k) for k in known}:
            for k, v in known.items():
                if norm_key(k) == nk:
                    return v, "known-norm"

    pool = set(by_name.keys()) | set(known.keys())
    for candidate in (team, core):
        resolved = resolve_team_name(candidate, pool)
        if resolved:
            if resolved in by_name:
                return by_name[resolved], "scraped-resolved"
            if resolved in known:
                return known[resolved], "known-resolved"

    for candidate in (team, core):
        if candidate in wikidata:
            return wikidata[candidate], "wikidata"
        resolved = resolve_team_name(candidate, set(wikidata.keys()))
        if resolved and resolved in wikidata:
            return wikidata[resolved], "wikidata-resolved"

    league = league_by_team.get(team, "")
    if league in LEAGUE_DEFAULT:
        return LEAGUE_DEFAULT[league], f"league"

    return None, "fallback"


def write_ts(colors: dict[str, str]) -> None:
    lines = [
        "/** Club primary kit colours — scraped + curated. Do not edit by hand. */",
        "",
        "export const CLUB_PRIMARY: Readonly<Record<string, string>> = {",
    ]
    for team in sorted(colors.keys()):
        esc = team.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  "{esc}": "{colors[team]}",')
    lines.append("} as const;")
    lines.append("")
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    print("Loading sources…")
    scraped = load_scraped()
    known = load_known()
    print(f"  scraped names: {len(scraped['by_name'])}")
    print(f"  known entries: {len(known)}")

    wikidata: dict[str, str] = {}
    try:
        wikidata = fetch_wikidata()
        print(f"  wikidata: {len(wikidata)}")
    except Exception as exc:
        print(f"  wikidata skipped: {exc}")

    teams, league_by_team = load_db_teams()
    colors: dict[str, str] = {}
    stats: dict[str, int] = defaultdict(int)
    missing: list[str] = []

    for team in teams:
        hex_color, source = lookup(team, scraped, known, wikidata, league_by_team)
        if hex_color:
            colors[team] = hex_color
            stats[source] += 1
        else:
            colors[team] = "#4B5563"
            missing.append(team)
            stats["fallback"] += 1

    # Propagate within same core club across roster-year variants
    groups: dict[str, list[str]] = defaultdict(list)
    for team in teams:
        groups[norm_key(core_name(team))].append(team)
    for ck, group in groups.items():
        if not ck:
            continue
        sourced = [t for t in group if stats.get("fallback", 0) == 0 or t not in missing]
        colored = [t for t in group if colors.get(t) != "#4B5563"]
        if not colored:
            continue
        best = colored[0]
        for t in group:
            if colors[t] == "#4B5563":
                colors[t] = colors[best]
                if t in missing:
                    missing.remove(t)
                    stats["fallback"] -= 1
                    stats["sibling"] += 1

    write_ts(colors)
    REPORT_JSON.write_text(
        json.dumps({"stats": dict(stats), "missing": missing, "matched": len(teams) - len(missing)}, indent=2),
        encoding="utf-8",
    )

    print("\n=== RESULTS ===")
    print(f"Total:     {len(teams)}")
    print(f"Coloured:  {len(teams) - len(missing)}")
    print(f"Fallbacks: {len(missing)}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
