import type { Match, MatchResult } from "./types/match.js";
import type { StandingRow, TournamentState } from "./types/tournament.js";
import { allMatches } from "./tournamentOrder.js";

function emptyRow(userId: string): StandingRow {
  return {
    userId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function applyResult(row: StandingRow, gf: number, ga: number) {
  row.played += 1;
  row.goalsFor += gf;
  row.goalsAgainst += ga;
  if (gf > ga) {
    row.won += 1;
    row.points += 3;
  } else if (gf === ga) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
  row.goalDifference = row.goalsFor - row.goalsAgainst;
}

function compareStandingRows(a: StandingRow, b: StandingRow): number {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor
  );
}

function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort(compareStandingRows);
}

function remainingGroupMatches(
  tournament: TournamentState,
  group: string,
  userId: string
): number {
  let count = 0;
  for (const m of allMatches(tournament)) {
    if (m.group !== group || m.status !== "pending") continue;
    if (m.homeUserId === userId || m.awayUserId === userId) count++;
  }
  return count;
}

function worstCaseRow(row: StandingRow, remaining: number): StandingRow {
  return {
    ...row,
    played: row.played + remaining,
    lost: row.lost + remaining,
  };
}

function bestCaseRow(row: StandingRow, remaining: number): StandingRow {
  return {
    ...row,
    played: row.played + remaining,
    won: row.won + remaining,
    points: row.points + remaining * 3,
    goalsFor: row.goalsFor + remaining * 3,
    goalDifference: row.goalsFor + remaining * 3 - row.goalsAgainst,
  };
}

/** True if team cannot finish worse than top K in the group. */
export function hasClinchedTopK(
  tournament: TournamentState,
  group: string,
  userId: string,
  k: number
): boolean {
  const rows = groupStandings(tournament, group);
  const team = rows.find((r) => r.userId === userId);
  if (!team || k < 1) return false;

  const rem = remainingGroupMatches(tournament, group, userId);
  const myWorst = worstCaseRow(team, rem);

  let canFinishAhead = 0;
  for (const other of rows) {
    if (other.userId === userId) continue;
    const otherRem = remainingGroupMatches(tournament, group, other.userId);
    const otherBest = bestCaseRow(other, otherRem);
    if (compareStandingRows(otherBest, myWorst) > 0) canFinishAhead++;
  }
  return canFinishAhead < k;
}

export function groupStageComplete(
  tournament: TournamentState,
  group: string
): boolean {
  return !allMatches(tournament).some(
    (m) => m.group === group && m.status === "pending"
  );
}

export type KnockoutQualificationConfig = {
  groupCount: number;
  directPerGroup: number;
  directTotal: number;
  knockoutSize: number;
  thirdPlaceCount: number;
};

function targetKnockoutSize(directTotal: number, totalTeams: number): number {
  for (const size of [8, 16, 32, 64]) {
    if (size >= directTotal && size <= totalTeams) return size;
  }
  let fallback = 2;
  for (const size of [2, 4, 8, 16, 32, 64]) {
    if (size <= totalTeams) fallback = size;
  }
  return Math.max(directTotal, fallback);
}

/** Knockout field size and how many direct / third-place slots fill it. */
export function knockoutQualificationConfig(
  tournament: TournamentState
): KnockoutQualificationConfig {
  const groups = groupLabels(tournament);
  const groupCount = groups.length;
  const directPerGroup = 2;
  const directTotal = groupCount * directPerGroup;
  const totalTeams = groups.reduce(
    (n, g) => n + groupTeamIds(tournament, g).length,
    0
  );
  const knockoutSize = targetKnockoutSize(directTotal, totalTeams);
  const thirdPlaceCount = Math.max(0, knockoutSize - directTotal);
  return {
    groupCount,
    directPerGroup,
    directTotal,
    knockoutSize,
    thirdPlaceCount,
  };
}

function thirdPlaceCandidates(
  tournament: TournamentState
): { userId: string; row: StandingRow; group: string }[] {
  const out: { userId: string; row: StandingRow; group: string }[] = [];
  for (const g of groupLabels(tournament)) {
    const rows = groupStandings(tournament, g);
    const third = rows[2];
    if (third) out.push({ userId: third.userId, row: third, group: g });
  }
  return out.sort((a, b) => compareStandingRows(a.row, b.row));
}

