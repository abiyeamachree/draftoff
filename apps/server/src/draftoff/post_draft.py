"""Finalize draft → squad summaries + tournament fixtures."""

from __future__ import annotations

from .filler_squads import ensure_league_participants
from .formation import default_formation
from .match_sim import simulate_match
from .rating import squad_summary
from .tournament import generate_tournament


def finalize_draft(lobby) -> None:
    draft = lobby.draft
    if not draft or not draft.get("complete"):
        return

    team_size = int(lobby.settings.get("teamSize") or 11)
    participant_ids, human_ids = ensure_league_participants(lobby)

    summaries: list[dict] = []
    for squad in draft.get("squads") or []:
        player = lobby.find_player(squad.get("userId") or "")
        formation = (
            player.get("formation")
            if player
            else default_formation(team_size)
        )
        summary = squad_summary(squad, formation, team_size)
        summaries.append(summary)
        squad["teamRating"] = summary["overall"]

    lobby.squad_summaries = summaries
    lobby.tournament = generate_tournament(
        lobby.settings.get("tournamentType") or "round_robin",
        participant_ids,
        human_ids=human_ids,
    )
    lobby.status = "SIMULATING"


def find_match(lobby, match_id: str) -> tuple[dict | None, int, int]:
    tournament = lobby.tournament or {}
    for ri, rnd in enumerate(tournament.get("rounds") or []):
        for mi, match in enumerate(rnd):
            if match.get("matchId") == match_id:
                return match, ri, mi
    return None, -1, -1


def squad_for_user(lobby, user_id: str) -> dict | None:
    draft = lobby.draft or {}
    return next(
        (s for s in draft.get("squads") or [] if s.get("userId") == user_id),
        None,
    )


def run_match_simulation(lobby, match_id: str) -> dict | None:
    match, _, _ = find_match(lobby, match_id)
    if not match or match.get("status") != "pending":
        return None

    home_id = match.get("homeUserId")
    away_id = match.get("awayUserId")
    if not home_id or not away_id:
        return None

    home_squad = squad_for_user(lobby, home_id)
    away_squad = squad_for_user(lobby, away_id)
    if not home_squad or not away_squad:
        return None

    home_player = lobby.find_player(home_id)
    away_player = lobby.find_player(away_id)
    result = simulate_match(
        match_id,
        home_id,
        away_id,
        home_squad,
        away_squad,
        home_player.get("displayName", "Home") if home_player else "Home",
        away_player.get("displayName", "Away") if away_player else "Away",
        seed=hash(match_id) & 0xFFFFFFFF,
    )

    match["status"] = "played"
    match["result"] = result
    _refresh_standings(lobby)
    return result


def _refresh_standings(lobby) -> None:
    tournament = lobby.tournament
    if not tournament:
        return

    rows: dict[str, dict] = {}
    for squad in (lobby.draft or {}).get("squads") or []:
        uid = squad.get("userId")
        if uid:
            rows[uid] = {
                "userId": uid,
                "played": 0,
                "won": 0,
                "drawn": 0,
                "lost": 0,
                "goalsFor": 0,
                "goalsAgainst": 0,
                "goalDifference": 0,
                "points": 0,
            }

    for rnd in tournament.get("rounds") or []:
        for match in rnd:
            if match.get("status") != "played" or not match.get("result"):
                continue
            res = match["result"]
            home = res.get("homeUserId")
            away = res.get("awayUserId")
            hs = int(res.get("homeScore") or 0)
            aws = int(res.get("awayScore") or 0)
            for uid, gf, ga in ((home, hs, aws), (away, aws, hs)):
                if uid not in rows:
                    continue
                row = rows[uid]
                row["played"] += 1
                row["goalsFor"] += gf
                row["goalsAgainst"] += ga
                if gf > ga:
                    row["won"] += 1
                    row["points"] += 3
                elif gf == ga:
                    row["drawn"] += 1
                    row["points"] += 1
                else:
                    row["lost"] += 1

    for row in rows.values():
        row["goalDifference"] = row["goalsFor"] - row["goalsAgainst"]

    tournament["standings"] = sorted(
        rows.values(),
        key=lambda r: (-r["points"], -r["goalDifference"], -r["goalsFor"]),
    )

    total = sum(
        1
        for rnd in tournament.get("rounds") or []
        for m in rnd
        if m.get("status") == "pending"
    )
    if total == 0:
        tournament["complete"] = True
        standings = tournament.get("standings") or []
        tournament["winnerUserId"] = standings[0]["userId"] if standings else None
        lobby.status = "FINISHED"
