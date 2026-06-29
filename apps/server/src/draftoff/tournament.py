"""Fixture generation for post-draft tournaments."""

from __future__ import annotations

import random
import uuid

from .group_draw import draw_groups


def _match_id() -> str:
    return uuid.uuid4().hex[:10]


def generate_round_robin(
    user_ids: list[str],
    human_ids: set[str] | None = None,
) -> list[list[dict]]:
    teams = list(user_ids)
    if len(teams) < 2:
        return []

    humans = human_ids if human_ids is not None else set(user_ids)

    if len(teams) % 2 == 1:
        teams.append(None)

    n = len(teams)
    rounds: list[list[dict]] = []
    fixed = teams[0]
    rotating = teams[1:]

    for round_idx in range(n - 1):
        pairings = [fixed, *rotating]
        round_matches: list[dict] = []
        for i in range(n // 2):
            home = pairings[i]
            away = pairings[n - 1 - i]
            if home is None or away is None:
                continue
            round_matches.append(
                {
                    "matchId": _match_id(),
                    "round": round_idx,
                    "homeUserId": home,
                    "awayUserId": away,
                    "status": "pending",
                    "result": None,
                    "isHumanFixture": home in humans or away in humans,
                }
            )
        if round_matches:
            rounds.append(round_matches)
        rotating = [rotating[-1], *rotating[:-1]]

    return rounds


def generate_groups_knockout(
    user_ids: list[str],
    human_ids: set[str] | None = None,
    group_size: int = 4,
    confederations: dict[str, str | None] | None = None,
) -> list[list[dict]]:
    """Interleaved group stage: each rounds entry is one matchday across all groups."""
    humans = human_ids if human_ids is not None else set(user_ids)
    teams = list(user_ids)

    chunks: list[list[str]]
    if confederations:
        drawn = draw_groups(teams, confederations, group_size=group_size)
        if drawn:
            chunks = drawn
        else:
            shuffled = list(teams)
            random.shuffle(shuffled)
            chunks = [
                shuffled[i : i + group_size] for i in range(0, len(shuffled), group_size)
            ]
    else:
        shuffled = list(teams)
        random.shuffle(shuffled)
        chunks = [shuffled[i : i + group_size] for i in range(0, len(shuffled), group_size)]

    group_schedules: list[list[list[dict]]] = []
    for chunk in chunks:
        if len(chunk) < 2:
            continue
        group_name = chr(ord("A") + len(group_schedules)) if len(group_schedules) < 26 else f"G{len(group_schedules)}"
        schedule = [
            [{**m, "group": group_name} for m in rnd]
            for rnd in generate_round_robin(chunk, humans)
        ]
        group_schedules.append(schedule)

    if not group_schedules:
        return []

    num_matchdays = max(len(schedule) for schedule in group_schedules)
    rounds: list[list[dict]] = []
    for md in range(num_matchdays):
        matchday: list[dict] = []
        for schedule in group_schedules:
            if md < len(schedule):
                matchday.extend(schedule[md])
        if matchday:
            rounds.append(matchday)

    return rounds


def generate_tournament(
    tournament_type: str,
    user_ids: list[str],
    *,
    human_ids: set[str] | None = None,
    confederations: dict[str, str | None] | None = None,
) -> dict:
    humans = human_ids if human_ids is not None else set(user_ids)
    if tournament_type == "double_round_robin":
        first = generate_round_robin(user_ids, humans)
        second: list[list[dict]] = []
        for rnd in first:
            flipped: list[dict] = []
            for m in rnd:
                flipped.append(
                    {
                        "matchId": _match_id(),
                        "round": len(first) + m["round"],
                        "homeUserId": m["awayUserId"],
                        "awayUserId": m["homeUserId"],
                        "status": "pending",
                        "result": None,
                        "isHumanFixture": m.get("isHumanFixture", False),
                    }
                )
            second.append(flipped)
        rounds = first + second
    elif tournament_type == "groups_knockout":
        rounds = generate_groups_knockout(
            user_ids, humans, confederations=confederations
        )
    else:
        rounds = generate_round_robin(user_ids, humans)

    return {
        "type": tournament_type if tournament_type in {
            "round_robin",
            "double_round_robin",
            "knockout",
            "groups_knockout",
            "best_of",
        } else "round_robin",
        "rounds": rounds,
        "currentRound": 0,
        "standings": [],
        "winnerUserId": None,
        "complete": False,
    }