function hasClinchedThirdPlaceKnockout(
  tournament: TournamentState,
  userId: string,
  thirdCount: number
): boolean {
  if (thirdCount <= 0) return false;

  const group = groupLabels(tournament).find((g) =>
    groupStandings(tournament, g).some((r) => r.userId === userId)
  );
  if (!group) return false;

  const rows = groupStandings(tournament, group);
  const idx = rows.findIndex((r) => r.userId === userId);
  if (idx !== 2) return false;

  if (!hasClinchedTopK(tournament, group, userId, 3)) return false;

  const rem = remainingGroupMatches(tournament, group, userId);
  const myWorst = worstCaseRow(rows[idx]!, rem);

  let betterThanMyWorst = 0;
  for (const g of groupLabels(tournament)) {
    if (g === group) continue;
    const otherRows = groupStandings(tournament, g);
    const third = otherRows[2];
    if (!third) continue;
    const otherRem = remainingGroupMatches(tournament, g, third.userId);
    const otherBest = bestCaseRow(third, otherRem);
    if (compareStandingRows(otherBest, myWorst) > 0) betterThanMyWorst++;
  }

  return betterThanMyWorst < thirdCount;
}

function resolveThirdPlaceQualifiers(
  tournament: TournamentState,
  thirdCount: number
): (string | null)[] {
  if (thirdCount <= 0) return [];

  const allComplete = groupLabels(tournament).every((g) =>
    groupStageComplete(tournament, g)
  );

  const qualified: StandingRow[] = [];
  for (const { userId, row, group } of thirdPlaceCandidates(tournament)) {
    if (allComplete) {
      qualified.push(row);
    } else if (hasClinchedThirdPlaceKnockout(tournament, userId, thirdCount)) {
      qualified.push(row);
    }
  }

  qualified.sort(compareStandingRows);
  const slots: (string | null)[] = qualified.slice(0, thirdCount).map((r) => r.userId);
  while (slots.length < thirdCount) slots.push(null);
  return slots;
}

/** Knockout seeds — only teams that have mathematically qualified (null = TBD). */
export function knockoutBracketSeeds(tournament: TournamentState): (string | null)[] {
  const { knockoutSize, directPerGroup, thirdPlaceCount } =
    knockoutQualificationConfig(tournament);
  const seeds: (string | null)[] = [];

  for (const g of groupLabels(tournament)) {
    const rows = groupStandings(tournament, g);
    const complete = groupStageComplete(tournament, g);

    for (let rank = 0; rank < directPerGroup; rank++) {
      const team = rows[rank];
      if (!team) {
        seeds.push(null);
        continue;
      }
      const qualified =
        complete ||
        hasClinchedTopK(tournament, g, team.userId, 2);
      seeds.push(qualified ? team.userId : null);
    }
  }

  seeds.push(...resolveThirdPlaceQualifiers(tournament, thirdPlaceCount));

  while (seeds.length < knockoutSize) seeds.push(null);
  return seeds.slice(0, knockoutSize);
}

/** Group labels present in the tournament (sorted). */
export function groupLabels(tournament: TournamentState): string[] {
  const groups = new Set<string>();
  for (const m of allMatches(tournament)) {
    if (m.group) groups.add(m.group);
  }
  return [...groups].sort();
}

/** All userIds assigned to a group (from fixtures). */
export function groupTeamIds(tournament: TournamentState, group: string): string[] {
  const ids = new Set<string>();
  for (const m of allMatches(tournament)) {
    if (m.group !== group) continue;
    if (m.homeUserId) ids.add(m.homeUserId);
    if (m.awayUserId) ids.add(m.awayUserId);
  }
  return [...ids];
}

/** Per-group standings; all group teams appear from the start on 0 pts. */
export function groupStandings(
  tournament: TournamentState,
  group: string
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const uid of groupTeamIds(tournament, group)) {
    rows.set(uid, emptyRow(uid));
  }

  for (const m of allMatches(tournament)) {
    if (m.group !== group || m.status !== "played" || !m.result) continue;
    const res = m.result;
    const home = res.homeUserId;
    const away = res.awayUserId;
    if (!rows.has(home)) rows.set(home, emptyRow(home));
    if (!rows.has(away)) rows.set(away, emptyRow(away));
    applyResult(rows.get(home)!, res.homeScore, res.awayScore);
    applyResult(rows.get(away)!, res.awayScore, res.homeScore);
  }

  return sortStandings([...rows.values()]);
}

export function isGroupMatch(match: Match): boolean {
  return Boolean(match.group);
}

export function groupMatches(tournament: TournamentState): Match[] {
  return allMatches(tournament).filter(isGroupMatch);
}

export function knockoutMatches(tournament: TournamentState): Match[] {
  return allMatches(tournament).filter((m) => !isGroupMatch(m));
}

export function isKnockoutPhase(tournament: TournamentState): boolean {
  const next = allMatches(tournament).find((m) => m.status === "pending");
  return Boolean(next && !isGroupMatch(next));
}

