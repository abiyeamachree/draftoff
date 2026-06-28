"""Pool filtering + player/team queries against the DB."""

from __future__ import annotations

import re

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from .db.models import Player, TeamEntry, TeamTag
from .editions import EDITION_TO_SEASON, PICKER_EDITIONS, SEASON_TO_EDITION
from .positions import normalize_player_positions
from .team_match import resolve_team_name
from .nation_match import resolve_nation_name


def seasons_from_team_labels(settings: dict) -> list[str]:
    """If every configured team shares one season label, return it."""
    seasons: set[str] = set()
    for raw in settings.get("teams") or []:
        if not isinstance(raw, str):
            continue
        _, team_season = parse_team_label(raw)
        if team_season:
            seasons.add(team_season)
    return sorted(seasons) if len(seasons) == 1 else []


def resolve_pool_seasons(pool: dict, settings: dict) -> list[str]:
    seasons = (pool.get("include") or {}).get("seasons") or []
    if seasons:
        return seasons
    return seasons_from_team_labels(settings)


def apply_peak_to_options(
    session: Session,
    options: list[dict],
    *,
    peak_enabled: bool,
) -> list[dict]:
    """When peak cards are on, swap each option for that player's highest-overall row."""
    if not peak_enabled:
        return options

    out: list[dict] = []
    for opt in options:
        pid = opt.get("playerId")
        if pid is None:
            out.append(opt)
            continue
        row = session.execute(
            select(Player)
            .where(Player.player_id == int(pid))
            .order_by(Player.overall.desc(), Player.name)
            .limit(1)
        ).scalar_one_or_none()
        if not row:
            out.append(opt)
            continue
        peak = pool_entry(row, drafted_ids=set(), available=opt.get("available", True))
        peak["isPeak"] = True
        out.append(peak)

    out.sort(key=lambda x: (-int(x.get("overall") or 0), str(x.get("name") or "")))
    return out


def seasons_to_editions(seasons: list[str]) -> list[str]:
    if not seasons:
        return list(PICKER_EDITIONS)
    out = [SEASON_TO_EDITION[s] for s in seasons if s in SEASON_TO_EDITION]
    return out or list(PICKER_EDITIONS)


def _filter_matches(row: Player, pool: dict) -> bool:
    include = pool.get("include") or {}
    exclude = pool.get("exclude") or {}
    logic = pool.get("logic") or "OR"

    def hit(filt: dict, field: str, value: str) -> bool:
        items = filt.get(field) or []
        return bool(items) and value in items

    def nation_hit(items: list[str], value: str) -> bool:
        if not items:
            return False
        if value in items:
            return True
        available = set(items)
        resolved = resolve_nation_name(value, available)
        return resolved in available if resolved else False

    ex = (
        hit(exclude, "leagues", row.league)
        or nation_hit((exclude.get("nations") or []), row.nation)
        or hit(exclude, "clubs", row.team)
        or hit(exclude, "seasons", EDITION_TO_SEASON.get(row.edition, ""))
    )
    if ex:
        return False

    inc_leagues = include.get("leagues") or []
    inc_nations = include.get("nations") or []
    inc_clubs = include.get("clubs") or []
    inc_seasons = include.get("seasons") or []
    if not inc_leagues and not inc_nations and not inc_clubs and not inc_seasons:
        return True

    checks = []
    if inc_leagues:
        checks.append(row.league in inc_leagues)
    if inc_nations:
        checks.append(nation_hit(inc_nations, row.nation))
    if inc_clubs:
        checks.append(row.team in inc_clubs)
    if inc_seasons:
        checks.append(EDITION_TO_SEASON.get(row.edition, "") in inc_seasons)

    return all(checks) if logic == "AND" else any(checks)


def _player_summary(row: Player) -> dict:
    return {
        "pace": row.pace or 0,
        "shooting": row.shooting or 0,
        "passing": row.passing or 0,
        "dribbling": row.dribbling or 0,
        "defending": row.defending or 0,
        "physical": row.physical or 0,
    }


def player_to_dict(row: Player, available: bool = True) -> dict:
    return {
        "playerId": row.player_id,
        "edition": row.edition,
        "name": row.name,
        "overall": row.overall,
        "bestPosition": row.best_position,
        "positions": _parse_positions(row.positions),
        "nation": row.nation,
        "team": row.team,
        "league": row.league,
        "age": row.age,
        "summary": _player_summary(row),
        "isPeak": False,
        "available": available,
    }


