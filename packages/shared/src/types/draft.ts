import type { FootballPlayer } from "./player.js";

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
}
