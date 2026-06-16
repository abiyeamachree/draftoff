import type { Match } from "./match.js";

export type TournamentType =
  | "round_robin"
  | "double_round_robin"
  | "knockout"
  | "groups_knockout"
  | "best_of";

export const TOURNAMENT_LABELS: Record<TournamentType, string> = {
  round_robin: "Round robin",
  double_round_robin: "Double round robin",
  knockout: "Knockout",
  groups_knockout: "Groups → knockout",
  best_of: "Best-of series",
};

/** League-style formats are capped tighter than knockout-style tournaments. */
export const LEAGUE_FORMATS: TournamentType[] = ["round_robin", "double_round_robin"];

export const MIN_TEAMS = 2;
export const MAX_TEAMS_LEAGUE = 24;
export const MAX_TEAMS_TOURNAMENT = 64;

/** Maximum number of teams allowed for a given competition format. */
export function maxTeamsForFormat(format: TournamentType): number {
  return LEAGUE_FORMATS.includes(format) ? MAX_TEAMS_LEAGUE : MAX_TEAMS_TOURNAMENT;
}

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
