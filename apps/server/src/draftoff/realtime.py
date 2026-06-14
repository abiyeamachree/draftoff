"""Socket.IO server instance, shared by the app and the event handlers."""

from __future__ import annotations

import os

import socketio

# Dev: allow the Next.js origin (and anything, since we don't use cookies/credentials).
_cors = os.environ.get("CORS_ORIGIN", "*")
cors_allowed_origins = "*" if _cors == "*" else [o.strip() for o in _cors.split(",")]

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=cors_allowed_origins,
)


def room(code: str) -> str:
    return f"lobby:{code}"
