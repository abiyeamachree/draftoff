/** A single goal within a simulated match. */
export interface GoalEvent {
  /** userId of the scoring team. */
  userId: string;
  /** Drafted footballer who scored. */
  scorerPlayerId: number;
  scorerName: string;
  /** Match minute the goal was scored. */
  minute: number;
  /** Templated commentary line for this goal (no AI). */
  commentary: string;
}

export type MatchStatus = "pending" | "played";

/** Result of one simulated match between two squads. */
export interface MatchResult {
  matchId: string;
  homeUserId: string;
  awayUserId: string;
  homeScore: number;
  awayScore: number;
  goals: GoalEvent[];
  /** Ordered commentary feed for the whole match. */
  commentary: string[];
  /** userId of the winner, or null for a draw (round robin only). */
  winnerUserId: string | null;
}

/** A scheduled or completed match in a tournament. */
export interface Match {
  matchId: string;
  /** Round / matchday index this belongs to. */
  round: number;
  homeUserId: string | null;
  awayUserId: string | null;
  status: MatchStatus;
  result: MatchResult | null;
}
