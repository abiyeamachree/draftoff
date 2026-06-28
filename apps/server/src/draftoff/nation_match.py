"""Match Wikipedia / FIFA nation names to SoFIFA nation labels."""

from __future__ import annotations

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

NATION_DISPLAY: dict[str, str] = {
    "Congo DR": "DR Congo",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "Czechia": "Czech Republic",
    "Türkiye": "Turkey",
    "Cabo Verde": "Cape Verde",
    "Curacao": "Curaçao",
}


def display_nation_name(db_label: str) -> str:
    return NATION_DISPLAY.get(db_label, db_label)


def _word_set(name: str) -> set[str]:
    return {w for w in name.lower().split() if len(w) > 1}


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
        alias_l = alias.lower()
        for t in available:
            if t.lower() == alias_l:
                return t
        want_words = _word_set(alias)
        if want_words:
            word_matches = [
                t for t in available if want_words <= _word_set(t)
            ]
            if len(word_matches) == 1:
                return word_matches[0]
    want_words = _word_set(want)
    if want_words:
        word_matches = [t for t in available if want_words <= _word_set(t)]
        if len(word_matches) == 1:
            return word_matches[0]
    sub_matches = [
        t for t in available
        if want_l == t.lower() or want_l in t.lower() or t.lower() in want_l
    ]
    if len(sub_matches) == 1:
        return sub_matches[0]
    return None