export function firstKnockoutMatch(tournament: TournamentState): Match | null {
  return knockoutMatches(tournament).find((m) => m.status === "pending") ?? null;
}

export type PlayerStatEntry = {
  playerId: number;
  name: string;
  userId: string;
  count: number;
};

export type TournamentPlayerStats = {
  goals: PlayerStatEntry[];
  assists: PlayerStatEntry[];
  cleanSheets: PlayerStatEntry[];
  yellowCards: PlayerStatEntry[];
  redCards: PlayerStatEntry[];
};

function statKey(userId: string, playerId: number) {
  return `${userId}:${playerId}`;
}

function bumpStat(
  map: Map<string, PlayerStatEntry>,
  userId: string,
  playerId: number,
  name: string,
  n = 1
) {
  const key = userId ? statKey(userId, playerId) : `:${playerId}`;
  const prev = map.get(key);
  if (prev) prev.count += n;
  else map.set(key, { userId, playerId, name, count: n });
}

/** Aggregate player/team stats from all played match results. */
export function aggregateTournamentStats(
  tournament: TournamentState
): TournamentPlayerStats {
  const goals = new Map<string, PlayerStatEntry>();
  const assists = new Map<string, PlayerStatEntry>();
  const cleanSheets = new Map<string, PlayerStatEntry>();
  const yellowCards = new Map<string, PlayerStatEntry>();
  const redCards = new Map<string, PlayerStatEntry>();

  for (const m of allMatches(tournament)) {
    if (m.status !== "played" || !m.result) continue;
    collectFromResult(m.result, goals, assists, cleanSheets);
    collectCardsFromCommentary(m.result, yellowCards, redCards);
  }

  const top = (map: Map<string, PlayerStatEntry>, n = 5) =>
    [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);

  return {
    goals: top(goals),
    assists: top(assists),
    cleanSheets: top(cleanSheets),
    yellowCards: top(yellowCards),
    redCards: top(redCards),
  };
}

function collectFromResult(
  result: MatchResult,
  goals: Map<string, PlayerStatEntry>,
  assists: Map<string, PlayerStatEntry>,
  cleanSheets: Map<string, PlayerStatEntry>
) {
  for (const g of result.goals) {
    bumpStat(goals, g.userId, g.scorerPlayerId, g.scorerName);
    const assist = findAssistForGoal(result, g.minute);
    if (assist) {
      bumpStat(assists, g.userId, assist.playerId, assist.name);
    }
  }

  if (result.awayScore === 0) {
    bumpCleanSheet(cleanSheets, result.homeUserId);
  }
  if (result.homeScore === 0) {
    bumpCleanSheet(cleanSheets, result.awayUserId);
  }
}

function bumpCleanSheet(map: Map<string, PlayerStatEntry>, userId: string) {
  const key = `${userId}:gk`;
  const prev = map.get(key);
  if (prev) prev.count += 1;
  else map.set(key, { userId, playerId: 0, name: "Defense", count: 1 });
}

/** Infer assist from the pass line immediately before a goal in commentary. */
function findAssistForGoal(
  result: MatchResult,
  goalMinute: number
): { playerId: number; name: string } | null {
  const lines = result.commentary.filter(
    (c) => c.minute <= goalMinute && c.minute >= goalMinute - 2
  );
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i]!.text;
    if (text.startsWith("A good pass by ")) {
      const name = text.replace("A good pass by ", "").replace("…", "").trim();
      const last = name.split(" ").pop() ?? name;
      return { playerId: hashName(last), name: last };
    }
  }
  return null;
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function collectCardsFromCommentary(
  result: MatchResult,
  yellowCards: Map<string, PlayerStatEntry>,
  redCards: Map<string, PlayerStatEntry>
) {
  for (const line of result.commentary) {
    const t = line.text.toLowerCase();
    if (t.includes("yellow card")) {
      const who = extractCardTarget(line.text);
      if (who) bumpStat(yellowCards, who.userId, who.playerId, who.name);
    }
    if (t.includes("red card")) {
      const who = extractCardTarget(line.text);
      if (who) bumpStat(redCards, who.userId, who.playerId, who.name);
    }
  }
}

function extractCardTarget(text: string): { userId: string; playerId: number; name: string } | null {
  const m = text.match(/for (.+?)(?:\.|$)/i);
  if (!m) return null;
  const name = m[1]!.trim();
  return { userId: "", playerId: hashName(name), name };
}

/** Knockout rounds grouped by round index for bracket display. */
export function knockoutRounds(tournament: TournamentState): Match[][] {
  const byRound = new Map<number, Match[]>();
  for (const m of knockoutMatches(tournament)) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, matches]) => matches);
}
