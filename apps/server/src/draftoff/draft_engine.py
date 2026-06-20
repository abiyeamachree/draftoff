"""Draft turn: roll dice (team/year/etc.) and serve pick options."""

from __future__ import annotations

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db.models import Player
from .db.session import get_session
from .editions import EDITION_TO_SEASON
from .formation import default_formation, eligible_slots, formation_slot_count
from .positions import normalize_player_positions
from .pool import (
    apply_peak_to_options,
    expand_pool_for_edition,
    leagues_with_pool_players,
    nations_with_pool_players,
    player_to_dict,
    positions_with_pool_players,
    query_offer_players,
    resolve_pool_seasons,
    seasons_to_editions,
    teams_with_pool_players,
)


def drafted_player_ids(draft: dict) -> set[int]:
    ids: set[int] = set()
    for pick in draft.get("picks") or []:
        player = pick.get("player") or {}
        pid = player.get("playerId")
        if pid is not None:
            ids.add(int(pid))
    return ids


def _occupied_slots(squad: dict | None) -> set[int]:
    occupied: set[int] = set()
    if not squad:
        return occupied
    for player in squad.get("players") or []:
        slot = player.get("slotIndex")
        if isinstance(slot, int) and slot >= 0:
            occupied.add(slot)
    return occupied


def _active_formation(draft: dict, lobby_players: list[dict] | None, team_size: int) -> str:
    active = draft.get("activeUserId")
    if lobby_players and active:
        for p in lobby_players:
            if p.get("userId") == active and p.get("formation"):
                return str(p["formation"])
    return default_formation(team_size)


def _annotate_options(
    offer: dict,
    draft: dict,
    lobby_players: list[dict] | None,
    team_size: int,
) -> None:
    active = draft.get("activeUserId")
    squad = next(
        (s for s in (draft.get("squads") or []) if s.get("userId") == active),
        None,
    )
    formation = _active_formation(draft, lobby_players, team_size)
    occupied = _occupied_slots(squad)

    for opt in offer.get("options") or []:
        raw = opt.get("positions") or [opt.get("bestPosition")]
        if not isinstance(raw, list):
            raw = [raw]
        positions = normalize_player_positions(raw)
        opt["positions"] = positions
        slots = eligible_slots(positions, formation, occupied, team_size)
        opt["eligibleSlots"] = slots
        opt["pickable"] = bool(slots) and bool(opt.get("available", True))


def _roll_pool_for_edition(
    session: Session,
    edition: str,
    pool: dict,
    drafted: set[int],
    mode: str,
) -> list[str]:
    if mode == "team":
        return teams_with_pool_players(session, edition, pool, drafted)
    if mode == "league":
        return leagues_with_pool_players(session, edition, pool, drafted)
    if mode == "nation":
        return nations_with_pool_players(session, edition, pool, drafted)
    if mode == "position":
        return positions_with_pool_players(session, edition, pool, drafted)
    return []


def _pick_edition_and_pool(
    session: Session,
    editions: list[str],
    pool: dict,
    drafted: set[int],
    settings: dict,
    mode: str,
) -> tuple[str, dict, list[str]]:
    """Prefer an edition whose roll pool is non-empty after resolving club names."""
    candidates = list(editions)
    random.shuffle(candidates)
    for edition in candidates:
        expanded = expand_pool_for_edition(pool, session, edition, settings)
        roll = _roll_pool_for_edition(session, edition, expanded, drafted, mode)
        if roll:
            return edition, expanded, roll
    edition = candidates[0] if candidates else random.choice(editions)
    expanded = expand_pool_for_edition(pool, session, edition, settings)
    return edition, expanded, _roll_pool_for_edition(session, edition, expanded, drafted, mode)


