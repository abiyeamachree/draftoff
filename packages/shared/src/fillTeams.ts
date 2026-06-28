/** Labels for non-human league fill spots (clubs or national teams). */

export const FILL_NT_PREFIX = "NT: ";

/** e.g. "Arsenal (25/26)" */
export function clubFillLabel(club: string, season: string): string {
  return `${club} (${season})`;
}

/** e.g. "NT: France (25/26)" */
export function nationFillLabel(nation: string, season: string): string {
  return `${FILL_NT_PREFIX}${nation} (${season})`;
}

export function isNationFillLabel(label: string): boolean {
  return label.trimStart().startsWith(FILL_NT_PREFIX);
}

export type FillLabelKind = "club" | "nation";

/** Parse a fill label into kind, display name, and season. */
export function parseFillLabel(label: string): {
  kind: FillLabelKind;
  name: string;
  season: string;
} {
  const trimmed = (label || "").trim();
  if (trimmed.startsWith(FILL_NT_PREFIX)) {
    const rest = trimmed.slice(FILL_NT_PREFIX.length);
    const m = rest.match(/^(.+) \(([^)]+)\)$/);
    return m
      ? { kind: "nation", name: m[1].trim(), season: m[2].trim() }
      : { kind: "nation", name: rest, season: "" };
  }
  const m = trimmed.match(/^(.+) \(([^)]+)\)$/);
  return m
    ? { kind: "club", name: m[1].trim(), season: m[2].trim() }
    : { kind: "club", name: trimmed, season: "" };
}

/** Human-readable name for fixtures / lobby (strips NT prefix). */
export function fillDisplayName(label: string): string {
  return parseFillLabel(label).name;
}
