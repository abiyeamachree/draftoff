"""Load player pool from SoFIFA CSV into SQLite/Postgres."""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

from sqlalchemy import delete, select

from .db.models import Player, TeamEntry, TeamTag
from .db.session import get_engine, get_session, init_db
from .editions import EDITION_TO_SEASON, PICKER_EDITIONS
from .team_match import resolve_team_name

DATA_DIR = Path(__file__).resolve().parent / "data"
COMPETITIONS_FILE = DATA_DIR / "competitions.json"
DEFAULT_CSV = Path(__file__).resolve().parents[4] / "sofifa_all_players.csv"

BATCH = 4000


def _int(val: str | None, default: int = 0) -> int:
    try:
        return int(float(val or default))
    except (TypeError, ValueError):
        return default


def _load_competitions() -> dict[str, dict[str, list[str]]]:
    if not COMPETITIONS_FILE.exists():
        return {}
    return json.loads(COMPETITIONS_FILE.read_text(encoding="utf-8"))


def _detect_promotions(
    teams_by_ed_league: dict[tuple[str, str], set[str]],
) -> list[tuple[str, str, str]]:
    """Compare consecutive picker editions per league; tag promoted/relegated."""
    tags: list[tuple[str, str, str]] = []
    ordered = [e for e in PICKER_EDITIONS if e in {ed for ed, _ in teams_by_ed_league}]
    for i in range(len(ordered) - 1):
        newer, older = ordered[i], ordered[i + 1]
        leagues = set()
        for ed, lg in teams_by_ed_league:
            if ed in (newer, older):
                leagues.add(lg)
        for league in leagues:
            if not league:
                continue
            new_teams = teams_by_ed_league.get((newer, league), set())
            old_teams = teams_by_ed_league.get((older, league), set())
            for t in new_teams - old_teams:
                tags.append((newer, t, "promoted"))
            for t in old_teams - new_teams:
                tags.append((older, t, "relegated"))
    return tags


def seed(csv_path: Path | None = None, truncate: bool = True) -> None:
    path = csv_path or Path(
        __import__("os").environ.get("SEED_CSV_PATH", str(DEFAULT_CSV))
    )
    if not path.exists():
        print(f"CSV not found: {path}", file=sys.stderr)
        sys.exit(1)

    init_db()
    get_engine()

    if truncate:
        with get_session() as session:
            session.execute(delete(TeamTag))
            session.execute(delete(TeamEntry))
            session.execute(delete(Player))
            session.commit()

    teams_seen: dict[tuple[str, str], set[str]] = defaultdict(set)
    team_rows: dict[tuple[str, str, str], tuple[str, str]] = {}
    batch: list[Player] = []
    seen: set[tuple[int, str]] = set()
    total = 0

    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        with get_session() as session:
            for row in reader:
                edition = (row.get("edition") or "").strip()
                if edition not in EDITION_TO_SEASON:
                    continue
                pid = _int(row.get("player_id"))
                key = (pid, edition)
                if key in seen:
                    continue
                seen.add(key)
                team = (row.get("team") or "").strip()
                league = (row.get("league") or "").strip()
                if team and league:
                    teams_seen[(edition, league)].add(team)
                    team_rows[(edition, team, league)] = (
                        row.get("team_id") or "",
                        league,
                    )

                batch.append(
                    Player(
                        player_id=pid,
                        edition=edition,
                        name=(row.get("name") or "").strip() or "Unknown",
                        overall=_int(row.get("overall")),
                        best_position=(row.get("best_position") or "CM").strip()[:8],
                        positions=(row.get("positions") or "")[:64],
                        nation=(row.get("nation") or "").strip()[:64],
                        team=team[:128],
                        team_id=(row.get("team_id") or "").strip()[:16],
                        league=league[:128],
                        age=_int(row.get("age")),
                        pace=_int(row.get("pace")),
                        shooting=_int(row.get("shooting")),
                        passing=_int(row.get("passing")),
                        dribbling=_int(row.get("dribbling")),
                        defending=_int(row.get("defending")),
                        physical=_int(row.get("physical")),
                    )
                )
                if len(batch) >= BATCH:
                    session.add_all(batch)
                    session.commit()
                    total += len(batch)
                    batch.clear()
                    print(f"  …{total:,} players", end="\r")

            if batch:
                session.add_all(batch)
                session.commit()
                total += len(batch)

    print(f"\nSeeded {total:,} player rows.")

    with get_session() as session:
        for (edition, team, league), (team_id, _) in team_rows.items():
            session.merge(
                TeamEntry(edition=edition, team=team, team_id=team_id, league=league)
            )
        session.commit()

        teams_by_edition: dict[str, set[str]] = defaultdict(set)
        for (edition, _league, team) in team_rows:
            teams_by_edition[edition].add(team)

        competitions = _load_competitions()
        tag_seen: set[tuple[str, str, str]] = set()
        tag_count = 0
        for edition, comps in competitions.items():
            available = teams_by_edition.get(edition, set())
            for tag, team_list in comps.items():
                for raw in dict.fromkeys(team_list):
                    team = resolve_team_name(raw, available) or raw
                    if team not in available:
                        continue
                    key = (edition, team, tag)
                    if key in tag_seen:
                        continue
                    tag_seen.add(key)
                    session.merge(TeamTag(edition=edition, team=team, tag=tag))
                    tag_count += 1

        for edition, team, tag in _detect_promotions(teams_seen):
            key = (edition, team, tag)
            if key in tag_seen:
                continue
            tag_seen.add(key)
            session.merge(TeamTag(edition=edition, team=team, tag=tag))
            tag_count += 1

        session.commit()
        team_n = session.scalar(select(TeamEntry.id).limit(1))
        print(f"Teams + {tag_count} competition/promotion tags indexed.")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Seed DraftOff DB from SoFIFA CSV")
    parser.add_argument("--csv", type=Path, default=None)
    parser.add_argument("--no-truncate", action="store_true")
    args = parser.parse_args()
    seed(csv_path=args.csv, truncate=not args.no_truncate)


if __name__ == "__main__":
    main()
