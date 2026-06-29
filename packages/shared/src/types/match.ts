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
  | "corner"
  | "freekick"
  | "freekick_miss"
  | "penalty"
  | "penalty_miss"
  | "transition"
  | "near_miss"
  | "yellow_card"
  | "red_card"
  | "offside_goal"
  | "offside_var"
  | "pass"
  | "cross"
  | "shot"
  | "goal"
  | "save"
  | "foul"
  | "celebration";

export interface PitchPlayerDot {
  team: "home" | "away";
  x: number;
  y: number;
  slotIndex?: number;
}

export interface MatchAnimation {
  minute: number;
  type: MatchAnimationType;
  teamUserId: string;
  playerId?: number;
  slotIndex?: number;
  /** Ball position on pitch (0–100). */
  ballX: number;
  ballY: number;
  /** Optional scene layout overriding formation dots. */
  players?: PitchPlayerDot[];
  /** Short overlay label e.g. "Corner for Senegal". */
  label?: string;
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
