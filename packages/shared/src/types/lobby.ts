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
  /** Display name of the draft. */
  name: string;
  /** Total teams in the league/tournament (humans + filler clubs). */
  numTeams: number;
  /** Real clubs that fill the league spots not taken by human managers. */
  teams: string[];
  /** Footballers per squad. */
  teamSize: TeamSize;
  tournamentType: TournamentType;
  draftType: DraftType;
  draftTimerSeconds: number;
  /** Players per pack when draftType is "pack". */
  packSize: number;
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
  /**
   * What the dice rolls each turn before showing pick options.
   * team = random club+year, league/nation/position = random bucket in that year.
   */
  pickCycleMode: PickCycleMode;
  /** Re-rolls allowed per pick (0–5). */
  rerollsPerPick: number;
}

export type PickCycleMode = "team" | "league" | "nation" | "position";

export const PICK_CYCLE_LABELS: Record<PickCycleMode, string> = {
  team: "Team + year",
  league: "League + year",
  nation: "Nation + year",
  position: "Position + year",
};

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
export const MIN_REROLLS_PER_PICK = 0;
export const MAX_REROLLS_PER_PICK = 5;

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  name: "",
  numTeams: 8,
  teams: [],
  teamSize: 11,
  tournamentType: "knockout",
  draftType: "snake",
  draftTimerSeconds: 15,
  packSize: 5,
  visibility: "public",
  pool: emptyPoolRules(),
  peakCardsEnabled: false,
  maxPerClub: 0,
  maxPerNation: 0,
  maxPerLeague: 0,
  hideRatings: false,
  chatEnabled: true,
  draftBoardEnabled: true,
  fillWithBots: false,
  pickCycleMode: "team",
  rerollsPerPick: 1,
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
  /** Emoji avatar chosen on the lobby screen. */
  icon: string;
  /** Chosen formation (e.g. "4-3-3"); empty until picked. */
  formation: string;
  isHost: boolean;
  isReady: boolean;
  /** Draft slot (0-based), assigned when the draft starts. */
  draftSlot: number | null;
  connection: ConnectionStatus;
}

/** Emoji avatars selectable on the lobby screen. */
export const PLAYER_ICONS = [
  "⚽", "🔥", "🦁", "🐉", "👑", "🦅", "🦈", "🐺",
  "🤖", "👽", "💀", "🎯", "⚡", "🌟", "🚀", "🎩",
] as const;

/** Outfield shapes per squad size (GK is always added on top). */
export const FORMATIONS_BY_SIZE: Record<number, string[]> = {
  11: ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2", "3-4-3"],
  8: ["3-3-1", "3-2-2", "2-3-2", "3-1-3"],
  5: ["2-1-1", "1-2-1", "2-2-0", "1-1-2"],
};

/** Default formation for a squad size. */
export function defaultFormation(teamSize: number): string {
  return (FORMATIONS_BY_SIZE[teamSize] ?? FORMATIONS_BY_SIZE[11])[0];
}

/** Outfield rows (defence -> attack) parsed from a formation string. */
export function formationRows(formation: string): number[] {
  return formation
    .split("-")
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
}

/** Rocket-League-style preset quick-chat phrases. */
export const QUICK_CHAT_PHRASES = [
  "Great pick!",
  "What a player!",
  "Oh no!",
  "Nice!",
  "Wow!",
  "No way!",
  "Steady...",
  "Calculated.",
  "Robbery!",
  "Wheeew.",
  "GG",
  "Close one!",
] as const;

/** Emoji reactions for quick chat. */
export const QUICK_CHAT_EMOJIS = [
  "😂", "😭", "🔥", "👏", "💀", "🐐", "😱", "🤝",
  "🙏", "😤", "🥶", "🤯", "👀", "💪", "🤡", "❤️",
] as const;

/** A single chat message broadcast within a lobby/draft room. */
export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  icon: string;
  text: string;
  at: number;
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
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  numTeams: number;
  status: LobbyStatus;
  teamSize: TeamSize;
  tournamentType: TournamentType;
}
