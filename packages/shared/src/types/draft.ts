import type { FootballPlayer, PlayerPoolEntry } from "./player.js";
import type { PickCycleMode } from "./lobby.js";

/** Max players returned per pick offer (one page). */
export const OFFER_PLAYER_LIMIT = 20;

/** Server-rolled context for the active picker's current turn. */
export interface DraftTurnOffer {
  cycleMode: PickCycleMode;
  edition: string;
  season: string;
  team?: string;
  league?: string;
  nation?: string;
  position?: string;
  /** Human-readable roll e.g. "Arsenal · 25/26". */
  label: string;
  /** Eligible names for the dice reel (teams, leagues, etc. for cycleMode). */
  rollPool: string[];
  options: PlayerPoolEntry[];
}

/** A single completed pick in the draft log (append-only). */
export interface DraftPick {
  /** Overall pick number across the whole draft, 0-based. */
  overallPick: number;
  /** Round number, 0-based. */
  round: number;
  userId: string;
  player: FootballPlayer;
  /** Was this pick auto-made by the server on timer expiry? */
  auto: boolean;
  /** Formation slot this player was placed in. */
  slotIndex?: number;
}

/** A drafted squad belonging to one user. */
export interface Squad {
  userId: string;
  players: FootballPlayer[];
  /** Computed by engine/rating.teamRating; null until a rating exists. */
  teamRating: number | null;
}

/**
 * Authoritative draft state. The server owns this; clients render it and never
 * mutate it locally beyond optimistic hints reconciled on the next broadcast.
 */
export interface DraftState {
  /** Snake order of userIds; index = pick slot within a round. */
  order: string[];
  /** Total picks made so far == index into the flattened snake sequence. */
  currentPickIndex: number;
  /** Whose turn it is right now (userId), or null when the draft is complete. */
  activeUserId: string | null;
  /** Seconds remaining on the active turn timer. */
  timeRemaining: number;
  round: number;
  totalRounds: number;
  picks: DraftPick[];
  squads: Squad[];
  complete: boolean;
  /** Rolled team/year (etc.) + player options for the active picker. */
  turnOffer: DraftTurnOffer | null;
  /** Pre-draft 3-2-1 countdown; null once the first pick is live. */
  startCountdown: number | null;
  /** Re-rolls left on the active turn. */
  rerollsRemaining: number;
  /** False until the active picker can select (reveal done); timer paused until then. */
  pickTimerActive: boolean;
}
