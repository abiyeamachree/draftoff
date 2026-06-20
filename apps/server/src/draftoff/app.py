"""ASGI entrypoint: FastAPI (HTTP) + Socket.IO mounted together."""

from __future__ import annotations

import socketio
from fastapi import FastAPI

from .realtime import sio

# Importing handlers registers the @sio event handlers as a side effect.
from . import handlers  # noqa: E402,F401
from .catalog_routes import router as catalog_router
from .db import init_db, player_count

api = FastAPI(title="DraftOff server")
api.include_router(catalog_router)


@api.on_event("startup")
async def startup():
    init_db()
    n = player_count()
    if n == 0:
        print(
            "[draftoff] DB empty — run: python -m draftoff.seed "
            "(from apps/server with SEED_CSV_PATH set)"
        )
    else:
        print(f"[draftoff] Player pool loaded: {n:,} rows")


@api.get("/")
async def health():
    return {"status": "ok", "service": "draftoff-server"}


# Socket.IO uses the default path "/socket.io"; everything else falls through to FastAPI.
asgi = socketio.ASGIApp(sio, other_asgi_app=api)
