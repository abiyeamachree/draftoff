/** A goal scored in a match. */
export interface GoalEvent {
  userId: string;
  scorerPlayerId: number;
  scorerName: string;
  minute: number;
  commentary: string;
}

export type MatchStatus = "pending" | "played";

/** One line in commentary feed. */
export interface CommentaryLine {
  minute: number;
  text: string;
  /** Goal / big chance — red highlight in UI. */
  highlight?: boolean;
}

/** Pre-scripted pitch animation synced to commentary. */
export type MatchAnimationType =
  | "kickoff"
  | "pass"
  | "cross"
  | "shot"
  | "goal"
  | "save"
  | "celebration";

export interface MatchAnimation {
  minute: number;
  type: MatchAnimationType;
  teamUserId: string;
  playerId?: number;
  slotIndex?: number;
  /** Ball position on pitch (0–100). */
  ballX: number;
  ballY: number;
}

/** Result of one simulated match between two squads. */
export interface MatchResult {
  matchId: string;
  homeUserId: string;
  awayUserId: string;
  homeScore: number;
  awayScore: number;
  goals: GoalEvent[];
  commentary: CommentaryLine[];
  animations: MatchAnimation[];
  winnerUserId: string | null;
}

/** A scheduled or completed match in a tournament. */
export interface Match {
  matchId: string;
  round: number;
  homeUserId: string | null;
  awayUserId: string | null;
  status: MatchStatus;
  result: MatchResult | null;
  isHumanFixture?: boolean;
  /** Group stage label e.g. "A" when type is groups_knockout. */
  group?: string;
}
