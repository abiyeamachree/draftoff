"""World Cup confederation lookup for group-draw constraints."""

from __future__ import annotations

CONFEDERATIONS: dict[str, str] = {
    # AFC
    "Australia": "AFC",
    "Iran": "AFC",
    "Iraq": "AFC",
    "Japan": "AFC",
    "Jordan": "AFC",
    "Qatar": "AFC",
    "Saudi Arabia": "AFC",
    "South Korea": "AFC",
    "Uzbekistan": "AFC",
    # CAF
    "Algeria": "CAF",
    "Cape Verde": "CAF",
    "DR Congo": "CAF",
    "Congo DR": "CAF",
    "Egypt": "CAF",
    "Ghana": "CAF",
    "Ivory Coast": "CAF",
    "Morocco": "CAF",
    "Senegal": "CAF",
    "South Africa": "CAF",
    "Tunisia": "CAF",
    # CONCACAF
    "Canada": "CONCACAF",
    "Curaçao": "CONCACAF",
    "Haiti": "CONCACAF",
    "Mexico": "CONCACAF",
    "Panama": "CONCACAF",
    "United States": "CONCACAF",
    # CONMEBOL
    "Argentina": "CONMEBOL",
    "Brazil": "CONMEBOL",
    "Colombia": "CONMEBOL",
    "Ecuador": "CONMEBOL",
    "Paraguay": "CONMEBOL",
    "Uruguay": "CONMEBOL",
    # OFC
    "New Zealand": "OFC",
    # UEFA
    "Austria": "UEFA",
    "Belgium": "UEFA",
    "Bosnia and Herzegovina": "UEFA",
    "Bosnia-Herzegovina": "UEFA",
    "Croatia": "UEFA",
    "Czech Republic": "UEFA",
    "Czechia": "UEFA",
    "England": "UEFA",
    "France": "UEFA",
    "Germany": "UEFA",
    "Netherlands": "UEFA",
    "Norway": "UEFA",
    "Portugal": "UEFA",
    "Scotland": "UEFA",
    "Spain": "UEFA",
    "Sweden": "UEFA",
    "Switzerland": "UEFA",
    "Turkey": "UEFA",
    "Türkiye": "UEFA",
}

MAX_PER_GROUP: dict[str, int] = {
    "UEFA": 2,
    "AFC": 2,
    "CAF": 2,
    "CONCACAF": 2,
    "CONMEBOL": 2,
    "OFC": 1,
}


def nation_confederation(nation: str) -> str | None:
    return CONFEDERATIONS.get(nation.strip())


def confederation_for_player(player: dict | None) -> str | None:
    if not player:
        return None
    if not player.get("isFiller"):
        return None
    if player.get("fillKind") == "nation":
        return nation_confederation(str(player.get("displayName") or ""))
    return None
