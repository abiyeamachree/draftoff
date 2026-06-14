import type { Match } from "./match.js";

export type TournamentType = "knockout" | "round_robin";

/** One row in the round-robin standings table. */
export interface StandingRow {
  userId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Authoritative tournament state. For knockout, `rounds` is the bracket; for
 * round robin, `rounds` is the matchday schedule and `standings` is the table.
 */
export interface TournamentState {
  type: TournamentType;
  /** Matches grouped by round/matchday. */
  rounds: Match[][];
  /** Current round/matchday index being played. */
  currentRound: number;
  /** Populated for round_robin; empty for knockout. */
  standings: StandingRow[];
  /** userId of the overall winner once finished, else null. */
  winnerUserId: string | null;
  complete: boolean;
}