def generate_turn_offer(
    settings: dict,
    draft: dict,
    session: Session | None = None,
    *,
    lobby_players: list[dict] | None = None,
) -> dict | None:
    if draft.get("complete") or not draft.get("activeUserId"):
        return None

    own_session = session is None
    if own_session:
        session = get_session()

    try:
        pool = settings.get("pool") or {}
        mode = settings.get("pickCycleMode") or "team"
        drafted = drafted_player_ids(draft)
        peak_enabled = bool(settings.get("peakCardsEnabled"))
        editions = seasons_to_editions(resolve_pool_seasons(pool, settings))
        edition, expanded_pool, roll_pool = _pick_edition_and_pool(
            session, editions, pool, drafted, settings, mode
        )
        team_size = int(settings.get("teamSize") or 11)

        offer: dict = {
            "cycleMode": mode,
            "edition": edition,
            "season": EDITION_TO_SEASON.get(edition, edition),
            "options": [],
            "rollPool": roll_pool,
            "label": "",
        }

        if mode == "team":
            if not roll_pool:
                offer["label"] = "No teams available"
                return offer
            team = random.choice(roll_pool)
            league = session.execute(
                select(Player.league)
                .where(Player.edition == edition, Player.team == team)
                .limit(1)
            ).scalar_one_or_none() or ""
            offer["team"] = team
            offer["league"] = league
            offer["label"] = f"{team} · {offer['season']}"
            offer["options"] = query_offer_players(
                session,
                edition=edition,
                pool=expanded_pool,
                drafted_ids=drafted,
                team=team,
            )

        elif mode == "league":
            if not roll_pool:
                offer["label"] = "No leagues available"
                return offer
            league = random.choice(roll_pool)
            offer["league"] = league
            offer["label"] = f"{league} · {offer['season']}"
            offer["options"] = query_offer_players(
                session,
                edition=edition,
                pool=expanded_pool,
                drafted_ids=drafted,
                league=league,
            )

        elif mode == "nation":
            if not roll_pool:
                offer["label"] = "No nations available"
                return offer
            nation = random.choice(roll_pool)
            offer["nation"] = nation
            offer["label"] = f"{nation} · {offer['season']}"
            offer["options"] = query_offer_players(
                session,
                edition=edition,
                pool=expanded_pool,
                drafted_ids=drafted,
                nation=nation,
            )

        elif mode == "position":
            if not roll_pool:
                offer["label"] = "No positions available"
                return offer
            position = random.choice(roll_pool)
            offer["position"] = position
            offer["label"] = f"{position} · {offer['season']}"
            offer["options"] = query_offer_players(
                session,
                edition=edition,
                pool=expanded_pool,
                drafted_ids=drafted,
                position=position,
            )
        else:
            offer["label"] = "Unknown cycle mode"

        offer["options"] = apply_peak_to_options(
            session,
            offer.get("options") or [],
            peak_enabled=peak_enabled,
        )
        _annotate_options(offer, draft, lobby_players, team_size)
        return offer
    finally:
        if own_session and session is not None:
            session.close()


def apply_pick(
    settings: dict,
    draft: dict,
    player_id: int,
    edition: str,
    slot_index: int,
    *,
    lobby_players: list[dict] | None = None,
    auto: bool = False,
) -> tuple[dict | None, str | None]:
    """Validate pick from current turnOffer, append to draft, advance turn."""
    offer = draft.get("turnOffer")
    if not offer:
        return None, "No active pick offer"

    match = next(
        (
            o
            for o in offer.get("options") or []
            if o.get("playerId") == player_id and o.get("edition") == edition
        ),
        None,
    )
    if not match:
        return None, "That player is not in your current options"

    if not match.get("pickable", True):
        return None, "No open position for this player on your team"

    team_size = int(settings.get("teamSize") or 11)
    formation = _active_formation(draft, lobby_players, team_size)
    slot_count = formation_slot_count(formation)
    if slot_index < 0 or slot_index >= slot_count:
        return None, "Invalid position slot"

    active = draft.get("activeUserId")
    squad = next(
        (s for s in (draft.get("squads") or []) if s.get("userId") == active),
        None,
    )
    occupied = _occupied_slots(squad)

    with get_session() as session:
        row = session.execute(
            select(Player).where(
                Player.player_id == player_id,
                Player.edition == edition,
            )
        ).scalar_one_or_none()
        if not row:
            return None, "Player not found"

        positions = normalize_player_positions(row.positions or "")
        allowed = eligible_slots(positions, formation, occupied, team_size)
        if slot_index not in allowed:
            return None, "That position is not available for this player"

        player = player_to_dict(row)
        player["slotIndex"] = slot_index
        num_drafters = max(1, len(draft["squads"]))
        pick = {
            "overallPick": draft["currentPickIndex"],
            "round": draft["currentPickIndex"] // num_drafters,
            "userId": draft["activeUserId"],
            "player": player,
            "slotIndex": slot_index,
            "auto": auto,
        }
        draft["picks"].append(pick)
        for squad in draft["squads"]:
            if squad["userId"] == draft["activeUserId"]:
                squad["players"].append(player)
                break

        draft["currentPickIndex"] += 1
        if draft["currentPickIndex"] >= len(draft["order"]):
            draft["complete"] = True
            draft["activeUserId"] = None
            draft["turnOffer"] = None
        else:
            draft["round"] = draft["currentPickIndex"] // num_drafters
            draft["activeUserId"] = draft["order"][draft["currentPickIndex"]]
            draft["timeRemaining"] = int(settings.get("draftTimerSeconds", 15))
            draft["rerollsRemaining"] = int(settings.get("rerollsPerPick", 1))
            draft["pickTimerActive"] = False
            draft["turnOffer"] = generate_turn_offer(
                settings,
                draft,
                session=session,
                lobby_players=lobby_players,
            )

        return draft, None


def try_auto_pick(
    settings: dict,
    draft: dict,
    lobby_players: list[dict] | None,
) -> tuple[dict | None, str | None]:
    """Pick the first eligible player when the turn timer expires."""
    offer = draft.get("turnOffer")
    if not offer:
        return None, "No active pick offer"

    for opt in offer.get("options") or []:
        if not opt.get("available", True) or not opt.get("pickable", True):
            continue
        slots = opt.get("eligibleSlots") or []
        if not slots:
            continue
        return apply_pick(
            settings,
            draft,
            int(opt["playerId"]),
            str(opt.get("edition") or ""),
            int(slots[0]),
            lobby_players=lobby_players,
            auto=True,
        )

    return None, "No auto-pickable players"
