"""Squad line ratings for team reveal."""

from __future__ import annotations

from .formation import default_formation, slot_line


def _line_stat(player: dict, line: str) -> float:
    summary = player.get("summary") or {}
    if line == "FWD":
        return (summary.get("shooting", 0) + summary.get("pace", 0)) / 2
    if line == "MID":
        return (summary.get("passing", 0) + summary.get("dribbling", 0)) / 2
    if line == "DEF":
        return (summary.get("defending", 0) + summary.get("physical", 0)) / 2
    return float(player.get("overall") or 0)


def squad_summary(
    squad: dict,
    formation: str,
    team_size: int,
) -> dict:
    players = squad.get("players") or []
    buckets: dict[str, list[float]] = {"FWD": [], "MID": [], "DEF": [], "GK": []}

    for player in players:
        slot = player.get("slotIndex")
        if not isinstance(slot, int) or slot < 0:
            continue
        line = slot_line(slot, formation, team_size)
        if line == "GK":
            buckets["GK"].append(_line_stat(player, "DEF"))
        elif line in buckets:
            buckets[line].append(_line_stat(player, line))

    def avg(vals: list[float], fallback: float) -> int:
        if not vals:
            return int(round(fallback))
        return int(round(sum(vals) / len(vals)))

    overall_vals = [float(p.get("overall") or 0) for p in players if p.get("overall")]
    overall = int(round(sum(overall_vals) / len(overall_vals))) if overall_vals else 0
    fallback = float(overall or 60)

    attack = avg(buckets["FWD"], fallback)
    midfield = avg(buckets["MID"], fallback)
    defense = avg(buckets["DEF"] + buckets["GK"], fallback)

    return {
        "userId": squad.get("userId"),
        "overall": overall,
        "attack": attack,
        "midfield": midfield,
        "defense": defense,
    }
