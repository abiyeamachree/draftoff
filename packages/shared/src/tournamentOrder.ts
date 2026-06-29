import type { Match, MatchResult } from "./types/match.js";
import type { TournamentState } from "./types/tournament.js";

/** Flat fixture list in tournament iteration order. */
export function allMatches(tournament: TournamentState): Match[] {
  return tournament.rounds.flat();
}

export function getNextPendingMatch(tournament: TournamentState): Match | null {
  for (const match of allMatches(tournament)) {
    if (match.status === "pending") return match;
  }
  return null;
}

/** Pending fixtures from the next unplayed through target (inclusive). */
export function getPendingUntil(tournament: TournamentState, targetMatchId: string): Match[] {
  const pending: Match[] = [];
  for (const match of allMatches(tournament)) {
    if (match.status === "pending") {
      pending.push(match);
      if (match.matchId === targetMatchId) break;
    }
  }
  const last = pending[pending.length - 1];
  if (!last || last.matchId !== targetMatchId) return [];
  return pending;
}

export function countPending(tournament: TournamentState): number {
  return allMatches(tournament).filter((m) => m.status === "pending").length;
}

export type QuickSimPhase = "normal" | "extra_time" | "penalties";

export type LiveMatchMode = "sim" | "watch";

export type LiveMatchState = {
  matchId: string;
  result: MatchResult;
  homeUserId: string;
  awayUserId: string;
  durationMs: number;
  maxMinute: number;
  phase: QuickSimPhase;
  minute: number;
  mode: LiveMatchMode;
  paused: boolean;
};

export type QuickSimSyncPayload =
  | { action: "start" }
  | { action: "stop" }
  | { action: "pause"; paused: boolean }
  | {
      action: "match";
      result: MatchResult;
      homeUserId: string;
      awayUserId: string;
      durationMs: number;
      maxMinute: number;
      phase: QuickSimPhase;
    }
  | { action: "watch"; result: MatchResult }
  | { action: "live"; state: LiveMatchState }
  | { action: "liveEnd" };

export function quickSimTiming(
  match: Match,
  tournamentType: TournamentState["type"],
  rng = Math.random()
): { durationMs: number; maxMinute: number; phase: QuickSimPhase } {
  const isGroupOrLeague =
    tournamentType === "round_robin" ||
    tournamentType === "double_round_robin" ||
    Boolean(match.group);

  if (isGroupOrLeague) {
    return { durationMs: 5000, maxMinute: 90, phase: "normal" };
  }

  if (rng < 0.35) {
    return { durationMs: 7000, maxMinute: 120, phase: "extra_time" };
  }
  if (rng < 0.55) {
    return { durationMs: 8000, maxMinute: 120, phase: "penalties" };
  }
  return { durationMs: 5000, maxMinute: 90, phase: "normal" };
}

export function displayScoreAtMinute(
  result: MatchResult,
  minute: number,
  phase: QuickSimPhase
): { home: number; away: number; label?: string } {
  let home = 0;
  let away = 0;
  for (const g of result.goals) {
    if (g.minute <= minute) {
      if (g.userId === result.homeUserId) home += 1;
      else away += 1;
    }
  }
  if (phase === "penalties" && minute >= 120) {
    return {
      home: result.homeScore,
      away: result.awayScore,
      label: "Pens",
    };
  }
  return { home, away };
}
