"""Map SoFIFA edition labels ↔ UI season labels."""

from __future__ import annotations

# edition label (CSV) -> season label (UI)
EDITION_TO_SEASON: dict[str, str] = {
    "FC 26": "25/26",
    "FC 25": "24/25",
    "FC 24": "23/24",
    "FIFA 23": "22/23",
    "FIFA 22": "21/22",
    "FIFA 21": "20/21",
    "FIFA 20": "19/20",
    "FIFA 19": "18/19",
    "FIFA 18": "17/18",
    "FIFA 17": "16/17",
    "FIFA 16": "15/16",
    "FIFA 15": "14/15",
    "FIFA 14": "13/14",
    "FIFA 13": "12/13",
    "FIFA 12": "11/12",
    "FIFA 11": "10/11",
    "FIFA 10": "09/10",
    "FIFA 09": "08/09",
    "FIFA 08": "07/08",
    "FIFA 07": "06/07",
}

SEASON_TO_EDITION: dict[str, str] = {v: k for k, v in EDITION_TO_SEASON.items()}

# Editions we surface in the team picker (newest first).
PICKER_EDITIONS = ["FC 26", "FC 25", "FC 24", "FIFA 23", "FIFA 22", "FIFA 21", "FIFA 18", "FIFA 14"]

TEAM_TAG_LABELS: dict[str, str] = {
    "ucl": "UCL",
    "uel": "Europa",
    "uecl": "Conference",
    "promoted": "↑",
    "relegated": "↓",
}