def pool_entry(row: Player, drafted_ids: set[int], available: bool | None = None) -> dict:
    avail = available if available is not None else row.player_id not in drafted_ids
    positions = _parse_positions(row.positions)
    return {
        "playerId": row.player_id,
        "edition": row.edition,
        "name": row.name,
        "overall": row.overall,
        "bestPosition": row.best_position,
        "positions": positions,
        "nation": row.nation,
        "team": row.team,
        "league": row.league,
        "available": avail,
        "summary": _player_summary(row),
    }


def parse_team_label(label: str) -> tuple[str, str]:
    m = re.match(r"^(.+) \(([^)]+)\)$", (label or "").strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return (label or "").strip(), ""


def settings_allowed_clubs(settings: dict, edition: str) -> set[str] | None:
    """Clubs configured in lobby settings for this edition, or None if unrestricted."""
    teams = settings.get("teams") or []
    if not teams:
        return None
    season = EDITION_TO_SEASON.get(edition, "")
    allowed: set[str] = set()
    for raw in teams:
        if not isinstance(raw, str):
            continue
        club, team_season = parse_team_label(raw)
        if not club:
            continue
        if not team_season or team_season == season:
            allowed.add(club)
    return allowed or None


def configured_db_teams(
    session: Session,
    edition: str,
    pool: dict,
    settings: dict,
) -> set[str]:
    """Resolve settings + pool club names to SoFIFA team labels for an edition."""
    db_teams = set(
        session.execute(
            select(Player.team).where(Player.edition == edition, Player.team != "")
        ).scalars()
    )
    season = EDITION_TO_SEASON.get(edition, "")
    names: set[str] = set()

    for raw in settings.get("teams") or []:
        if not isinstance(raw, str):
            continue
        club, team_season = parse_team_label(raw)
        if not club:
            continue
        if team_season and team_season != season:
            continue
        resolved = resolve_team_name(club, db_teams)
        if resolved:
            names.add(resolved)

    for club in (pool.get("include") or {}).get("clubs") or []:
        resolved = resolve_team_name(str(club), db_teams)
        if resolved:
            names.add(resolved)

    return names


def configured_db_nations(
    session: Session,
    edition: str,
    pool: dict,
) -> set[str]:
    """Resolve pool nation names to SoFIFA nation labels for an edition."""
    db_nations = set(
        session.execute(
            select(Player.nation).where(Player.edition == edition, Player.nation != "")
        ).scalars()
    )
    names: set[str] = set()
    for raw in (pool.get("include") or {}).get("nations") or []:
        resolved = resolve_nation_name(str(raw), db_nations)
        if resolved:
            names.add(resolved)
    return names


def expand_pool_for_edition(
    pool: dict,
    session: Session,
    edition: str,
    settings: dict,
) -> dict:
    """Replace pool.include.clubs with resolved DB team names for this edition."""
    expanded = {
        **pool,
        "include": {**(pool.get("include") or {})},
        "exclude": {**(pool.get("exclude") or {})},
        "logic": pool.get("logic") or "OR",
    }
    configured = configured_db_teams(session, edition, pool, settings)
    if configured:
        expanded["include"]["clubs"] = sorted(configured)
    configured_nations = configured_db_nations(session, edition, pool)
    if configured_nations:
        expanded["include"]["nations"] = sorted(configured_nations)
    elif (pool.get("include") or {}).get("nations"):
        # Restrict to configured list even if DB labels differ slightly
        expanded["include"]["nations"] = sorted(
            {str(n) for n in (pool.get("include") or {}).get("nations") or []}
        )
    # Edition already scopes the season; OR with seasons would match the whole edition.
    inc = expanded["include"]
    if inc.get("clubs") or inc.get("nations") or inc.get("leagues"):
        inc["seasons"] = []
    return expanded


def eligible_roll_teams(
    session: Session,
    edition: str,
    pool: dict,
    drafted_ids: set[int],
    settings: dict,
) -> list[str]:
    """Teams that can appear on the dice reel and be rolled for picks."""
    pool = expand_pool_for_edition(pool, session, edition, settings)
    return teams_with_pool_players(session, edition, pool, drafted_ids)


def _parse_positions(raw: str) -> list[str]:
    return normalize_player_positions(raw) or ["CM"]


def list_seasons(session: Session) -> list[dict]:
    from sqlalchemy import func

    rows = session.execute(
        select(Player.edition, func.count(Player.id))
        .group_by(Player.edition)
        .order_by(Player.edition.desc())
    ).all()
    out = []
    for edition, count in rows:
        season = EDITION_TO_SEASON.get(edition)
        if season:
            out.append({"edition": edition, "season": season, "playerCount": count})
    order = {e: i for i, e in enumerate(PICKER_EDITIONS)}
    out.sort(key=lambda x: order.get(x["edition"], 99))
    return out


def list_leagues(session: Session, edition: str) -> list[str]:
    rows = session.execute(
        select(TeamEntry.league)
        .where(TeamEntry.edition == edition, TeamEntry.league != "")
        .distinct()
        .order_by(TeamEntry.league)
    ).scalars()
    return list(rows)


def list_nations(session: Session, edition: str) -> list[dict]:
    from sqlalchemy import func

    rows = session.execute(
        select(Player.nation, func.count(Player.id))
        .where(Player.edition == edition, Player.nation != "")
        .group_by(Player.nation)
        .order_by(Player.nation)
    ).all()
    return [{"nation": nation, "playerCount": int(count)} for nation, count in rows]


def list_teams(
    session: Session,
    edition: str,
    league: str | None = None,
    tag: str | None = None,
) -> list[dict]:
    q: Select = select(TeamEntry).where(TeamEntry.edition == edition)
    if league:
        q = q.where(TeamEntry.league == league)
    teams = session.execute(q.order_by(TeamEntry.league, TeamEntry.team)).scalars().all()

    tag_rows = session.execute(
        select(TeamTag.team, TeamTag.tag).where(TeamTag.edition == edition)
    ).all()
    tags_by_team: dict[str, list[str]] = {}
    for team, t in tag_rows:
        tags_by_team.setdefault(team, []).append(t)

    season = EDITION_TO_SEASON.get(edition, edition)
    out = []
    for t in teams:
        tags = tags_by_team.get(t.team, [])
        if tag and tag not in tags:
            continue
        out.append(
            {
                "team": t.team,
                "league": t.league,
                "edition": edition,
                "season": season,
                "label": f"{t.team} ({season})",
                "tags": tags,
            }
        )
    return out


def teams_with_pool_players(
    session: Session,
    edition: str,
    pool: dict,
    drafted_ids: set[int],
) -> list[str]:
    """Team names that have at least one undrafted player matching the pool."""
    rows = session.execute(
        select(Player).where(Player.edition == edition, Player.team != "")
    ).scalars()
    teams: set[str] = set()
    for row in rows:
        if row.player_id in drafted_ids:
            continue
        if _filter_matches(row, pool):
            teams.add(row.team)
    return sorted(teams)


def nations_with_pool_players(
    session: Session,
    edition: str,
    pool: dict,
    drafted_ids: set[int],
) -> list[str]:
    rows = session.execute(
        select(Player).where(Player.edition == edition, Player.nation != "")
    ).scalars()
    nations: set[str] = set()
    for row in rows:
        if row.player_id in drafted_ids:
            continue
        if _filter_matches(row, pool):
            nations.add(row.nation)
    return sorted(nations)


def leagues_with_pool_players(
    session: Session,
    edition: str,
    pool: dict,
    drafted_ids: set[int],
) -> list[str]:
    rows = session.execute(
        select(Player).where(Player.edition == edition, Player.league != "")
    ).scalars()
    leagues: set[str] = set()
    for row in rows:
        if row.player_id in drafted_ids:
            continue
        if _filter_matches(row, pool):
            leagues.add(row.league)
    return sorted(leagues)


def positions_with_pool_players(
    session: Session,
    edition: str,
    pool: dict,
    drafted_ids: set[int],
) -> list[str]:
    rows = session.execute(select(Player).where(Player.edition == edition)).scalars()
    positions: set[str] = set()
    for row in rows:
        if row.player_id in drafted_ids:
            continue
        if _filter_matches(row, pool):
            positions.add(row.best_position)
    return sorted(positions)


def query_offer_players(
    session: Session,
    *,
    edition: str,
    pool: dict,
    drafted_ids: set[int],
    team: str | None = None,
    league: str | None = None,
    nation: str | None = None,
    position: str | None = None,
    limit: int = 20,
) -> list[dict]:
    q = select(Player).where(Player.edition == edition)
    if team:
        q = q.where(Player.team == team)
    if league:
        q = q.where(Player.league == league)
    if nation:
        q = q.where(Player.nation == nation)
    if position:
        q = q.where(Player.best_position == position)

    rows = session.execute(q.order_by(Player.overall.desc(), Player.name)).scalars()
    out: list[dict] = []
    for row in rows:
        if row.player_id in drafted_ids:
            continue
        if not _filter_matches(row, pool):
            continue
        out.append(pool_entry(row, drafted_ids))
        if len(out) >= limit:
            break
    return out
