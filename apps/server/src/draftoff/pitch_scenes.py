"""Pitch scene templates for match animations (home attacks upward / y→0)."""

from __future__ import annotations

import random
from typing import Any


def _j(rng: random.Random, x: float, y: float, amt: float = 3.5) -> tuple[float, float]:
    return (
        max(2.0, min(98.0, x + rng.uniform(-amt, amt))),
        max(2.0, min(98.0, y + rng.uniform(-amt, amt))),
    )


def _atk_side(home_attacks: bool) -> tuple[str, str]:
    return ("home", "away") if home_attacks else ("away", "home")


def _goal_y(home_attacks: bool) -> float:
    return 8.0 if home_attacks else 92.0


def _def_line_y(home_attacks: bool) -> float:
    return 22.0 if home_attacks else 78.0


def dot(team: str, x: float, y: float) -> dict[str, Any]:
    return {"team": team, "x": round(x, 1), "y": round(y, 1)}


def scene_kickoff(rng: random.Random) -> tuple[list[dict], float, float]:
    players = []
    for x in (25, 40, 50, 60, 75):
        players.append(dot("home", *_j(rng, x, 55)))
        players.append(dot("away", *_j(rng, x, 45)))
    return players, 50.0, 50.0


def scene_corner(home_attacks: bool, team_label: str, rng: random.Random) -> tuple[list[dict], float, float, str]:
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    corner_x = rng.choice([2.5, 97.5])
    ball_x = corner_x
    ball_y = gy
    players: list[dict] = []
    for i in range(8):
        px = 28 + (i % 4) * 14 + rng.uniform(-2, 2)
        py = gy + (6 + (i // 4) * 5) * (1 if home_attacks else -1)
        players.append(dot(atk, *_j(rng, px, py, 2.5)))
    for i in range(5):
        players.append(dot(df, *_j(rng, 35 + i * 8, _def_line_y(home_attacks), 2)))
    players.append(dot(df, *_j(rng, 50, gy + (10 if home_attacks else -10), 2)))
    label = f"A corner for {team_label}"
    return players, ball_x, ball_y, label


def scene_freekick(
    home_attacks: bool, team_label: str, rng: random.Random, *, scored: bool = False
) -> tuple[list[dict], float, float, str]:
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    line = _def_line_y(home_attacks)
    ball_x = _j(rng, 40 + rng.uniform(0, 20), line + (6 if home_attacks else -6))[0]
    ball_y = line + (8 if home_attacks else -8)
    players: list[dict] = []
    wall_xs = [42, 50, 58] if rng.random() > 0.4 else [38, 46, 54, 62]
    for wx in wall_xs:
        players.append(dot(df, *_j(rng, wx, line, 1.2)))
    for i in range(4):
        wx = 20 + i * 18
        wy = line + (14 if home_attacks else -14)
        players.append(dot(atk, *_j(rng, wx, wy, 2)))
    players.append(dot(atk, *_j(rng, ball_x, ball_y + (4 if home_attacks else -4), 1.5)))
    if scored:
        label = f"Free kick — {team_label}"
    else:
        label = f"Free kick for {team_label}"
    return players, ball_x, ball_y, label


def scene_penalty(home_attacks: bool, team_label: str, rng: random.Random) -> tuple[list[dict], float, float, str]:
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    spot_y = gy + (12 if home_attacks else -12)
    players = [
        dot(atk, *_j(rng, 50, spot_y, 1)),
        dot(df, *_j(rng, 50, gy + (4 if home_attacks else -4), 1)),
    ]
    for x in (30, 70):
        players.append(dot(df, *_j(rng, x, spot_y + (8 if home_attacks else -8), 2)))
    label = f"Penalty — {team_label}"
    return players, 50.0, spot_y, label


def scene_transition(home_attacks: bool, team_label: str, rng: random.Random) -> tuple[list[dict], float, float, str]:
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    runners = 2 + rng.randint(0, 1)
    players: list[dict] = []
    rx = [40, 50, 60][:runners]
    for i, x in enumerate(rx):
        ry = gy + (18 + i * 6) * (1 if home_attacks else -1)
        players.append(dot(atk, *_j(rng, x, ry, 2)))
    ball_x, ball_y = _j(rng, rx[min(1, runners - 1)], gy + (22 if home_attacks else -22), 2)
    pack_y = gy + (32 if home_attacks else -32)
    for i in range(7):
        players.append(dot(atk, *_j(rng, 15 + i * 10, pack_y, 3)))
    for i in range(3):
        players.append(dot(df, *_j(rng, 30 + i * 18, _def_line_y(home_attacks), 2)))
    label = f"Breakaway — {team_label}"
    return players, ball_x, ball_y, label


def scene_near_miss(home_attacks: bool, team_label: str, rng: random.Random) -> tuple[list[dict], float, float, str]:
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    side = rng.choice([-1, 1])
    ball_x, ball_y = _j(rng, 50 + side * 8, gy + (3 if home_attacks else -3), 2)
    players = [
        dot(atk, *_j(rng, 48, gy + (14 if home_attacks else -14), 2)),
        dot(df, *_j(rng, 50, gy + (6 if home_attacks else -6), 1.5)),
    ]
    for i in range(4):
        players.append(dot(atk, *_j(rng, 25 + i * 15, gy + (20 if home_attacks else -20), 3)))
    label = f"Near miss — {team_label}"
    return players, ball_x, ball_y, label


def scene_card(
    home_attacks: bool, team_label: str, rng: random.Random, red: bool = False
) -> tuple[list[dict], float, float, str]:
    _, df = _atk_side(home_attacks)
    foul_team = df
    atk, _ = _atk_side(home_attacks)
    mid_y = 50 + rng.uniform(-8, 8)
    players = [
        dot(foul_team, *_j(rng, 48, mid_y, 2)),
        dot(atk, *_j(rng, 52, mid_y + 4, 2)),
    ]
    for i in range(4):
        players.append(dot(foul_team, *_j(rng, 20 + i * 15, mid_y + 10, 4)))
        players.append(dot(atk, *_j(rng, 25 + i * 14, mid_y - 10, 4)))
    card = "Red card" if red else "Yellow card"
    label = f"{card} — {team_label}"
    return players, 50.0, mid_y, label


def scene_offside(home_attacks: bool, team_label: str, rng: random.Random) -> tuple[list[dict], float, float, str]:
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    line = _def_line_y(home_attacks)
    players = [
        dot(atk, *_j(rng, 55, gy + (5 if home_attacks else -5), 1)),
        dot(atk, *_j(rng, 62, line - (2 if home_attacks else -2), 1)),
    ]
    for x in (38, 50, 62):
        players.append(dot(df, *_j(rng, x, line, 1)))
    label = f"Offside — {team_label}"
    return players, 58.0, gy + (4 if home_attacks else -4), label


def scene_goal(
    home_attacks: bool, team_label: str, rng: random.Random, goal_type: str = "open"
) -> tuple[list[dict], float, float, str]:
    if goal_type == "transition":
        return scene_transition(home_attacks, team_label, rng)
    if goal_type == "corner":
        p, bx, by, _ = scene_corner(home_attacks, team_label, rng)
        return p, bx, by, f"GOAL — {team_label}"
    if goal_type == "freekick":
        p, bx, by, _ = scene_freekick(home_attacks, team_label, rng, scored=True)
        return p, 50.0, _goal_y(home_attacks), f"GOAL — {team_label}"
    if goal_type == "penalty":
        p, bx, by, _ = scene_penalty(home_attacks, team_label, rng)
        return p, 50.0, _goal_y(home_attacks), f"GOAL — {team_label}"
    atk, df = _atk_side(home_attacks)
    gy = _goal_y(home_attacks)
    players = [
        dot(atk, *_j(rng, 48, gy + (12 if home_attacks else -12), 2)),
        dot(df, *_j(rng, 52, gy + (8 if home_attacks else -8), 2)),
    ]
    return players, 50.0, gy, f"GOAL — {team_label}"
