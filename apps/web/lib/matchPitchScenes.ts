import type { MatchAnimation, PitchPlayerDot } from "@draftoff/shared";
import { formationRows } from "@draftoff/shared";

function halfSlotPositions(rowCounts: number[], team: "home" | "away"): PitchPlayerDot[] {
  const positions: PitchPlayerDot[] = [];
  rowCounts.forEach((count, rowIdx) => {
    const baseY = team === "home" ? 86 - rowIdx * 14 : 14 + rowIdx * 14;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : 14 + (72 / Math.max(1, count - 1)) * i;
      positions.push({ team, x, y: baseY });
    }
  });
  return positions;
}

export function buildFormationScene(
  homeFormation: string,
  awayFormation: string
): PitchPlayerDot[] {
  const homeRows = [1, ...formationRows(homeFormation)];
  const awayRows = [1, ...formationRows(awayFormation)];
  return [...halfSlotPositions(homeRows, "home"), ...halfSlotPositions(awayRows, "away")];
}

export function applySentOff(
  dots: PitchPlayerDot[],
  homeSentOff: number,
  awaySentOff: number
): PitchPlayerDot[] {
  const trimTeam = (team: "home" | "away", n: number) => {
    const teamDots = dots.filter((d) => d.team === team);
    if (n <= 0) return teamDots;
    const kept = [...teamDots];
    while (n > 0 && kept.length > 1) {
      kept.pop();
      n--;
    }
    return kept;
  };
  return [...trimTeam("home", homeSentOff), ...trimTeam("away", awaySentOff)];
}

export function mergePitchScene(
  base: PitchPlayerDot[],
  event: PitchPlayerDot[] | null | undefined
): PitchPlayerDot[] {
  if (!event?.length) return base;

  const result = base.map((d) => ({ ...d }));
  const homeIdx = result.map((d, i) => (d.team === "home" ? i : -1)).filter((i) => i >= 0);
  const awayIdx = result.map((d, i) => (d.team === "away" ? i : -1)).filter((i) => i >= 0);
  let homeUsed = 0;
  let awayUsed = 0;

  for (const dot of event) {
    if (dot.team === "home" && homeUsed < homeIdx.length) {
      result[homeIdx[homeUsed]!] = { ...dot, team: "home" };
      homeUsed++;
    } else if (dot.team === "away" && awayUsed < awayIdx.length) {
      result[awayIdx[awayUsed]!] = { ...dot, team: "away" };
      awayUsed++;
    }
  }
  return result;
}

export function countSentOff(
  animations: MatchAnimation[],
  upToMinute: number,
  homeUserId: string,
  awayUserId: string
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const a of animations) {
    if (a.minute > upToMinute || a.type !== "red_card") continue;
    if (a.teamUserId === homeUserId) home++;
    else if (a.teamUserId === awayUserId) away++;
  }
  return { home, away };
}

/** Client fallback partial scenes for legacy animations without `players` array. */
export function partialSceneForAnimation(anim: MatchAnimation): PitchPlayerDot[] | null {
  const t = anim.type;
  const bx = anim.ballX;
  const by = anim.ballY;
  const homeAttacks = anim.ballY < 50;

  if (t === "kickoff") {
    return [
      { team: "home", x: 35, y: 55 },
      { team: "home", x: 50, y: 55 },
      { team: "home", x: 65, y: 55 },
      { team: "away", x: 35, y: 45 },
      { team: "away", x: 50, y: 45 },
      { team: "away", x: 65, y: 45 },
    ];
  }

  if (t === "corner" || t === "cross") {
    return scatterBox(homeAttacks, 8);
  }

  if (t === "freekick" || t === "freekick_miss") {
    return freekickWall(homeAttacks);
  }

  if (t === "transition") {
    return transitionScene(homeAttacks);
  }

  if (t === "goal" || t === "shot" || t === "near_miss") {
    const atk = homeAttacks ? "home" : "away";
    const df = homeAttacks ? "away" : "home";
    return [
      { team: atk, x: bx, y: by },
      { team: df, x: 50, y: homeAttacks ? 22 : 78 },
    ];
  }

  return null;
}

export function sceneForAnimation(anim: MatchAnimation): PitchPlayerDot[] | null {
  if (anim.players && anim.players.length > 0) return anim.players;
  return partialSceneForAnimation(anim);
}

export function fullSceneForMatch(
  homeFormation: string,
  awayFormation: string,
  anim: MatchAnimation | null | undefined,
  sentOff: { home: number; away: number }
): PitchPlayerDot[] {
  const base = applySentOff(buildFormationScene(homeFormation, awayFormation), sentOff.home, sentOff.away);
  if (!anim) return base;
  const event = sceneForAnimation(anim);
  return mergePitchScene(base, event);
}

function scatterBox(homeAttacks: boolean, n: number): PitchPlayerDot[] {
  const atk = homeAttacks ? "home" : "away";
  const df = homeAttacks ? "away" : "home";
  const gy = homeAttacks ? 12 : 88;
  const dots: PitchPlayerDot[] = [];
  for (let i = 0; i < n; i++) {
    dots.push({
      team: atk,
      x: 25 + (i % 4) * 16,
      y: gy + (homeAttacks ? 1 : -1) * (4 + Math.floor(i / 4) * 5),
    });
  }
  dots.push({ team: df, x: 50, y: gy + (homeAttacks ? 12 : -12) });
  return dots;
}

function freekickWall(homeAttacks: boolean): PitchPlayerDot[] {
  const atk = homeAttacks ? "home" : "away";
  const df = homeAttacks ? "away" : "home";
  const line = homeAttacks ? 22 : 78;
  return [
    { team: df, x: 42, y: line },
    { team: df, x: 50, y: line },
    { team: df, x: 58, y: line },
    { team: atk, x: 50, y: line + (homeAttacks ? 10 : -10) },
    { team: atk, x: 35, y: line + (homeAttacks ? 14 : -14) },
  ];
}

function transitionScene(homeAttacks: boolean): PitchPlayerDot[] {
  const atk = homeAttacks ? "home" : "away";
  const df = homeAttacks ? "away" : "home";
  const gy = homeAttacks ? 10 : 90;
  const dots: PitchPlayerDot[] = [
    { team: atk, x: 45, y: gy + (homeAttacks ? 18 : -18) },
    { team: atk, x: 55, y: gy + (homeAttacks ? 14 : -14) },
  ];
  for (let i = 0; i < 6; i++) {
    dots.push({ team: atk, x: 15 + i * 12, y: gy + (homeAttacks ? 28 : -28) });
  }
  dots.push({ team: df, x: 50, y: homeAttacks ? 24 : 76 });
  return dots;
}
