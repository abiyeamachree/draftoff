import type { Position } from "./types/player.js";
import { formationRows } from "./types/lobby.js";
import { normalizePlayerPositions } from "./positions.js";

export type PositionLine = "GK" | "DEF" | "MID" | "FWD";

export const LINE_POSITIONS: Record<PositionLine, readonly Position[]> = {
  GK: ["GK"],
  DEF: ["RB", "RWB", "CB", "LB", "LWB"],
  MID: ["CDM", "CM", "CAM", "RM", "LM"],
  FWD: ["RW", "LW", "CF", "ST"],
};

/** Specific pitch slot labels for 11-a-side formations (left → right within each row). */
export const FORMATION_SLOT_ROLES_11: Record<string, readonly string[]> = {
  // Order matches PitchView: GK row, then each outfield row bottom → top.
  "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"],
  "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CDM", "CM", "RWB", "ST", "ST"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"],
  "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
};

/** Mutually compatible positions per slot — each cluster is fully bidirectional. */
export const SLOT_ACCEPTED: Record<string, readonly Position[]> = {
  GK: ["GK"],
  LB: ["LB", "LWB"],
  LWB: ["LB", "LWB"],
  RB: ["RB", "RWB"],
  RWB: ["RB", "RWB"],
  CB: ["CB"],
  LM: ["LM", "LW"],
  LW: ["LM", "LW"],
  RM: ["RM", "RW"],
  RW: ["RM", "RW"],
  ST: ["ST", "CF"],
  CF: ["ST", "CF"],
  CDM: ["CDM", "CM", "CAM"],
  CM: ["CDM", "CM", "CAM"],
  CAM: ["CDM", "CM", "CAM"],
  DEF: LINE_POSITIONS.DEF,
  MID: LINE_POSITIONS.MID,
  FWD: LINE_POSITIONS.FWD,
};

/** Total outfield + GK slots for a formation string. */
export function formationSlotCount(formation: string): number {
  return 1 + formationRows(formation).reduce((sum, n) => sum + n, 0);
}

function genericSlotRoles(formation: string): string[] {
  const rowCounts = [1, ...formationRows(formation)];
  const roles: string[] = [];
  for (let row = 0; row < rowCounts.length; row++) {
    for (let i = 0; i < rowCounts[row]; i++) {
      if (row === 0) roles.push("GK");
      else if (row === rowCounts.length - 1) roles.push("FWD");
      else if (row === 1) roles.push("DEF");
      else roles.push("MID");
    }
  }
  return roles;
}

/** Slot role labels for a formation (GK/LB/CB/… on known 11-a-side shapes; DEF/MID/FWD on 5/8). */
export function formationSlotRoles(formation: string, teamSize = 11): string[] {
  const mapped = FORMATION_SLOT_ROLES_11[formation];
  if (mapped) return [...mapped];
  return genericSlotRoles(formation);
}

/** Which line (GK/DEF/MID/FWD) a pitch slot belongs to. */
export function slotLine(
  slotIndex: number,
  formation: string,
  teamSize = 11
): PositionLine {
  const role = formationSlotRoles(formation, teamSize)[slotIndex];
  if (role === "GK") return "GK";
  if (role === "DEF" || role === "LB" || role === "RB" || role === "CB" || role === "LWB" || role === "RWB") {
    return "DEF";
  }
  if (role === "FWD" || role === "ST" || role === "CF" || role === "LW" || role === "RW") {
    return "FWD";
  }
  if (role === "MID" || role === "CM" || role === "CDM" || role === "CAM" || role === "LM" || role === "RM") {
    return "MID";
  }
  return "MID";
}

export function slotAcceptedPositions(
  slotIndex: number,
  formation: string,
  teamSize = 11
): readonly Position[] {
  const role = formationSlotRoles(formation, teamSize)[slotIndex] ?? "MID";
  return SLOT_ACCEPTED[role] ?? LINE_POSITIONS[slotLine(slotIndex, formation, teamSize)];
}

export function playerCanPlaySlot(
  playerPositions: readonly Position[] | readonly string[],
  slotIndex: number,
  formation: string,
  teamSize = 11
): boolean {
  const slotRole = formationSlotRoles(formation, teamSize)[slotIndex];
  if (!slotRole) return false;

  const positions = new Set(normalizePlayerPositions([...playerPositions]));
  if (positions.size === 0) return false;

  // Small-sided rows only.
  if (slotRole === "DEF" || slotRole === "MID" || slotRole === "FWD") {
    return [...positions].some((p) => LINE_POSITIONS[slotRole].includes(p));
  }

  const accepted = new Set(SLOT_ACCEPTED[slotRole] ?? [slotRole as Position]);
  return [...positions].some((p) => accepted.has(p));
}

export function playerCanPlayLine(
  playerPositions: readonly Position[],
  line: PositionLine
): boolean {
  const allowed = new Set<Position>(LINE_POSITIONS[line]);
  return playerPositions.some((p) => allowed.has(p));
}

/** Empty slot indices this player can fill in the given formation. */
export function eligibleSlots(
  playerPositions: readonly Position[] | readonly string[],
  formation: string,
  occupiedSlots: ReadonlySet<number>,
  teamSize = 11
): number[] {
  const normalized = normalizePlayerPositions([...playerPositions]);
  const size = formationSlotCount(formation);
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    if (occupiedSlots.has(i)) continue;
    if (playerCanPlaySlot(normalized, i, formation, teamSize)) {
      out.push(i);
    }
  }
  return out;
}

export function slotLineLabel(
  slotIndex: number,
  formation: string,
  teamSize = 11
): string {
  return formationSlotRoles(formation, teamSize)[slotIndex] ?? "MID";
}
