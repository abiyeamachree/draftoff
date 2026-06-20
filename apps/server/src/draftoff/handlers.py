"""Socket.IO event handlers — the realtime request/response surface.

Mirrors `packages/shared/src/socket/events.ts`. Clients REQUEST actions; the
server CONFIRMS by broadcasting authoritative state to the lobby room.
"""

from __future__ import annotations

from .draft_engine import apply_pick, generate_turn_offer
from .draft_timer import timers
from .realtime import room, sio
from .session_tracker import sessions
from .store import MAX_PLAYERS_PER_LOBBY, is_valid_name, parse_settings, store

NAME_RULE_ERROR = "Display name can only use letters, numbers and ! . £ $"


def ok(data):
    return {"ok": True, "data": data}


def err(message: str):
    return {"ok": False, "error": message}


async def _broadcast_lobby(lobby) -> None:
    await sio.emit("lobby:state", lobby.to_state(), to=room(lobby.code))


async def _broadcast_list() -> None:
    await sio.emit("lobby:list", store.summaries())


def _bind_session(sid: str, code: str) -> None:
    sessions.bind(sid, code)


async def _remove_if_abandoned(code: str) -> None:
    if not sessions.is_empty(code):
        return
    lobby = store.get(code)
    if not lobby:
        return
    timers.stop(code)
    store.remove(code)
    await _broadcast_list()


async def _on_session_left(code: str | None) -> None:
    if not code:
        return
    if sessions.is_empty(code):
        sessions.schedule_cleanup(code, _remove_if_abandoned)


@sio.event
async def connect(sid, environ, auth=None):
    # Give the freshly connected client the current lobby browser immediately.
    await sio.emit("lobby:list", store.summaries(), to=sid)


@sio.event
async def disconnect(sid):
    code = sessions.unbind(sid)
    await _on_session_left(code)


@sio.on("lobby:list")
async def lobby_list(sid):
    return ok(store.summaries())


@sio.on("lobby:create")
async def lobby_create(sid, data):
    data = data or {}
    name = (data.get("displayName") or "").strip()
    if not name:
        return err("Display name is required")
    if not is_valid_name(name):
        return err(NAME_RULE_ERROR)

    settings = parse_settings(data.get("settings"))
    lobby = store.create(host_name=name, settings=settings)

    await sio.enter_room(sid, room(lobby.code))
    _bind_session(sid, lobby.code)
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
    if not is_valid_name(name):
        return err(NAME_RULE_ERROR)

    user_id = lobby.add_player(name)
    await sio.enter_room(sid, room(code))
    _bind_session(sid, code)
    await _broadcast_lobby(lobby)
    await _broadcast_list()
    return ok({"userId": user_id, "state": lobby.to_state()})


@sio.on("lobby:customise")
async def lobby_customise(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    user_id = data.get("userId") or ""
    player, customise_err = lobby.update_player(
        user_id,
        icon=data.get("icon"),
        display_name=data.get("displayName"),
        formation=data.get("formation"),
    )
    if customise_err:
        return err(customise_err)
    if not player:
        return err("You are not in this lobby")
    await _broadcast_lobby(lobby)
    await _broadcast_list()
    return ok(lobby.to_state())


@sio.on("chat:send")
async def chat_send(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    message = lobby.chat_message(data.get("userId") or "", data.get("text") or "")
    if not message:
        return err("Could not send message")
    await sio.emit("chat:message", message, to=room(lobby.code))
    return ok(None)


@sio.on("lobby:sync")
async def lobby_sync(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    await sio.enter_room(sid, room(lobby.code))
    _bind_session(sid, lobby.code)
    return ok(lobby.to_state())


@sio.on("lobby:leave")
async def lobby_leave(sid, data):
    data = data or {}
    code = (data.get("code") or "").upper()
    if code:
        await sio.leave_room(sid, room(code))
    sessions.unbind(sid)
    await _on_session_left(code)
    return ok(None)


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
    if lobby.draft:
        lobby.draft["startCountdown"] = 3
        lobby.draft["timeRemaining"] = 0
        lobby.draft["turnOffer"] = None
    await _broadcast_lobby(lobby)
    await sio.emit("draft:state", lobby.draft, to=room(lobby.code))
    timers.ensure_running(lobby.code)
    await _broadcast_list()
    return ok(None)


@sio.on("draft:pick")
async def draft_pick(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby or not lobby.draft:
        return err("Draft has not started")
    if lobby.draft.get("activeUserId") != data.get("userId"):
        return err("Not your turn")

    draft, pick_err = apply_pick(
        lobby.settings,
        lobby.draft,
        int(data.get("playerId")),
        str(data.get("edition") or ""),
        int(data.get("slotIndex")),
        lobby_players=lobby.players,
    )
    if pick_err:
        return err(pick_err)
    lobby.draft = draft
    timers.ensure_running(lobby.code)
    await sio.emit("draft:state", lobby.draft, to=room(lobby.code))
    return ok(None)


@sio.on("draft:cycle")
async def draft_cycle(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby or not lobby.draft:
        return err("Draft has not started")
    if lobby.draft.get("activeUserId") != data.get("userId"):
        return err("Not your turn")

    remaining = int(lobby.draft.get("rerollsRemaining") or 0)
    if remaining <= 0:
        return err("No re-rolls remaining")

    lobby.draft["rerollsRemaining"] = remaining - 1
    lobby.draft["turnOffer"] = generate_turn_offer(
        lobby.settings, lobby.draft, lobby_players=lobby.players
    )
    lobby.draft["timeRemaining"] = int(lobby.settings.get("draftTimerSeconds", 15))
    lobby.draft["pickTimerActive"] = False
    timers.ensure_running(lobby.code)
    await sio.emit("draft:state", lobby.draft, to=room(lobby.code))
    return ok(None)


@sio.on("draft:pickReady")
async def draft_pick_ready(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby or not lobby.draft:
        return err("Draft has not started")
    if lobby.draft.get("activeUserId") != data.get("userId"):
        return err("Not your turn")
    if lobby.draft.get("pickTimerActive"):
        return ok(None)

    lobby.draft["pickTimerActive"] = True
    await sio.emit("draft:state", lobby.draft, to=room(lobby.code))
    return ok(None)


@sio.on("draft:sync")
async def draft_sync(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby or not lobby.draft:
        return err("Draft has not started yet")
    await sio.enter_room(sid, room(lobby.code))
    _bind_session(sid, lobby.code)
    if lobby.draft and not lobby.draft.get("complete"):
        timers.ensure_running(lobby.code)
    return ok(lobby.draft)
