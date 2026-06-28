/**
 * The single source of truth for the realtime protocol.
 *
 * Both the Socket.IO server (`new Server<ClientToServerEvents, ServerToClientEvents>()`)
 * and the client (`io<ServerToClientEvents, ClientToServerEvents>()`) import these
 * so messages are end-to-end type-checked.
 *
 * Convention: clients REQUEST actions; the server CONFIRMS by broadcasting new
 * authoritative state (`*:state`). Acknowledgement callbacks return a typed
 * `Ack<T>` for the immediate request/response cases (e.g. create/join).
 */

import type { DraftState } from "../types/draft.js";
import type {
  ChatMessage,
  LobbySettings,
  LobbyState,
  LobbySummary,
} from "../types/lobby.js";
import type { MatchResult } from "../types/match.js";
import type { PlayerPoolEntry } from "../types/player.js";
import type { TournamentState } from "../types/tournament.js";

/** Standard acknowledgement envelope for request/response events. */
export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateLobbyPayload {
  displayName: string;
  settings?: Partial<LobbySettings>;
}

export interface JoinLobbyPayload {
  code: string;
  displayName: string;
}

export interface DraftPickPayload {
  code: string;
  userId?: string;
  playerId: number;
  edition: string;
  slotIndex: number;
}

export interface SearchPayload {
  code: string;
  query: string;
  /** Optional filters; expand as the pool UI grows. */
  position?: string;
  league?: string;
  limit?: number;
}

export interface ResumePayload {
  code: string;
  userId: string;
}

/** Re-attach an existing/known identity to a lobby or draft after navigation. */
export interface SyncPayload {
  code: string;
  /** Previously issued user id (from create/join), if the client has one. */
  userId?: string;
}

/** Events the client sends to the server (with typed ack callbacks). */
export interface ClientToServerEvents {
  "lobby:create": (
    payload: CreateLobbyPayload,
    ack: (res: Ack<{ code: string; userId: string; state: LobbyState }>) => void
  ) => void;
  "lobby:join": (
    payload: JoinLobbyPayload,
    ack: (res: Ack<{ userId: string; state: LobbyState }>) => void
  ) => void;
  /** Browse all joinable lobbies (home screen). */
  "lobby:list": (ack: (res: Ack<LobbySummary[]>) => void) => void;
  /** Re-subscribe a socket to a lobby room and fetch current state. */
  "lobby:sync": (
    payload: SyncPayload,
    ack: (res: Ack<LobbyState>) => void
  ) => void;
  /** Leave a lobby room. Pass quit: true to leave the player list (explicit leave). */
  "lobby:leave": (
    payload: { code: string; userId?: string; quit?: boolean },
    ack: (res: Ack<null>) => void
  ) => void;
  /** Re-subscribe a socket to a draft room and fetch current state. */
  "draft:sync": (
    payload: SyncPayload,
    ack: (res: Ack<DraftState>) => void
  ) => void;
  "lobby:setReady": (
    payload: { code: string; ready: boolean },
    ack: (res: Ack<null>) => void
  ) => void;
  /** Set this player's team icon, name and formation on the lobby screen. */
  "lobby:customise": (
    payload: {
      code: string;
      userId?: string;
      icon?: string;
      displayName?: string;
      formation?: string;
    },
    ack: (res: Ack<LobbyState>) => void
  ) => void;
  /** Send a preset quick-chat phrase or emoji to the room. */
  "chat:send": (
    payload: { code: string; userId?: string; text: string },
    ack: (res: Ack<null>) => void
  ) => void;
  "lobby:updateSettings": (
    payload: { code: string; userId?: string; settings: Partial<LobbySettings> },
    ack: (res: Ack<LobbyState>) => void
  ) => void;
  /** Host returns everyone to lobby settings and resets the in-progress game. */
  "lobby:reopen": (
    payload: { code: string; userId?: string },
    ack: (res: Ack<LobbyState>) => void
  ) => void;
  /** Host removes a player from the lobby. */
  "lobby:kick": (
    payload: { code: string; userId?: string; targetUserId: string },
    ack: (res: Ack<null>) => void
  ) => void;
  /** Host ends the game for everyone. */
  "lobby:end": (
    payload: { code: string; userId?: string },
    ack: (res: Ack<null>) => void
  ) => void;
  "lobby:start": (
    payload: { code: string },
    ack: (res: Ack<null>) => void
  ) => void;
  "draft:pick": (
    payload: DraftPickPayload,
    ack: (res: Ack<null>) => void
  ) => void;
  /** Re-roll the dice for the active turn (team/year/etc.). */
  "draft:cycle": (
    payload: { code: string; userId?: string },
    ack: (res: Ack<null>) => void
  ) => void;
  /** Active picker signals their option list is ready; starts the pick timer. */
  "draft:pickReady": (
    payload: { code: string; userId?: string },
    ack: (res: Ack<null>) => void
  ) => void;
  "draft:search": (
    payload: SearchPayload,
    ack: (res: Ack<PlayerPoolEntry[]>) => void
  ) => void;
  "reconnect:resume": (
    payload: ResumePayload,
    ack: (res: Ack<null>) => void
  ) => void;
  /** Simulate (or re-fetch) a single tournament fixture. Host only. */
  "sim:runMatch": (
    payload: { code: string; matchId: string; userId?: string },
    ack: (res: Ack<MatchResult>) => void
  ) => void;
}

/** Authoritative broadcasts the server sends to clients. */
export interface ServerToClientEvents {
  "lobby:state": (state: LobbyState) => void;
  /** Pushed to every connected client whenever the set of lobbies changes. */
  "lobby:list": (summaries: LobbySummary[]) => void;
  "draft:state": (state: DraftState) => void;
  /** Lightweight turn change (full state still authoritative via draft:state). */
  "draft:turn": (payload: { activeUserId: string | null; round: number }) => void;
  "draft:picked": (payload: {
    userId: string;
    playerId: number;
    edition: string;
    auto: boolean;
  }) => void;
  /** Per-second timer tick for the active turn (or pre-draft countdown). */
  "draft:tick": (payload: {
    timeRemaining: number;
    startCountdown?: number | null;
  }) => void;
  "sim:matchResult": (result: MatchResult) => void;
  "tournament:state": (state: TournamentState) => void;
  /** A quick-chat message broadcast to everyone in the room. */
  "chat:message": (message: ChatMessage) => void;
  /** You were removed by the host — show overlay and return home. */
  "lobby:kicked": (payload: { message: string }) => void;
  /** Host ended the game — show overlay for everyone still in the room. */
  "lobby:ended": (payload: { message: string }) => void;
  "error": (payload: { code: string; message: string }) => void;
}

/** Per-socket data the server attaches after auth/join. */
export interface SocketData {
  userId?: string;
  lobbyCode?: string;
}

/** Inter-server events (unused for single-node; reserved for scaling out). */
export interface InterServerEvents {
  ping: () => void;
}
