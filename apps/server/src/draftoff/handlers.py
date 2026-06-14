"""Socket.IO event handlers — the realtime request/response surface.

Mirrors `packages/shared/src/socket/events.ts`. Clients REQUEST actions; the
server CONFIRMS by broadcasting authoritative state to the lobby room.
"""

from __future__ import annotations

from .realtime import room, sio
from .store import MAX_PLAYERS_PER_LOBBY, parse_settings, store


def ok(data):
    return {"ok": True, "data": data}


def err(message: str):
    return {"ok": False, "error": message}


async def _broadcast_lobby(lobby) -> None:
    await sio.emit("lobby:state", lobby.to_state(), to=room(lobby.code))


async def _broadcast_list() -> None:
    await sio.emit("lobby:list", store.summaries())


@sio.event
async def connect(sid, environ, auth=None):
    # Give the freshly connected client the current lobby browser immediately.
    await sio.emit("lobby:list", store.summaries(), to=sid)


@sio.on("lobby:list")
async def lobby_list(sid):
    return ok(store.summaries())


@sio.on("lobby:create")
async def lobby_create(sid, data):
    data = data or {}
    name = (data.get("displayName") or "").strip()
    if not name:
        return err("Display name is required")

    settings = parse_settings(data.get("settings"))
    lobby = store.create(host_name=name, settings=settings)

    await sio.enter_room(sid, room(lobby.code))
    await _broadcast_lobby(lobby)
    await _broadcast_list()
    return ok(
        {"code": lobby.code, "userId": lobby.host_id, "state": lobby.to_state()}
    )


@sio.on("lobby:join")
async def lobby_join(sid, data):
    data = data or {}
    code = (data.get("code") or "").upper()
    name = (data.get("displayName") or "").strip()

    lobby = store.get(code)
    if not lobby:
        return err("Lobby not found")
    if lobby.status != "LOBBY":
        return err("This draft has already started")
    if len(lobby.players) >= MAX_PLAYERS_PER_LOBBY:
        return err("Lobby is full")
    if not name:
        return err("Display name is required")

    user_id = lobby.add_player(name)
    await sio.enter_room(sid, room(code))
    await _broadcast_lobby(lobby)
    await _broadcast_list()
    return ok({"userId": user_id, "state": lobby.to_state()})


@sio.on("lobby:sync")
async def lobby_sync(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    await sio.enter_room(sid, room(lobby.code))
    return ok(lobby.to_state())


@sio.on("lobby:start")
async def lobby_start(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    if lobby.status != "LOBBY":
        return err("Draft already started")
    if len(lobby.players) < 1:
        return err("Need at least one player to start")

    lobby.start()
    await _broadcast_lobby(lobby)
    await sio.emit("draft:state", lobby.draft, to=room(lobby.code))
    await _broadcast_list()
    return ok(None)


@sio.on("draft:sync")
async def draft_sync(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby or not lobby.draft:
        return err("Draft has not started yet")
    await sio.enter_room(sid, room(lobby.code))
    return ok(lobby.draft)
