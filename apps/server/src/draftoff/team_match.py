"""Match curated competition team names to SoFIFA club labels."""

from __future__ import annotations

# Common shorthand -> preferred substring for fuzzy match
ALIASES: dict[str, str] = {
    "Barcelona": "FC Barcelona",
    "Bayern Munich": "FC Bayern München",
    "Bayer Leverkusen": "Bayer 04 Leverkusen",
    "Atletico Madrid": "Atlético Madrid",
    "Athletic Bilbao": "Athletic Club",
    "Paris Saint-Germain": "Paris Saint-Germain",
    "Inter": "Inter",
    "PSV Eindhoven": "PSV",
    "Borussia Dortmund": "Borussia Dortmund",
    "Club Brugge": "Club Brugge",
    "Slavia Prague": "SK Slavia Praha",
    "Bodo/Glimt": "FK Bodø/Glimt",
    "Benfica": "SL Benfica",
    "Monaco": "AS Monaco",
    "Marseille": "Olympique de Marseille",
    "Villarreal": "Villarreal CF",
    "Sporting CP": "Sporting CP",
    "Galatasaray": "Galatasaray SK",
    "Olympiacos": "Olympiacos FC",
    "Copenhagen": "FC Copenhagen",
    "Union Saint-Gilloise": "Union Saint-Gilloise",
    "Eintracht Frankfurt": "Eintracht Frankfurt",
    "Newcastle United": "Newcastle United",
    "Tottenham Hotspur": "Tottenham Hotspur",
    "Manchester City": "Manchester City",
    "Real Madrid": "Real Madrid",
    "Liverpool": "Liverpool",
    "Arsenal": "Arsenal",
    "Chelsea": "Chelsea",
    "Juventus": "Juventus",
    "Atalanta": "Atalanta",
    "Napoli": "Napoli",
    "Ajax": "Ajax",
}


def resolve_team_name(want: str, available: set[str]) -> str | None:
    if want in available:
        return want
    alias = ALIASES.get(want)
    if alias and alias in available:
        return alias
    want_l = want.lower()
    for t in available:
        if t.lower() == want_l:
            return t
    # Prefer exact alias substring in DB name
    if alias:
        for t in available:
            if alias.lower() in t.lower():
                return t
    # Unique substring match (avoid matching wrong "Barcelona de Guayaquil" for "Barcelona")
    if want_l == "barcelona":
        for t in available:
            if t == "FC Barcelona":
                return t
        return None
    matches = [t for t in available if want_l in t.lower()]
    if len(matches) == 1:
        return matches[0]
    # Pick shortest match containing all words
    words = want_l.split()
    word_matches = [
        t
        for t in available
        if all(w in t.lower() for w in words if len(w) > 2)
    ]
    if len(word_matches) == 1:
        return word_matches[0]
    return None
