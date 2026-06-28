"""HTTP catalog routes — teams/leagues from DB for lobby UI."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .db import get_session, player_count
from .editions import EDITION_TO_SEASON, SEASON_TO_EDITION, TEAM_TAG_LABELS
from .pool import list_leagues, list_nations, list_seasons, list_teams

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/status")
def catalog_status():
    return {"players": player_count(), "ready": player_count() > 0}


@router.get("/seasons")
def catalog_seasons():
    with get_session() as session:
        return list_seasons(session)


@router.get("/leagues")
def catalog_leagues(season: str = Query(...)):
    edition = SEASON_TO_EDITION.get(season)
    if not edition:
        raise HTTPException(404, "Unknown season")
    with get_session() as session:
        return {"season": season, "edition": edition, "leagues": list_leagues(session, edition)}


@router.get("/nations")
def catalog_nations(season: str = Query(...)):
    edition = SEASON_TO_EDITION.get(season)
    if not edition:
        raise HTTPException(404, "Unknown season")
    with get_session() as session:
        return {
            "season": season,
            "edition": edition,
            "nations": list_nations(session, edition),
        }


@router.get("/teams")
def catalog_teams(
    season: str = Query(...),
    league: str | None = Query(None),
    tag: str | None = Query(None),
):
    edition = SEASON_TO_EDITION.get(season)
    if not edition:
        raise HTTPException(404, "Unknown season")
    with get_session() as session:
        teams = list_teams(session, edition, league=league, tag=tag)
    return {
        "season": season,
        "edition": edition,
        "tagLabels": TEAM_TAG_LABELS,
        "teams": teams,
    }
