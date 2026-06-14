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
import type { LobbySettings, LobbyState } from "../types/lobby.js";
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
  playerId: number;
  edition: string;
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

/** Events the client sends to the server (with typed ack callbacks). */
export interface ClientToServerEvents {
  "lobby:create": (
    payload: CreateLobbyPayload,
    ack: (res: Ack<{ code: string; userId: string }>) => void
  ) => void;
  "lobby:join": (
    payload: JoinLobbyPayload,
    ack: (res: Ack<{ userId: string }>) => void
  ) => void;
  "lobby:setReady": (
    payload: { code: string; ready: boolean },
    ack: (res: Ack<null>) => void
  ) => void;
  "lobby:updateSettings": (
    payload: { code: string; settings: Partial<LobbySettings> },
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
  "draft:search": (
    payload: SearchPayload,
    ack: (res: Ack<PlayerPoolEntry[]>) => void
  ) => void;
  "reconnect:resume": (
    payload: ResumePayload,
    ack: (res: Ack<null>) => void
  ) => void;
}

/** Authoritative broadcasts the server sends to clients. */
export interface ServerToClientEvents {
  "lobby:state": (state: LobbyState) => void;
  "draft:state": (state: DraftState) => void;
  /** Lightweight turn change (full state still authoritative via draft:state). */
  "draft:turn": (payload: { activeUserId: string | null; round: number }) => void;
  "draft:picked": (payload: {
    userId: string;
    playerId: number;
    edition: string;
    auto: boolean;
  }) => void;
  /** Per-second timer tick for the active turn. */
  "draft:tick": (payload: { timeRemaining: number }) => void;
  "sim:matchResult": (result: MatchResult) => void;
  "tournament:state": (state: TournamentState) => void;
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
