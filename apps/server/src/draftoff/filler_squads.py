"""Auto-build squads for non-human league spots from lobby settings."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db.models import Player
from .db.session import get_session
from .editions import PICKER_EDITIONS, SEASON_TO_EDITION
from .fill_teams import parse_fill_label
from .formation import (
    default_formation,
    formation_slot_count,
    player_can_play_slot,
)
from .pool import (
    _filter_matches,
    expand_pool_for_edition,
    player_to_dict,
    resolve_pool_seasons,
    seasons_to_editions,
)
from .nation_match import resolve_nation_name
from .positions import normalize_player_positions
from .team_match import resolve_team_name


def _edition_for_label(label: str, settings: dict) -> str:
    _name, season, _kind = parse_fill_label(label)
    if season and season in SEASON_TO_EDITION:
        return SEASON_TO_EDITION[season]
    seasons = resolve_pool_seasons(settings.get("pool") or {}, settings)
    editions = seasons_to_editions(seasons)
    return editions[0] if editions else PICKER_EDITIONS[0]


def _roster_rows(
    session: Session,
    settings: dict,
    edition: str,
    team_name: str | None,
) -> list[Player]:
    pool = expand_pool_for_edition(settings.get("pool") or {}, session, edition, settings)
    q = select(Player).where(Player.edition == edition)
    if team_name:
        q = q.where(Player.team == team_name)
    rows = session.execute(q.order_by(Player.overall.desc(), Player.name)).scalars().all()
    return [r for r in rows if _filter_matches(r, pool)]


def build_squad_from_roster(
    rows: list,
    formation: str,
    team_size: int,
) -> list[dict]:
    picked: set[int] = set()
    squad: list[dict] = []
    slots = formation_slot_count(formation)

    for slot_idx in range(min(slots, team_size)):
        best = None
        for row in rows:
            if row.player_id in picked:
                continue
            positions = normalize_player_positions(row.positions or row.best_position or "")
            if player_can_play_slot(positions, slot_idx, formation, team_size):
                if best is None or (row.overall or 0) > (best.overall or 0):
                    best = row
        if best is not None:
            player = player_to_dict(best)
            player["slotIndex"] = slot_idx
            squad.append(player)
            picked.add(best.player_id)

    for slot_idx in range(min(slots, team_size)):
        if any(p.get("slotIndex") == slot_idx for p in squad):
            continue
        for row in rows:
            if row.player_id in picked:
                continue
            player = player_to_dict(row)
            player["slotIndex"] = slot_idx
            squad.append(player)
            picked.add(row.player_id)
            break

    return squad


def _roster_rows_by_nation(
    session: Session,
    settings: dict,
    edition: str,
    nation_name: str,
) -> list[Player]:
    pool = expand_pool_for_edition(settings.get("pool") or {}, session, edition, settings)
    db_nations = set(
        session.execute(
            select(Player.nation).where(
                Player.edition == edition,
                Player.nation != "",
            )
        ).scalars()
    )
    resolved = resolve_nation_name(nation_name, db_nations) if nation_name else None
    if not resolved:
        return []
    q = select(Player).where(Player.edition == edition, Player.nation == resolved)
    rows = session.execute(q.order_by(Player.overall.desc(), Player.name)).scalars().all()
    return [r for r in rows if _filter_matches(r, pool)]


def build_nation_squad(
    session: Session,
    settings: dict,
    nation_label: str,
    team_size: int,
) -> list[dict]:
    name, _season, kind = parse_fill_label(nation_label)
    if kind != "nation":
        return build_club_squad(session, settings, nation_label, team_size)
    edition = _edition_for_label(nation_label, settings)
    formation = default_formation(team_size)
    rows = _roster_rows_by_nation(session, settings, edition, name)
    return build_squad_from_roster(rows, formation, team_size)


def build_club_squad(
    session: Session,
    settings: dict,
    club_label: str,
    team_size: int,
) -> list[dict]:
    name, _season, kind = parse_fill_label(club_label)
    if kind == "nation":
        return build_nation_squad(session, settings, club_label, team_size)
    club = name
    edition = _edition_for_label(club_label, settings)
    formation = default_formation(team_size)

    db_teams = set(
        session.execute(
            select(Player.team).where(
                Player.edition == edition,
                Player.team != "",
            )
        ).scalars()
    )
    team_name = resolve_team_name(club, db_teams) if club else None
    rows = _roster_rows(session, settings, edition, team_name)
    return build_squad_from_roster(rows, formation, team_size)


def build_bot_squad(
    session: Session,
    settings: dict,
    team_size: int,
) -> list[dict]:
    edition = _edition_for_label("", settings)
    formation = default_formation(team_size)
    rows = _roster_rows(session, settings, edition, None)
    return build_squad_from_roster(rows[: team_size * 4], formation, team_size)


def filler_labels_for_lobby(settings: dict, fillers_needed: int) -> list[str]:
    if fillers_needed <= 0:
        return []

    labels: list[str] = []
    for raw in settings.get("teams") or []:
        if len(labels) >= fillers_needed:
            break
        if isinstance(raw, str) and raw.strip():
            labels.append(raw.strip())

    if settings.get("fillWithBots"):
        bot_n = 0
        while len(labels) < fillers_needed:
            bot_n += 1
            labels.append(f"Bot {bot_n}")

    return labels


def ensure_league_participants(lobby) -> tuple[list[str], set[str]]:
    """Add filler squads so the league reaches settings.numTeams."""
    settings = lobby.settings
    draft = lobby.draft
    if not draft:
        return [], set()

    team_size = int(settings.get("teamSize") or 11)
    num_teams = max(2, int(settings.get("numTeams") or 2))

    humans = [p for p in lobby.players if not p.get("isFiller")]
    human_ids = {p["userId"] for p in humans}
    fillers_needed = max(0, num_teams - len(humans))

    if fillers_needed == 0:
        return [s["userId"] for s in draft.get("squads") or [] if s.get("userId")], human_ids

    labels = filler_labels_for_lobby(settings, fillers_needed)
    formation = default_formation(team_size)

    with get_session() as session:
        for i, label in enumerate(labels):
            user_id = f"filler_{i}_{uuid.uuid4().hex[:6]}"
            name, _season, kind = parse_fill_label(label)
            is_bot = label.startswith("Bot ")
            is_nation = kind == "nation" and not is_bot
            is_club = kind == "club" and not is_bot
            display = name if name and not is_bot else label

            if is_bot:
                players = build_bot_squad(session, settings, team_size)
                fill_kind = "bot"
            elif is_nation:
                players = build_nation_squad(session, settings, label, team_size)
                fill_kind = "nation"
            else:
                players = build_club_squad(session, settings, label, team_size)
                fill_kind = "club"

            lobby.players.append(
                {
                    "userId": user_id,
                    "displayName": display,
                    "icon": "🤖" if is_bot else ("🌍" if is_nation else "🏟️"),
                    "formation": formation,
                    "isHost": False,
                    "isReady": True,
                    "isFiller": True,
                    "fillKind": fill_kind,
                    "draftSlot": None,
                    "connection": "connected",
                }
            )
            draft.setdefault("squads", []).append(
                {"userId": user_id, "players": players, "teamRating": None}
            )

    return [s["userId"] for s in draft.get("squads") or [] if s.get("userId")], human_ids
