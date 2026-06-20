import type { Position } from "./types/player.js";

/** Standard outfield/GK codes used on the pitch. */
export const PLAYABLE_POSITIONS = new Set<string>([
  "GK",
  "RB",
  "RWB",
  "CB",
  "LB",
  "LWB",
  "CDM",
  "CM",
  "CAM",
  "RM",
  "LM",
  "RW",
  "LW",
  "CF",
  "ST",
]);

/** Bench / squad-role codes from SoFIFA — never shown or used for slot eligibility. */
const NON_PLAYABLE = new Set(["SUB", "RES"]);

/** Map SoFIFA variant codes to the slot labels we use on the pitch. */
const POSITION_ALIASES: Record<string, Position> = {
  LCB: "CB",
  RCB: "CB",
  LCM: "CM",
  RCM: "CM",
  LDM: "CDM",
  RDM: "CDM",
  LAM: "CAM",
  RAM: "CAM",
  LS: "ST",
  RS: "ST",
  LF: "LW",
  RF: "RW",
};

/** Parse + clean a raw SoFIFA `positions` string into playable position codes. */
export function normalizePlayerPositions(raw: readonly string[] | string): Position[] {
  const parts =
    typeof raw === "string"
      ? raw.replace(/,/g, " ").split(/\s+/).filter(Boolean)
      : raw;

  const seen = new Set<Position>();
  const out: Position[] = [];

  for (const part of parts) {
    const code = part.trim().toUpperCase();
    if (!code || NON_PLAYABLE.has(code)) continue;

    const mapped = (POSITION_ALIASES[code] ?? code) as Position;
    if (!PLAYABLE_POSITIONS.has(mapped) || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }

  return out;
}
