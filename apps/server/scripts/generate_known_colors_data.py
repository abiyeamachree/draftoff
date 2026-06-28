"""Generate known_colors_data.py and club_colors_known.json from curated kit colours.

Reads every team name from data/missing_teams.txt (1767 exact keys) and maps each
to a primary kit hex via CORE_COLORS (1016 unique core names). Year prefixes like
"26 " / "07 " are stripped; II/B/Castilla sides inherit parent club colours.

Run from apps/server:
  python scripts/generate_known_colors_data.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

# Regional primary-kit data (teamcolorcodes / official branding standards).
from _core_colors_seed import (
    ALL_REGIONAL_DICTS,
    _COLORS_ASIA,
    _COLORS_ENGLAND,
    _COLORS_EASTERN_EUROPE,
    _COLORS_FRANCE,
    _COLORS_GERMANY,
    _COLORS_ITALY,
    _COLORS_MEXICO_MLS,
    _COLORS_NATIONAL,
    _COLORS_PT_NL_BE,
    _COLORS_RUSSIA_HISTORICAL,
    _COLORS_SAUDI_UAE,
    _COLORS_SCANDINAVIA,
    _COLORS_SCOTLAND_IRELAND,
    _COLORS_SOUTH_AMERICA,
    _COLORS_SPAIN,
    _COLORS_TURKEY_GREECE_CYPRUS,
    build_core_colors,
)

SERVER = Path(__file__).resolve().parents[1]
MISSING_TEAMS = SERVER / "data" / "missing_teams.txt"
OUT_MODULE = Path(__file__).resolve().parent / "known_colors_data.py"
OUT_JSON = SERVER / "data" / "club_colors_known.json"

# ---------------------------------------------------------------------------
# CORE_COLORS — one entry per unique core name (year prefix stripped).
# ---------------------------------------------------------------------------
CORE_COLORS: dict[str, str] = build_core_colors()

# Force special national-team overrides.
CORE_COLORS["Serbia"] = "#C6363C"
CORE_COLORS["Netherlands"] = "#FF6600"

# Parent clubs for Castilla / reserve sides not covered by suffix stripping.
CASTILLA_PARENTS: dict[str, str] = {
    "Real Madrid Castilla": "Real Madrid",
    "Real Sociedad de Fútbol B": "Real Sociedad de Fútbol",
}

# Real Sociedad B parent colour (teamcolorcodes #00529F).
CORE_COLORS.setdefault("Real Sociedad de Fútbol", "#00529F")
CORE_COLORS.setdefault("Real Madrid", "#FEBE10")

YEAR_PREFIX_RE = re.compile(r"^\d{2}\s+")
RESERVE_SUFFIX_RE = re.compile(
    r"\s+(II|III|B|Castilla|de Fútbol B|de Futbol B)$", re.IGNORECASE
)

REGION_ORDER: list[tuple[str, dict[str, str]]] = [
    ("Germany (Bundesliga, 2.Bundesliga, 3.Liga)", _COLORS_GERMANY),
    ("England (EFL, etc.)", _COLORS_ENGLAND),
    ("Spain (La Liga, La Liga 2)", _COLORS_SPAIN),
    ("Italy (Serie A, B, C)", _COLORS_ITALY),
    ("France (Ligue 1, 2)", _COLORS_FRANCE),
    ("Portugal, Netherlands, Belgium", _COLORS_PT_NL_BE),
    ("Scotland, Ireland", _COLORS_SCOTLAND_IRELAND),
    ("Scandinavia", _COLORS_SCANDINAVIA),
    ("Eastern Europe (Czech, Poland, Romania, etc.)", _COLORS_EASTERN_EUROPE),
    ("Turkey, Greece, Cyprus", _COLORS_TURKEY_GREECE_CYPRUS),
    ("Saudi Arabia, UAE", _COLORS_SAUDI_UAE),
    ("South America (Argentina, Brazil, Chile, Colombia, etc.)", _COLORS_SOUTH_AMERICA),
    ("Mexico, USA MLS", _COLORS_MEXICO_MLS),
    ("Asia (Japan, Korea, China, India, Australia)", _COLORS_ASIA),
    ("Russia and defunct/historical clubs", _COLORS_RUSSIA_HISTORICAL),
    ("National teams", _COLORS_NATIONAL),
]

# Build core -> region label for grouped output comments.
_CORE_REGION: dict[str, str] = {}
for label, regional in REGION_ORDER:
    for core in regional:
        _CORE_REGION.setdefault(core, label)

# Clubs where primary kit colour is debatable (defunct, rebranded, or multi-colour kits).
UNCERTAIN_CORES: frozenset[str] = frozenset({
    "Bury",
    "Chivas USA",
    "Gretna",
    "Hereford United",
    "Macclesfield Town",
    "Northern Fury FC",
    "Saturn Ramenskoye",
    "Sporting Fingal",
    "Syrianska",
    "Thonon Évian",
    "Gold Coast United",
    "Alaniya",
    "FC Tosno",
    "Indios de Ciudad Juárez",
    "Lobos BUAP",
    "Royal Excel Mouscron",
    "Excelsior Mouscron",
    "Kardemir Karabükspor",
    "Hacettepe SK",
    "Manisaspor",
    "Adanaspor",
    "FC Libourne",
    "Grêmio Barueri",
    "Ipatinga",
    "Joinville",
    "Cortuluá",
    "Uniautónoma FC",
    "Tecos FC",
    "CD Veracruz",
    "Atlante",
    "Ravenna",
    "Gallipoli",
    "Portogruaro Calcio ASD",
    "ASG Nocerina",
    "Treviso",
    "Rimini",
    "Ancona",
    "Piacenza",
    "Vicenza",
    "Livorno",
    "Carpi",
    "FC Pro Vercelli 1892",
})


def strip_year_prefix(name: str) -> str:
    return YEAR_PREFIX_RE.sub("", name.strip())


def resolve_core(name: str) -> str:
    """Return the CORE_COLORS lookup key for a roster or core name."""
    core = strip_year_prefix(name)
    if core in CORE_COLORS:
        return core
    if core in CASTILLA_PARENTS:
        return CASTILLA_PARENTS[core]
    parent = RESERVE_SUFFIX_RE.sub("", core).strip()
    if parent in CORE_COLORS:
        return parent
    if parent in CASTILLA_PARENTS:
        return CASTILLA_PARENTS[parent]
    return core


def lookup_color(name: str) -> str:
    core = resolve_core(name)
    if core not in CORE_COLORS:
        raise KeyError(f"No colour for core '{core}' (from '{name}')")
    return CORE_COLORS[core]


def region_for_team(exact_name: str) -> str:
    core = resolve_core(exact_name)
    return _CORE_REGION.get(core, "Other")


def load_missing_teams() -> list[str]:
    lines = MISSING_TEAMS.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip()]


def build_known_club_colors(teams: list[str]) -> dict[str, str]:
    return {team: lookup_color(team) for team in teams}


def _py_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def write_known_colors_module(known: dict[str, str], teams: list[str]) -> None:
    """Write scripts/known_colors_data.py grouped by region."""
    lines: list[str] = [
        '"""Curated primary kit colours for clubs missing from the scraped cache.',
        "",
        "Auto-generated by scripts/generate_known_colors_data.py — do not edit by hand.",
        "Re-generate: python scripts/generate_known_colors_data.py",
        '"""',
        "",
        "from __future__ import annotations",
        "",
        "import json",
        "from pathlib import Path",
        "",
        "KNOWN_CLUB_COLORS: dict[str, str] = {",
    ]

    current_region: str | None = None
    for team in teams:
        region = region_for_team(team)
        if region != current_region:
            lines.append(f"    # --- {region} ---")
            current_region = region
        lines.append(f"    {_py_str(team)}: {_py_str(known[team])},")

    lines.extend([
        "}",
        "",
        "",
        "if __name__ == \"__main__\":",
        "    import json",
        "    from pathlib import Path",
        "    out = Path(__file__).resolve().parents[1] / \"data\" / \"club_colors_known.json\"",
        "    out.write_text(json.dumps(KNOWN_CLUB_COLORS, indent=2, ensure_ascii=False), encoding=\"utf-8\")",
        "    print(f\"Wrote {len(KNOWN_CLUB_COLORS)} entries to {out}\")",
        "",
    ])

    OUT_MODULE.write_text("\n".join(lines), encoding="utf-8")


