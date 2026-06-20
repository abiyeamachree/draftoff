"""SQLAlchemy models — SQLite locally, Postgres in production (same schema)."""

from __future__ import annotations

from sqlalchemy import Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, nullable=False)
    edition: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    overall: Mapped[int] = mapped_column(Integer, nullable=False)
    best_position: Mapped[str] = mapped_column(String(8), nullable=False)
    positions: Mapped[str] = mapped_column(String(64), default="")
    nation: Mapped[str] = mapped_column(String(64), default="")
    team: Mapped[str] = mapped_column(String(128), default="")
    team_id: Mapped[str] = mapped_column(String(16), default="")
    league: Mapped[str] = mapped_column(String(128), default="")
    age: Mapped[int] = mapped_column(Integer, default=0)
    pace: Mapped[int] = mapped_column(Integer, default=0)
    shooting: Mapped[int] = mapped_column(Integer, default=0)
    passing: Mapped[int] = mapped_column(Integer, default=0)
    dribbling: Mapped[int] = mapped_column(Integer, default=0)
    defending: Mapped[int] = mapped_column(Integer, default=0)
    physical: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("player_id", "edition", name="uq_player_edition"),
        Index("ix_players_edition_team", "edition", "team"),
        Index("ix_players_edition_league", "edition", "league"),
        Index("ix_players_edition_nation", "edition", "nation"),
        Index("ix_players_edition_position", "edition", "best_position"),
    )


class TeamEntry(Base):
    """Distinct club in an edition (derived from player rows)."""

    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    edition: Mapped[str] = mapped_column(String(32), nullable=False)
    team: Mapped[str] = mapped_column(String(128), nullable=False)
    team_id: Mapped[str] = mapped_column(String(16), default="")
    league: Mapped[str] = mapped_column(String(128), default="")

    __table_args__ = (
        UniqueConstraint("edition", "team", name="uq_team_edition"),
        Index("ix_teams_edition_league", "edition", "league"),
    )


class TeamTag(Base):
    __tablename__ = "team_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    edition: Mapped[str] = mapped_column(String(32), nullable=False)
    team: Mapped[str] = mapped_column(String(128), nullable=False)
    tag: Mapped[str] = mapped_column(String(16), nullable=False)

    __table_args__ = (
        UniqueConstraint("edition", "team", "tag", name="uq_team_tag"),
        Index("ix_team_tags_edition_tag", "edition", "tag"),
    )
