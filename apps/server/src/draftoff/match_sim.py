"""Deterministic match simulation with NSS-style commentary + pitch animations."""

from __future__ import annotations

import random
from typing import Any


def _pick_scorer(squad: dict, rng: random.Random) -> dict:
    players = squad.get("players") or []
    if not players:
        return {"playerId": 0, "name": "Unknown", "slotIndex": 9}
    weights = [max(1, (p.get("overall") or 60) - 40) for p in players]
    return rng.choices(players, weights=weights, k=1)[0]


def _slot_xy(slot_index: int, team: str) -> tuple[float, float]:
    """Map formation slot to pitch coordinates. Home attacks upward."""
    row_map = {
        0: (50, 88),
        1: (18, 72),
        2: (38, 72),
        3: (62, 72),
        4: (82, 72),
        5: (18, 55),
        6: (38, 55),
        7: (62, 55),
        8: (82, 55),
        9: (35, 38),
        10: (65, 38),
    }
    x, y = row_map.get(slot_index, (50, 50))
    if team == "away":
        y = 100 - y
    return x, y


def _anim(
    minute: int,
    kind: str,
    team_user_id: str,
    player: dict | None,
    ball_x: float,
    ball_y: float,
) -> dict:
    return {
        "minute": minute,
        "type": kind,
        "teamUserId": team_user_id,
        "playerId": player.get("playerId") if player else None,
        "slotIndex": player.get("slotIndex") if player else None,
        "ballX": ball_x,
        "ballY": ball_y,
    }


def _commentary(minute: int, text: str, highlight: bool = False) -> dict:
    return {"minute": minute, "text": text, "highlight": highlight}


def simulate_match(
    match_id: str,
    home_user_id: str,
    away_user_id: str,
    home_squad: dict,
    away_squad: dict,
    home_name: str,
    away_name: str,
    *,
    seed: int | None = None,
) -> dict:
    rng = random.Random(seed if seed is not None else match_id)

    home_strength = float(home_squad.get("teamRating") or 70)
    away_strength = float(away_squad.get("teamRating") or 70)
    home_exp = max(0.4, (home_strength / max(away_strength, 1)) * 1.35)
    away_exp = max(0.4, (away_strength / max(home_strength, 1)) * 1.35)

    home_goals = _poisson(home_exp, rng)
    away_goals = _poisson(away_exp, rng)

    commentary: list[dict] = []
    animations: list[dict] = []
    goals: list[dict] = []

    commentary.append(_commentary(0, f"KICK OFF — {home_name} vs {away_name}"))
    animations.append(_anim(0, "kickoff", home_user_id, None, 50, 50))

    goal_minutes_home = sorted(rng.sample(range(8, 89), k=min(home_goals, 80)) if home_goals else [])
    goal_minutes_away = sorted(rng.sample(range(8, 89), k=min(away_goals, 80)) if away_goals else [])
    all_goals = [(m, "home") for m in goal_minutes_home] + [(m, "away") for m in goal_minutes_away]
    all_goals.sort(key=lambda x: x[0])

    filler = [
        (rng.randint(3, 86), "home", "build"),
        (rng.randint(5, 86), "away", "build"),
        (rng.randint(10, 86), "home", "chance"),
    ]
    events = [(m, side, "goal") for m, side in all_goals] + filler
    events.sort(key=lambda x: x[0])

    seen = set()
    for minute, side, kind in events:
        if minute in seen and kind != "goal":
            continue
        seen.add(minute)
        is_home = side == "home"
        squad = home_squad if is_home else away_squad
        team_id = home_user_id if is_home else away_user_id
        team_label = home_name if is_home else away_name
        opp_label = away_name if is_home else home_name

        if kind == "build":
            player = _pick_scorer(squad, rng)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"{last} carries it forward for {team_label}…"))
            sx, sy = _slot_xy(int(player.get("slotIndex") or 9), "home" if is_home else "away")
            animations.append(_anim(minute, "pass", team_id, player, sx, sy))
        elif kind == "chance":
            player = _pick_scorer(squad, rng)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"{last} puts a ball into the box!", highlight=True))
            sx, sy = _slot_xy(int(player.get("slotIndex") or 10), "home" if is_home else "away")
            animations.append(_anim(minute, "cross", team_id, player, sx, max(22, sy - 18)))
            animations.append(_anim(minute, "shot", team_id, player, 50, 28 if is_home else 72))
            commentary.append(_commentary(minute, f"{opp_label} clear their lines."))
        elif kind == "goal":
            player = _pick_scorer(squad, rng)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"A good pass by {last}…", highlight=True))
            sx, sy = _slot_xy(int(player.get("slotIndex") or 9), "home" if is_home else "away")
            animations.append(_anim(minute, "pass", team_id, player, sx, sy))
            commentary.append(_commentary(minute, f"{opp_label} are outnumbered here!", highlight=True))
            commentary.append(_commentary(minute, f"It breaks nicely for {last}!", highlight=True))
            animations.append(_anim(minute, "shot", team_id, player, 50, 22 if is_home else 78))
            commentary.append(_commentary(minute, "GOAL!", highlight=True))
            animations.append(_anim(minute, "goal", team_id, player, 50, 18 if is_home else 82))
            goals.append(
                {
                    "userId": team_id,
                    "scorerPlayerId": int(player.get("playerId") or 0),
                    "scorerName": player.get("name") or "Unknown",
                    "minute": minute,
                    "commentary": f"GOAL! {last} scores for {team_label}!",
                }
            )

    commentary.append(
        _commentary(
            90,
            f"FULL TIME — {home_name} {home_goals} – {away_goals} {away_name}",
            highlight=home_goals != away_goals,
        )
    )

    if home_goals > away_goals:
        winner = home_user_id
    elif away_goals > home_goals:
        winner = away_user_id
    else:
        winner = None

    return {
        "matchId": match_id,
        "homeUserId": home_user_id,
        "awayUserId": away_user_id,
        "homeScore": home_goals,
        "awayScore": away_goals,
        "goals": goals,
        "commentary": commentary,
        "animations": animations,
        "winnerUserId": winner,
    }


def _poisson(lam: float, rng: random.Random) -> int:
    l = max(0.05, lam)
    count = 0
    p = 1.0
    threshold = pow(2.718281828, -l)
    while p > threshold:
        count += 1
        p *= rng.random()
    return max(0, count - 1)
