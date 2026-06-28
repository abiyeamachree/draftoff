"""Track socket sessions per lobby for empty-room cleanup and targeted emits."""

from __future__ import annotations

import asyncio
from collections import defaultdict

DELETION_GRACE_SECONDS = 4


class SessionTracker:
    def __init__(self) -> None:
        self._sid_to_code: dict[str, str] = {}
        self._sid_to_user: dict[str, str] = {}
        self._code_sids: dict[str, set[str]] = defaultdict(set)
        self._pending_deletion: dict[str, asyncio.Task] = {}

    def bind(self, sid: str, code: str, user_id: str | None = None) -> None:
        code = code.upper()
        self.cancel_cleanup(code)
        old = self._sid_to_code.get(sid)
        if old and old != code:
            self._code_sids[old].discard(sid)
        self._sid_to_code[sid] = code
        self._code_sids[code].add(sid)
        if user_id:
            self._sid_to_user[sid] = user_id

    def unbind(self, sid: str) -> str | None:
        code = self._sid_to_code.pop(sid, None)
        self._sid_to_user.pop(sid, None)
        if code:
            self._code_sids[code].discard(sid)
            if not self._code_sids[code]:
                del self._code_sids[code]
        return code

    def user_id_for_sid(self, sid: str) -> str | None:
        return self._sid_to_user.get(sid)

    def sids_for_user(self, code: str, user_id: str) -> list[str]:
        code = code.upper()
        return [
            sid
            for sid in self._code_sids.get(code, set())
            if self._sid_to_user.get(sid) == user_id
        ]

    def is_empty(self, code: str) -> bool:
        return len(self._code_sids.get(code.upper(), set())) == 0

    def cancel_cleanup(self, code: str) -> None:
        code = code.upper()
        task = self._pending_deletion.pop(code, None)
        if task is not None and not task.done():
            task.cancel()

    def schedule_cleanup(self, code: str, callback) -> None:
        code = code.upper()
        self.cancel_cleanup(code)

        async def _wait() -> None:
            try:
                await asyncio.sleep(DELETION_GRACE_SECONDS)
                if self.is_empty(code):
                    await callback(code)
            finally:
                self._pending_deletion.pop(code, None)

        self._pending_deletion[code] = asyncio.create_task(_wait())


sessions = SessionTracker()
