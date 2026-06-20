"""Database engine + session factory."""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

_DEFAULT_PATH = Path(__file__).resolve().parents[3] / "data" / "draftoff.db"
DEFAULT_URL = f"sqlite:///{_DEFAULT_PATH.as_posix()}"


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_URL)


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite:")


_engine = None
SessionLocal: sessionmaker[Session] | None = None


def get_engine():
    global _engine, SessionLocal
    if _engine is None:
        url = database_url()
        connect_args = {"check_same_thread": False} if _is_sqlite(url) else {}
        _engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
        if _is_sqlite(url):
            @event.listens_for(_engine, "connect")
            def _sqlite_pragma(dbapi_conn, _):
                cursor = dbapi_conn.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")
                cursor.close()

        SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine


def init_db() -> None:
    if _is_sqlite(database_url()):
        _DEFAULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(get_engine())


def get_session() -> Session:
    get_engine()
    assert SessionLocal is not None
    return SessionLocal()


def player_count() -> int:
    with get_session() as session:
        row = session.execute(text("SELECT COUNT(*) FROM players")).scalar()
        return int(row or 0)
