"""Pure draft helpers. Framework-free so they stay unit-testable."""

from __future__ import annotations


def snake_order(user_ids: list[str], rounds: int) -> list[str]:
    """Flattened snake-draft pick sequence.

    Direction reverses every round: [A,B,C, C,B,A, A,B,C, ...].
    """
    sequence: list[str] = []
    for round_index in range(rounds):
        order = user_ids if round_index % 2 == 0 else list(reversed(user_ids))
        sequence.extend(order)
    return sequence


def build_draft_state(players: list[dict], settings: dict) -> dict:
    """Initial authoritative DraftState (matches the shared TS type)."""
    user_ids = [p["userId"] for p in players]
    rounds = int(settings["teamSize"])
    order = snake_order(user_ids, rounds)
    return {
        "order": order,
        "currentPickIndex": 0,
        "activeUserId": order[0] if order else None,
        "timeRemaining": int(settings["draftTimerSeconds"]),
        "round": 0,
        "totalRounds": rounds,
        "picks": [],
        "squads": [
            {"userId": uid, "players": [], "teamRating": None} for uid in user_ids
        ],
        "complete": False,
    }