def validate(known: dict[str, str], teams: list[str]) -> None:
    if len(known) != 1767:
        raise SystemExit(f"Expected 1767 entries, got {len(known)}")
    if len(teams) != 1767:
        raise SystemExit(f"Expected 1767 teams in missing_teams.txt, got {len(teams)}")
    expected_keys = set(teams)
    actual_keys = set(known.keys())
    if expected_keys != actual_keys:
        missing = expected_keys - actual_keys
        extra = actual_keys - expected_keys
        msg = []
        if missing:
            msg.append(f"Missing keys ({len(missing)}): {sorted(missing)[:5]}…")
        if extra:
            msg.append(f"Extra keys ({len(extra)}): {sorted(extra)[:5]}…")
        raise SystemExit("; ".join(msg))
    if len(CORE_COLORS) < 1016:
        raise SystemExit(f"CORE_COLORS has only {len(CORE_COLORS)} entries, need 1016")


def uncertain_teams(teams: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for team in teams:
        core = resolve_core(team)
        if core in UNCERTAIN_CORES and core not in seen:
            seen.add(core)
            out.append(team if strip_year_prefix(team) == core else f"{team} ({core})")
    return sorted(out)


def main() -> None:
    teams = load_missing_teams()
    known = build_known_club_colors(teams)
    validate(known, teams)
    write_known_colors_module(known, teams)
    OUT_JSON.write_text(
        json.dumps(known, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    uncertain = uncertain_teams(teams)
    print(f"CORE_COLORS entries: {len(CORE_COLORS)}")
    print(f"KNOWN_CLUB_COLORS entries: {len(known)}")
    print(f"Wrote {OUT_MODULE}")
    print(f"Wrote {OUT_JSON}")
    if uncertain:
        print(f"\nUncertain colours ({len(uncertain)} core clubs):")
        for t in uncertain:
            print(f"  - {t}")
    else:
        print("\nNo uncertain colour assignments flagged.")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
