"""Fixture generation for post-draft tournaments."""

from __future__ import annotations

import uuid


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
                    "isHumanFixture": home in humans and away in humans,
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
) -> list[list[dict]]:
    """One rounds entry per group — each contains that group's full round robin."""
    humans = human_ids if human_ids is not None else set(user_ids)
    teams = list(user_ids)
    rounds: list[list[dict]] = []

    for gi in range(0, len(teams), group_size):
        chunk = teams[gi : gi + group_size]
        if len(chunk) < 2:
            continue
        group_name = chr(ord("A") + len(rounds)) if len(rounds) < 26 else f"G{len(rounds)}"
        group_matches: list[dict] = []
        for rnd in generate_round_robin(chunk, humans):
            for m in rnd:
                group_matches.append({**m, "group": group_name})
        rounds.append(group_matches)

    return rounds


def generate_tournament(
    tournament_type: str,
    user_ids: list[str],
    *,
    human_ids: set[str] | None = None,
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
        rounds = generate_groups_knockout(user_ids, humans)
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
