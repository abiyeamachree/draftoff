"""In-memory authoritative store of lobbies and their live state.

Single-process, single source of truth during gameplay. Persistence to Postgres
is layered on later (PLAN.md §2.2); none of the realtime hot path touches a DB.
"""

from __future__ import annotations

import random
import string
import uuid

from .draft import build_draft_state

MAX_PLAYERS_PER_LOBBY = 20

ALLOWED_TEAM_SIZES = {5, 7, 8, 11}
ALLOWED_TOURNAMENTS = {"knockout", "round_robin"}

DEFAULT_SETTINGS: dict = {
    "teamSize": 5,
    "draftTimerSeconds": 30,
    "tournamentType": "knockout",
    "peakCardsEnabled": True,
}

# Unambiguous alphabet for join codes (no O/0/I/1).
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_user_id() -> str:
    return "u_" + uuid.uuid4().hex[:12]


def parse_settings(raw: dict | None) -> dict:
    """Coerce a (possibly partial, possibly hostile) settings dict to a valid one."""
    settings = dict(DEFAULT_SETTINGS)
    if not isinstance(raw, dict):
        return settings

    team_size = raw.get("teamSize")
    if isinstance(team_size, int) and team_size in ALLOWED_TEAM_SIZES:
        settings["teamSize"] = team_size

    timer = raw.get("draftTimerSeconds")
    if isinstance(timer, int) and 5 <= timer <= 300:
        settings["draftTimerSeconds"] = timer

    tournament = raw.get("tournamentType")
    if tournament in ALLOWED_TOURNAMENTS:
        settings["tournamentType"] = tournament

    if isinstance(raw.get("peakCardsEnabled"), bool):
        settings["peakCardsEnabled"] = raw["peakCardsEnabled"]

    return settings


class Lobby:
    def __init__(self, code: str, host_name: str, settings: dict):
        self.code = code
        self.status = "LOBBY"
        self.settings = settings
        self.players: list[dict] = []
        self.draft: dict | None = None
        self.host_id = self.add_player(host_name, is_host=True)

    def add_player(self, display_name: str, is_host: bool = False) -> str:
        user_id = _new_user_id()
        self.players.append(
            {
                "userId": user_id,
                "displayName": display_name,
                "isHost": is_host,
                "isReady": is_host,
                "draftSlot": None,
                "connection": "connected",
            }
        )
        return user_id

    def start(self) -> None:
        for slot, player in enumerate(self.players):
            player["draftSlot"] = slot
        self.status = "DRAFTING"
        self.draft = build_draft_state(self.players, self.settings)

    def to_state(self) -> dict:
        return {
            "code": self.code,
            "status": self.status,
            "hostId": self.host_id,
            "settings": self.settings,
            "players": self.players,
        }

    def to_summary(self) -> dict:
        host = next((p for p in self.players if p["isHost"]), None)
        return {
            "code": self.code,
            "hostName": host["displayName"] if host else "—",
            "playerCount": len(self.players),
            "maxPlayers": MAX_PLAYERS_PER_LOBBY,
            "status": self.status,
            "teamSize": self.settings["teamSize"],
            "tournamentType": self.settings["tournamentType"],
        }


class LobbyStore:
    def __init__(self) -> None:
        self._lobbies: dict[str, Lobby] = {}

    def _new_code(self) -> str:
        while True:
            code = "".join(random.choices(_CODE_ALPHABET, k=6))
            if code not in self._lobbies:
                return code

    def create(self, host_name: str, settings: dict) -> Lobby:
        lobby = Lobby(self._new_code(), host_name, settings)
        self._lobbies[lobby.code] = lobby
        return lobby

    def get(self, code: str) -> Lobby | None:
        return self._lobbies.get((code or "").upper())

    def remove(self, code: str) -> None:
        self._lobbies.pop((code or "").upper(), None)

    def summaries(self) -> list[dict]:
        # Newest first; only show lobbies that are still joinable or in progress.
        return [lobby.to_summary() for lobby in reversed(list(self._lobbies.values()))]


store = LobbyStore()
