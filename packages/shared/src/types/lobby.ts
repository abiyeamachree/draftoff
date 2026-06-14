import type { TournamentType } from "./tournament.js";

export type TeamSize = 5 | 7 | 8 | 11;

export type LobbyStatus =
  | "LOBBY"      // gathering players, configuring settings
  | "DRAFTING"   // snake draft in progress
  | "SIMULATING" // tournament being simulated
  | "FINISHED";  // winner decided

/** Host-configurable match settings. */
export interface LobbySettings {
  teamSize: TeamSize;
  /** Seconds each player has to make a pick before auto-pick fires. */
  draftTimerSeconds: number;
  tournamentType: TournamentType;
  /** If true, the pool uses each footballer's peak (best) edition card. */
  peakCardsEnabled: boolean;
}

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  teamSize: 5,
  draftTimerSeconds: 30,
  tournamentType: "knockout",
  peakCardsEnabled: true,
};

export const MAX_PLAYERS_PER_LOBBY = 20;

export type ConnectionStatus = "connected" | "disconnected";

/** A participant in a lobby. */
export interface LobbyPlayer {
  /** Stable user id (persisted). */
  userId: string;
  displayName: string;
  isHost: boolean;
  isReady: boolean;
  /** Draft slot (0-based), assigned when the draft starts. */
  draftSlot: number | null;
  connection: ConnectionStatus;
}

/** Full authoritative lobby snapshot broadcast to clients. */
export interface LobbyState {
  code: string;
  status: LobbyStatus;
  hostId: string;
  settings: LobbySettings;
  players: LobbyPlayer[];
}

/** Compact lobby info for the public lobby browser on the home screen. */
export interface LobbySummary {
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: LobbyStatus;
  teamSize: TeamSize;
  tournamentType: TournamentType;
}
