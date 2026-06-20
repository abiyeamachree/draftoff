"""Playable position codes parsed from SoFIFA — mirrors packages/shared/src/positions.ts."""

from __future__ import annotations

PLAYABLE_POSITIONS = {
    "GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST",
}

NON_PLAYABLE = {"SUB", "RES"}

POSITION_ALIASES: dict[str, str] = {
    "LCB": "CB",
    "RCB": "CB",
    "LCM": "CM",
    "RCM": "CM",
    "LDM": "CDM",
    "RDM": "CDM",
    "LAM": "CAM",
    "RAM": "CAM",
    "LS": "ST",
    "RS": "ST",
    "LF": "LW",
    "RF": "RW",
}


def normalize_player_positions(raw: list[str] | str) -> list[str]:
    if isinstance(raw, str):
        parts = raw.replace(",", " ").split()
    else:
        parts = raw

    seen: set[str] = set()
    out: list[str] = []
    for part in parts:
        code = (part or "").strip().upper()
        if not code or code in NON_PLAYABLE:
            continue
        mapped = POSITION_ALIASES.get(code, code)
        if mapped not in PLAYABLE_POSITIONS or mapped in seen:
            continue
        seen.add(mapped)
        out.append(mapped)
    return out
