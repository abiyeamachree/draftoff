"""ASGI entrypoint: FastAPI (HTTP) + Socket.IO mounted together."""

from __future__ import annotations

import socketio
from fastapi import FastAPI

from .realtime import sio

# Importing handlers registers the @sio event handlers as a side effect.
from . import handlers  # noqa: E402,F401

api = FastAPI(title="DraftOff server")


@api.get("/")
async def health():
    return {"status": "ok", "service": "draftoff-server"}


# Socket.IO uses the default path "/socket.io"; everything else falls through to FastAPI.
asgi = socketio.ASGIApp(sio, other_asgi_app=api)
