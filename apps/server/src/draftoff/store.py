"""In-memory authoritative store of lobbies and their live state.

Single-process, single source of truth during gameplay. Persistence to Postgres
is layered on later (PLAN.md §2.2); none of the realtime hot path touches a DB.
"""

from __future__ import annotations

import random
import re
import uuid

from .draft import build_draft_state

MAX_PLAYERS_PER_LOBBY = 20
NAME_MAX_LENGTH = 24

# Display names: letters, numbers and ! . £ $ only. No spaces.
_NAME_RE = re.compile(r"^[A-Za-z0-9!.£$]+$")


def is_valid_name(name: str) -> bool:
    return len(name) <= NAME_MAX_LENGTH and bool(_NAME_RE.match(name))

ALLOWED_TEAM_SIZES = {5, 8, 11}
ALLOWED_TOURNAMENTS = {
    "round_robin",
    "double_round_robin",
    "knockout",
    "groups_knockout",
    "best_of",
}
ALLOWED_DRAFT_TYPES = {"snake", "linear", "pack"}
ALLOWED_VISIBILITY = {"public", "private"}
ALLOWED_POOL_LOGIC = {"OR", "AND"}
POOL_KEYS = ("leagues", "seasons", "nations", "clubs")
CAP_KEYS = ("maxPerClub", "maxPerNation", "maxPerLeague")
BOOL_KEYS = (
    "peakCardsEnabled",
    "hideRatings",
    "chatEnabled",
    "draftBoardEnabled",
    "fillWithBots",
)

MIN_TIMER = 5
MAX_TIMER = 30
MIN_PLAYERS = 2
MAX_PLAYERS = 20
MAX_CAP = 50


def _empty_filter() -> dict:
    return {key: [] for key in POOL_KEYS}


def _empty_pool() -> dict:
    return {"include": _empty_filter(), "exclude": _empty_filter(), "logic": "OR"}


def _clean_filter(raw: object) -> dict:
    out = _empty_filter()
    if not isinstance(raw, dict):
        return out
    for key in POOL_KEYS:
        values = raw.get(key)
        if isinstance(values, list):
            cleaned: list[str] = []
            for v in values:
                if isinstance(v, str) and v.strip():
                    value = v.strip()[:64]
                    if value not in cleaned:
                        cleaned.append(value)
            out[key] = cleaned[:200]
    return out


DEFAULT_SETTINGS: dict = {
    "numPlayers": 4,
    "teamSize": 11,
    "tournamentType": "knockout",
    "draftType": "snake",
    "draftTimerSeconds": 30,
    "visibility": "public",
    "peakCardsEnabled": True,
    "maxPerClub": 0,
    "maxPerNation": 0,
    "maxPerLeague": 0,
    "hideRatings": False,
    "chatEnabled": True,
    "draftBoardEnabled": True,
    "fillWithBots": False,
}

# Unambiguous alphabet for join codes (no O/0/I/1).
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_user_id() -> str:
    return "u_" + uuid.uuid4().hex[:12]


def parse_settings(raw: dict | None) -> dict:
    """Coerce a (possibly partial, possibly hostile) settings dict to a valid one."""
    settings = dict(DEFAULT_SETTINGS)
    settings["pool"] = _empty_pool()
    if not isinstance(raw, dict):
        return settings

    num_players = raw.get("numPlayers")
    if isinstance(num_players, int) and MIN_PLAYERS <= num_players <= MAX_PLAYERS:
        settings["numPlayers"] = num_players

    team_size = raw.get("teamSize")
    if isinstance(team_size, int) and team_size in ALLOWED_TEAM_SIZES:
        settings["teamSize"] = team_size

    timer = raw.get("draftTimerSeconds")
    if isinstance(timer, int) and MIN_TIMER <= timer <= MAX_TIMER:
        settings["draftTimerSeconds"] = timer

    tournament = raw.get("tournamentType")
    if tournament in ALLOWED_TOURNAMENTS:
        settings["tournamentType"] = tournament

    draft_type = raw.get("draftType")
    if draft_type in ALLOWED_DRAFT_TYPES:
        settings["draftType"] = draft_type

    visibility = raw.get("visibility")
    if visibility in ALLOWED_VISIBILITY:
        settings["visibility"] = visibility

    for key in BOOL_KEYS:
        if isinstance(raw.get(key), bool):
            settings[key] = raw[key]

    for key in CAP_KEYS:
        value = raw.get(key)
        if isinstance(value, int) and 0 <= value <= MAX_CAP:
            settings[key] = value

    pool = raw.get("pool")
    if isinstance(pool, dict):
        settings["pool"]["include"] = _clean_filter(pool.get("include"))
        settings["pool"]["exclude"] = _clean_filter(pool.get("exclude"))
        if pool.get("logic") in ALLOWED_POOL_LOGIC:
            settings["pool"]["logic"] = pool["logic"]

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
        # Newest first; only public lobbies appear in the browser.
        return [
            lobby.to_summary()
            for lobby in reversed(list(self._lobbies.values()))
            if lobby.settings["visibility"] == "public"
        ]


store = LobbyStore()
