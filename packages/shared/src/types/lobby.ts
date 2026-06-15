import type { TournamentType } from "./tournament.js";

export type TeamSize = 5 | 8 | 11;

export type LobbyStatus =
  | "LOBBY"      // gathering players, configuring settings
  | "DRAFTING"   // snake draft in progress
  | "SIMULATING" // tournament being simulated
  | "FINISHED";  // winner decided

/** Public lobbies appear in the browser; private lobbies join by code only. */
export type LobbyVisibility = "public" | "private";

/** How squads are drafted. */
export type DraftType = "snake" | "linear" | "pack";

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  snake: "Snake",
  linear: "Linear",
  pack: "Pack (random)",
};

/** A bucket of selections per category. Empty arrays mean "nothing here". */
export interface PoolFilter {
  leagues: string[];
  seasons: string[];
  nations: string[];
  clubs: string[];
}

export const POOL_KEYS = ["leagues", "seasons", "nations", "clubs"] as const;
export type PoolCategory = (typeof POOL_KEYS)[number];

/** How include rules combine. */
export type PoolLogic = "OR" | "AND";

/**
 * The draftable pool as an include/exclude query.
 * - include empty => start from every player.
 * - include set   => keep players matching the include rules (OR/AND).
 * - exclude       => always removes matching players (treated as OR).
 */
export interface PoolRules {
  include: PoolFilter;
  exclude: PoolFilter;
  logic: PoolLogic;
}

/** Host-configurable lobby settings. */
export interface LobbySettings {
  /** Number of managers (teams) taking part. */
  numPlayers: number;
  /** Footballers per squad. */
  teamSize: TeamSize;
  tournamentType: TournamentType;
  draftType: DraftType;
  draftTimerSeconds: number;
  visibility: LobbyVisibility;
  pool: PoolRules;
  peakCardsEnabled: boolean;
  /** 0 means no limit. */
  maxPerClub: number;
  maxPerNation: number;
  maxPerLeague: number;
  hideRatings: boolean;
  chatEnabled: boolean;
  draftBoardEnabled: boolean;
  fillWithBots: boolean;
}

export function emptyPoolFilter(): PoolFilter {
  return { leagues: [], seasons: [], nations: [], clubs: [] };
}

export function emptyPoolRules(): PoolRules {
  return {
    include: emptyPoolFilter(),
    exclude: emptyPoolFilter(),
    logic: "OR",
  };
}

export const MAX_PLAYERS_PER_LOBBY = 20;
export const MIN_PLAYERS_PER_LOBBY = 2;

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  numPlayers: 4,
  teamSize: 11,
  tournamentType: "knockout",
  draftType: "snake",
  draftTimerSeconds: 30,
  visibility: "public",
  pool: emptyPoolRules(),
  peakCardsEnabled: true,
  maxPerClub: 0,
  maxPerNation: 0,
  maxPerLeague: 0,
  hideRatings: false,
  chatEnabled: true,
  draftBoardEnabled: true,
  fillWithBots: false,
};

function flattenFilter(filter: PoolFilter): string[] {
  return POOL_KEYS.flatMap((key) => filter[key]);
}

/** Count of every include + exclude selection across categories. */
export function countPoolRules(rules: PoolRules): number {
  return flattenFilter(rules.include).length + flattenFilter(rules.exclude).length;
}

/** Plain-English summary of an include/exclude pool query. */
export function describePool(rules: PoolRules): string {
  const include = flattenFilter(rules.include);
  const exclude = flattenFilter(rules.exclude);
  if (include.length === 0 && exclude.length === 0) {
    return "Every player is in the pool.";
  }
  const joiner = rules.logic === "AND" ? " and " : " or ";
  let sentence = include.length
    ? `Players from ${include.join(joiner)}`
    : "All players";
  if (exclude.length) {
    sentence += `, excluding ${exclude.join(", ")}`;
  }
  return `${sentence}.`;
}

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
