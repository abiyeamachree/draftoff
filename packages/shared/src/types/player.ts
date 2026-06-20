/**
 * Football player domain types.
 *
 * Sourced from the SoFIFA dataset (`sofifa_all_players.csv`). The CSV has ~75
 * columns per (player, edition) row; we surface a trimmed, typed subset that the
 * game actually needs. Add more fields here as features require them.
 */

export type Position =
  | "GK"
  | "RB" | "RWB" | "CB" | "LB" | "LWB"
  | "CDM" | "CM" | "CAM" | "RM" | "LM"
  | "RW" | "LW" | "CF" | "ST";

/** The six SoFIFA summary stats shown on a card. */
export interface PlayerSummaryStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

/**
 * A draftable footballer card. One footballer may exist as multiple cards across
 * editions; the "Peak cards" lobby setting decides which card(s) enter the pool.
 */
export interface FootballPlayer {
  /** Stable SoFIFA player id (same person across editions). */
  playerId: number;
  /** Edition this card is from, e.g. "FC 26", "FIFA 14". */
  edition: string;
  /** Display name, e.g. "Cristiano Ronaldo". */
  name: string;
  overall: number;
  bestPosition: Position;
  /** All eligible positions for this player. */
  positions: Position[];
  nation: string;
  /** Formation slot on the manager's pitch (set when drafted). */
  slotIndex?: number;
  /** Club at the time of this edition (may be empty for free agents). */
  team: string;
  league: string;
  age: number;
  summary: PlayerSummaryStats;
  /** Whether this card is the player's peak (highest-overall) edition. */
  isPeak: boolean;
}

/** Lightweight pool entry for list/search views (avoids shipping every attribute). */
export interface PlayerPoolEntry {
  playerId: number;
  edition: string;
  name: string;
  overall: number;
  bestPosition: Position;
  nation: string;
  team: string;
  league: string;
  /** Server-authoritative: has this footballer already been drafted in the lobby? */
  available: boolean;
  /** All eligible positions (when provided by server). */
  positions?: Position[];
  /** Formation slot indices this player can fill right now. */
  eligibleSlots?: number[];
  /** Can the active manager draft this player into an open slot? */
  pickable?: boolean;
  /** Peak card edition (highest overall across all FIFA versions). */
  isPeak?: boolean;
  /** Face stats for hover card / bars (when provided by server). */
  summary?: PlayerSummaryStats;
}
