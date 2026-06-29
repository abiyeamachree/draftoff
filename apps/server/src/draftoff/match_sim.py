"""Deterministic match simulation with broadcast-style events + pitch scenes."""

from __future__ import annotations

import random
from typing import Any

from . import pitch_scenes as ps


def _pick_scorer(squad: dict, rng: random.Random) -> dict:
    players = squad.get("players") or []
    if not players:
        return {"playerId": 0, "name": "Unknown", "slotIndex": 9}
    weights = [max(1, (p.get("overall") or 60) - 40) for p in players]
    return rng.choices(players, weights=weights, k=1)[0]


def _anim(
    minute: int,
    kind: str,
    team_user_id: str,
    player: dict | None,
    ball_x: float,
    ball_y: float,
    *,
    players: list[dict] | None = None,
    label: str | None = None,
) -> dict:
    out: dict[str, Any] = {
        "minute": minute,
        "type": kind,
        "teamUserId": team_user_id,
        "playerId": player.get("playerId") if player else None,
        "slotIndex": player.get("slotIndex") if player else None,
        "ballX": round(ball_x, 1),
        "ballY": round(ball_y, 1),
    }
    if players:
        out["players"] = players
    if label:
        out["label"] = label
    return out


def _commentary(minute: int, text: str, highlight: bool = False) -> dict:
    return {"minute": minute, "text": text, "highlight": highlight}


def _goal_type_for_team(attacker_rating: float, defender_rating: float, rng: random.Random) -> str:
    """Weaker teams lean toward transition goals."""
    weakness = max(0.0, (defender_rating - attacker_rating) / 30.0)
    roll = rng.random() + weakness * 0.35
    if roll < 0.28:
        return "transition"
    if roll < 0.42:
        return "corner"
    if roll < 0.55:
        return "freekick"
    if roll < 0.62:
        return "penalty"
    return "open"


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

    kick_players, kbx, kby = ps.scene_kickoff(rng)
    commentary.append(_commentary(0, f"KICK OFF — {home_name} vs {away_name}"))
    animations.append(
        _anim(0, "kickoff", home_user_id, None, kbx, kby, players=kick_players, label="Kick off")
    )

    goal_minutes_home = sorted(rng.sample(range(8, 89), k=min(home_goals, 80)) if home_goals else [])
    goal_minutes_away = sorted(rng.sample(range(8, 89), k=min(away_goals, 80)) if away_goals else [])
    all_goals = [(m, "home") for m in goal_minutes_home] + [(m, "away") for m in goal_minutes_away]
    all_goals.sort(key=lambda x: x[0])

    filler_kinds = [
        "corner",
        "corner",
        "freekick",
        "freekick_miss",
        "near_miss",
        "transition",
        "yellow_card",
        "red_card",
        "penalty_miss",
        "offside",
    ]
    filler: list[tuple[int, str, str]] = []
    for _ in range(rng.randint(12, 20)):
        minute = rng.randint(3, 88)
        side = rng.choice(["home", "away"])
        kind = rng.choice(filler_kinds)
        filler.append((minute, side, kind))

    events = [(m, side, "goal") for m, side in all_goals] + filler
    events.sort(key=lambda x: x[0])

    commentary.append(
        _commentary(
            45,
            f"HALF TIME — {home_name} {home_goals} – {away_goals} {away_name}",
            highlight=True,
        )
    )

    used_minutes: set[int] = set()
    for minute, side, kind in events:
        if minute in used_minutes and kind != "goal":
            continue
        used_minutes.add(minute)
        is_home = side == "home"
        squad = home_squad if is_home else away_squad
        team_id = home_user_id if is_home else away_user_id
        team_label = home_name if is_home else away_name
        opp_label = away_name if is_home else home_name
        atk_rating = home_strength if is_home else away_strength
        def_rating = away_strength if is_home else home_strength

        if kind == "corner":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_corner(is_home, team_label, rng)
            commentary.append(_commentary(minute, label))
            animations.append(_anim(minute, "corner", team_id, player, bx, by, players=scene, label=label))
        elif kind == "freekick":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_freekick(is_home, team_label, rng)
            commentary.append(_commentary(minute, label))
            animations.append(_anim(minute, "freekick", team_id, player, bx, by, players=scene, label=label))
        elif kind == "freekick_miss":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_freekick(is_home, team_label, rng)
            commentary.append(_commentary(minute, f"{label} — over the bar!", highlight=True))
            animations.append(
                _anim(minute, "freekick_miss", team_id, player, bx, by - (6 if is_home else -6), players=scene, label=label)
            )
        elif kind == "near_miss":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_near_miss(is_home, team_label, rng)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"{last} — so close for {team_label}!", highlight=True))
            animations.append(_anim(minute, "near_miss", team_id, player, bx, by, players=scene, label=label))
        elif kind == "transition":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_transition(is_home, team_label, rng)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"{last} leads the break for {team_label}…"))
            animations.append(_anim(minute, "transition", team_id, player, bx, by, players=scene, label=label))
        elif kind == "yellow_card":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_card(is_home, team_label, rng, red=False)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"Yellow card for {last} ({team_label})", highlight=True))
            animations.append(_anim(minute, "yellow_card", team_id, player, bx, by, players=scene, label=label))
        elif kind == "red_card":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_card(is_home, team_label, rng, red=True)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"RED CARD — {last} ({team_label})!", highlight=True))
            animations.append(_anim(minute, "red_card", team_id, player, bx, by, players=scene, label=label))
        elif kind == "penalty_miss":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_penalty(is_home, team_label, rng)
            commentary.append(_commentary(minute, f"Penalty missed — {team_label}!", highlight=True))
            animations.append(
                _anim(minute, "penalty_miss", team_id, player, bx, by + (8 if is_home else -8), players=scene, label=label)
            )
        elif kind == "offside":
            player = _pick_scorer(squad, rng)
            scene, bx, by, label = ps.scene_offside(is_home, team_label, rng)
            last = player.get("name", "Player").split()[-1]
            commentary.append(_commentary(minute, f"GOAL? {last} finds the net…", highlight=True))
            animations.append(_anim(minute, "offside_goal", team_id, player, bx, by, players=scene, label="GOAL!"))
            var_scene, vbx, vby, _ = ps.scene_offside(is_home, team_label, rng)
            commentary.append(_commentary(minute, "VAR CHECK…", highlight=True))
            animations.append(
                _anim(minute, "offside_var", team_id, player, vbx, vby, players=var_scene, label="VAR CHECK")
            )
            commentary.append(_commentary(minute, "Goal disallowed — offside.", highlight=True))
        elif kind == "goal":
            player = _pick_scorer(squad, rng)
            last = player.get("name", "Player").split()[-1]
            gtype = _goal_type_for_team(atk_rating, def_rating, rng)
            scene, bx, by, label = ps.scene_goal(is_home, team_label, rng, gtype)
            if gtype == "transition":
                commentary.append(_commentary(minute, f"Counter attack — {team_label}!"))
            elif gtype == "corner":
                commentary.append(_commentary(minute, f"Corner swung in…"))
            elif gtype == "freekick":
                commentary.append(_commentary(minute, f"Free kick — {last}…"))
            elif gtype == "penalty":
                commentary.append(_commentary(minute, f"Penalty — {team_label}…"))
            else:
                commentary.append(_commentary(minute, f"{last} with a chance…"))
            commentary.append(_commentary(minute, "GOAL!", highlight=True))
            animations.append(_anim(minute, "goal", team_id, player, bx, by, players=scene, label=f"GOAL — {team_label}"))
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
