"""Match Wikipedia / FIFA nation names to SoFIFA nation labels."""

from __future__ import annotations

# Wikipedia / FIFA label -> SoFIFA DB label
NATION_ALIASES: dict[str, str] = {
    "South Korea": "Korea Republic",
    "Korea Republic": "Korea Republic",
    "Ivory Coast": "Côte d'Ivoire",
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Czech Republic": "Czechia",
    "Turkey": "Türkiye",
    "Türkiye": "Türkiye",
    "Cape Verde": "Cabo Verde",
    "Curaçao": "Curacao",
    "Curacao": "Curacao",
    "DR Congo": "Congo DR",
    "Democratic Republic of the Congo": "Congo DR",
    "USA": "United States",
    "United States": "United States",
}


def resolve_nation_name(want: str, available: set[str]) -> str | None:
    if want in available:
        return want
    alias = NATION_ALIASES.get(want)
    if alias and alias in available:
        return alias
    want_l = want.lower()
    for t in available:
        if t.lower() == want_l:
            return t
    if alias:
        for t in available:
            if alias.lower() in t.lower() or t.lower() in alias.lower():
                return t
    matches = [t for t in available if want_l in t.lower()]
    if len(matches) == 1:
        return matches[0]
    return None
