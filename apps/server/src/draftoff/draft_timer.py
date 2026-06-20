"""Per-lobby asyncio timer: pre-draft 3-2-1 countdown + per-pick countdown."""

from __future__ import annotations

import asyncio

from .draft_engine import apply_pick, generate_turn_offer, try_auto_pick
from .realtime import room, sio
from .store import store


class DraftTimerManager:
    def __init__(self) -> None:
        self._tasks: dict[str, asyncio.Task] = {}

    def ensure_running(self, code: str) -> None:
        code = code.upper()
        task = self._tasks.get(code)
        if task is not None and not task.done():
            return
        self._tasks[code] = asyncio.create_task(self._loop(code))

    def stop(self, code: str) -> None:
        code = code.upper()
        task = self._tasks.pop(code, None)
        if task is not None and not task.done():
            task.cancel()

    async def _loop(self, code: str) -> None:
        try:
            while True:
                await asyncio.sleep(1)
                lobby = store.get(code)
                if not lobby or lobby.status != "DRAFTING" or not lobby.draft:
                    break

                draft = lobby.draft
                if draft.get("complete"):
                    break

                settings = lobby.settings
                start_countdown = draft.get("startCountdown")

                if isinstance(start_countdown, int) and start_countdown > 0:
                    next_count = start_countdown - 1
                    if next_count <= 0:
                        draft["startCountdown"] = None
                        draft["turnOffer"] = generate_turn_offer(
                            settings, draft, lobby_players=lobby.players
                        )
                        draft["timeRemaining"] = int(
                            settings.get("draftTimerSeconds", 15)
                        )
                        draft["rerollsRemaining"] = int(
                            settings.get("rerollsPerPick", 1)
                        )
                        draft["pickTimerActive"] = False
                        await sio.emit("draft:state", draft, to=room(code))
                    else:
                        draft["startCountdown"] = next_count
                        await sio.emit(
                            "draft:tick",
                            {"timeRemaining": 0, "startCountdown": next_count},
                            to=room(code),
                        )
                    continue

                if not draft.get("activeUserId") or not draft.get("turnOffer"):
                    continue

                if not draft.get("pickTimerActive"):
                    continue

                remaining = int(draft.get("timeRemaining") or 0)
                if remaining <= 1:
                    result, err = try_auto_pick(settings, draft, lobby.players)
                    if result is not None:
                        lobby.draft = result
                        await sio.emit("draft:state", lobby.draft, to=room(code))
                        if lobby.draft.get("complete"):
                            break
                    elif err:
                        draft["turnOffer"] = generate_turn_offer(
                            settings, draft, lobby_players=lobby.players
                        )
                        draft["timeRemaining"] = int(
                            settings.get("draftTimerSeconds", 15)
                        )
                        draft["pickTimerActive"] = False
                        await sio.emit("draft:state", draft, to=room(code))
                else:
                    draft["timeRemaining"] = remaining - 1
                    await sio.emit(
                        "draft:tick",
                        {"timeRemaining": draft["timeRemaining"]},
                        to=room(code),
                    )
        finally:
            self._tasks.pop(code.upper(), None)


timers = DraftTimerManager()
