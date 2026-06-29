"""Socket.IO event handlers — the realtime request/response surface.

Mirrors `packages/shared/src/socket/events.ts`. Clients REQUEST actions; the
server CONFIRMS by broadcasting authoritative state to the lobby room.
"""

from __future__ import annotations

from .draft_engine import apply_pick, generate_turn_offer
from .draft_timer import timers
from .post_draft import finalize_draft, run_match_simulation
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


async def _maybe_finalize_draft(lobby) -> None:
    if not lobby.draft or not lobby.draft.get("complete"):
        return
    if lobby.tournament is not None:
        return
    finalize_draft(lobby)
    timers.stop(lobby.code)
    await sio.emit("tournament:state", lobby.tournament, to=room(lobby.code))
    await _broadcast_lobby(lobby)
    await _broadcast_list()


def _bind_session(sid: str, code: str, user_id: str | None = None) -> None:
    sessions.bind(sid, code, user_id)


async def _emit_system_chat(lobby, text: str, *, label: str = "Settings") -> None:
    message = lobby.system_chat(text, label=label)
    await sio.emit("chat:message", message, to=room(lobby.code))


def _require_host(lobby, user_id: str) -> str | None:
    if not user_id or user_id != lobby.host_id:
        return "Only the host can do that"
    return None


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
    _bind_session(sid, lobby.code, lobby.host_id)
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
    _bind_session(sid, code, user_id)
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
    user_id = data.get("userId") or sessions.user_id_for_sid(sid)
    await sio.enter_room(sid, room(lobby.code))
    _bind_session(sid, lobby.code, user_id)
    return ok(lobby.to_state())


@sio.on("lobby:leave")
async def lobby_leave(sid, data):
    data = data or {}
    code = (data.get("code") or "").upper()
    user_id = data.get("userId") or sessions.user_id_for_sid(sid)
    lobby = store.get(code) if code else None
    if lobby and user_id and data.get("quit"):
        player = lobby.find_player(user_id)
        if player and not player.get("isHost") and lobby.status == "LOBBY":
            lobby.remove_player(user_id)
            await _broadcast_lobby(lobby)
            await _broadcast_list()
    if code:
        await sio.leave_room(sid, room(code))
    sessions.unbind(sid)
    await _on_session_left(code)
    return ok(None)


@sio.on("lobby:updateSettings")
async def lobby_update_settings(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    user_id = data.get("userId") or ""
    host_err = _require_host(lobby, user_id)
    if host_err:
        return err(host_err)
    if lobby.status != "LOBBY":
        return err("Return to lobby settings first")

    patch = data.get("settings")
    if not isinstance(patch, dict):
        return err("Invalid settings")
    changes = lobby.update_settings(patch)
    await _broadcast_lobby(lobby)
    await _broadcast_list()
    for change in changes:
        await _emit_system_chat(lobby, f"Host changed {change}")
    return ok(lobby.to_state())


@sio.on("lobby:reopen")
async def lobby_reopen(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    user_id = data.get("userId") or ""
    host_err = _require_host(lobby, user_id)
    if host_err:
        return err(host_err)

    timers.stop(lobby.code)
    lobby.reopen()
    await _broadcast_lobby(lobby)
    await _emit_system_chat(lobby, "Host returned to settings — game reset")
    await _broadcast_list()
    return ok(lobby.to_state())


@sio.on("lobby:kick")
async def lobby_kick(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    user_id = data.get("userId") or ""
    host_err = _require_host(lobby, user_id)
    if host_err:
        return err(host_err)
    target = data.get("targetUserId") or ""
    if not target:
        return err("Player required")
    if target == lobby.host_id:
        return err("Cannot kick yourself")
    if lobby.status != "LOBBY":
        return err("Return to lobby settings to remove players")
    if not lobby.find_player(target):
        return err("Player not found")

    lobby.remove_player(target)
    for kick_sid in sessions.sids_for_user(lobby.code, target):
        await sio.emit(
            "lobby:kicked",
            {"message": "You were removed from the lobby by the host"},
            to=kick_sid,
        )
        await sio.leave_room(kick_sid, room(lobby.code))
        sessions.unbind(kick_sid)
    await _broadcast_lobby(lobby)
    await _broadcast_list()
    return ok(None)


@sio.on("lobby:end")
async def lobby_end(sid, data):
    data = data or {}
    code = (data.get("code") or "").upper()
    lobby = store.get(code)
    if not lobby:
        return err("Lobby not found")
    user_id = data.get("userId") or ""
    host_err = _require_host(lobby, user_id)
    if host_err:
        return err(host_err)

    await sio.emit(
        "lobby:ended",
        {"message": "The host ended this game"},
        to=room(code),
    )
    timers.stop(code)
    store.remove(code)
    await _broadcast_list()
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
    if draft.get("complete"):
        await _maybe_finalize_draft(lobby)
    else:
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
    user_id = data.get("userId") or sessions.user_id_for_sid(sid)
    await sio.enter_room(sid, room(lobby.code))
    _bind_session(sid, lobby.code, user_id)
    if lobby.draft and not lobby.draft.get("complete"):
        timers.ensure_running(lobby.code)
    elif lobby.draft and lobby.draft.get("complete"):
        await _maybe_finalize_draft(lobby)
    return ok(lobby.draft)


@sio.on("sim:runMatch")
async def sim_run_match(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    if not lobby.tournament:
        return err("Tournament has not started")
    user_id = data.get("userId") or ""
    if user_id != lobby.host_id:
        return err("Only the host can simulate matches")
    match_id = data.get("matchId") or ""
    if not match_id:
        return err("Match id required")

    result = run_match_simulation(lobby, match_id)
    if not result:
        return err("Could not simulate match")

    await sio.emit("sim:matchResult", result, to=room(lobby.code))
    await sio.emit("tournament:state", lobby.tournament, to=room(lobby.code))
    await _broadcast_lobby(lobby)
    if lobby.status == "FINISHED":
        await _broadcast_list()
    return ok(result)


@sio.on("sim:quickSync")
async def sim_quick_sync(sid, data):
    data = data or {}
    lobby = store.get((data.get("code") or "").upper())
    if not lobby:
        return err("Lobby not found")
    user_id = data.get("userId") or ""
    if user_id != lobby.host_id:
        return err("Only the host can control simulation")

    action = data.get("action")
    if action not in {"start", "stop", "pause", "match", "watch"}:
        return err("Invalid quick sync action")

    payload = {k: v for k, v in data.items() if k not in ("code", "userId")}
    await sio.emit("sim:quickSync", payload, to=room(lobby.code), skip_sid=sid)
    return ok(None)


from . import draft_timer as _draft_timer_module

_draft_timer_module.set_finalize_hook(_maybe_finalize_draft)
