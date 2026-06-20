"""Formation slot roles — mirrors packages/shared/src/formation.ts."""

from __future__ import annotations

from .positions import normalize_player_positions

LINE_POSITIONS: dict[str, set[str]] = {
    "GK": {"GK"},
    "DEF": {"RB", "RWB", "CB", "LB", "LWB"},
    "MID": {"CDM", "CM", "CAM", "RM", "LM"},
    "FWD": {"RW", "LW", "CF", "ST"},
}

FORMATION_SLOT_ROLES_11: dict[str, list[str]] = {
    # Order matches PitchView: GK row, then each outfield row bottom → top.
    "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
    "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"],
    "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CDM", "CM", "RWB", "ST", "ST"],
    "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"],
    "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
    "3-4-3": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
}

SLOT_ACCEPTED: dict[str, set[str]] = {
    "GK": {"GK"},
    "LB": {"LB", "LWB"},
    "LWB": {"LB", "LWB"},
    "RB": {"RB", "RWB"},
    "RWB": {"RB", "RWB"},
    "CB": {"CB"},
    "LM": {"LM", "LW"},
    "LW": {"LM", "LW"},
    "RM": {"RM", "RW"},
    "RW": {"RM", "RW"},
    "ST": {"ST", "CF"},
    "CF": {"ST", "CF"},
    "CDM": {"CDM", "CM", "CAM"},
    "CM": {"CDM", "CM", "CAM"},
    "CAM": {"CDM", "CM", "CAM"},
    "DEF": LINE_POSITIONS["DEF"],
    "MID": LINE_POSITIONS["MID"],
    "FWD": LINE_POSITIONS["FWD"],
}


def formation_rows(formation: str) -> list[int]:
    return [int(n) for n in formation.split("-") if n.isdigit()]


def formation_slot_count(formation: str) -> int:
    return 1 + sum(formation_rows(formation))


def _generic_slot_roles(formation: str) -> list[str]:
    row_counts = [1, *formation_rows(formation)]
    roles: list[str] = []
    for row, count in enumerate(row_counts):
        for _ in range(count):
            if row == 0:
                roles.append("GK")
            elif row == len(row_counts) - 1:
                roles.append("FWD")
            elif row == 1:
                roles.append("DEF")
            else:
                roles.append("MID")
    return roles


def formation_slot_roles(formation: str, team_size: int = 11) -> list[str]:
    """Known 11-a-side shapes always use LB/CB/RB labels; 5/8 use DEF/MID/FWD."""
    if formation in FORMATION_SLOT_ROLES_11:
        return list(FORMATION_SLOT_ROLES_11[formation])
    return _generic_slot_roles(formation)


def player_can_play_slot(
    player_positions: list[str],
    slot_index: int,
    formation: str,
    team_size: int = 11,
) -> bool:
    roles = formation_slot_roles(formation, team_size)
    if slot_index >= len(roles):
        return False
    slot_role = roles[slot_index]
    positions = set(normalize_player_positions(player_positions))
    if not positions:
        return False

    # Small-sided rows only — any defender/mid/fwd in that line can fill the slot.
    if slot_role in {"DEF", "MID", "FWD"}:
        allowed = LINE_POSITIONS[slot_role]
        return any(p in allowed for p in positions)

    allowed = SLOT_ACCEPTED.get(slot_role, {slot_role})
    return any(p in allowed for p in positions)


def eligible_slots(
    player_positions: list[str],
    formation: str,
    occupied: set[int],
    team_size: int = 11,
) -> list[int]:
    normalized = normalize_player_positions(player_positions)
    size = formation_slot_count(formation)
    out: list[int] = []
    for i in range(size):
        if i in occupied:
            continue
        if player_can_play_slot(normalized, i, formation, team_size):
            out.append(i)
    return out


def slot_line_label(slot_index: int, formation: str, team_size: int = 11) -> str:
    roles = formation_slot_roles(formation, team_size)
    return roles[slot_index] if slot_index < len(roles) else "MID"


def default_formation(team_size: int) -> str:
    defaults = {11: "4-4-2", 8: "3-3-1", 5: "2-1-1"}
    return defaults.get(team_size, "4-4-2")
