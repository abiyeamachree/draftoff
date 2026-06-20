import { PLAYER_ICONS } from "./types/lobby.js";

/** Two-tone kit colours derived from each lobby emoji avatar. */
export type IconKitColors = {
  primary: string;
  accent: string;
  text: string;
};

export const ICON_KIT_COLORS: Record<(typeof PLAYER_ICONS)[number], IconKitColors> = {
  "⚽": { primary: "#5eb8e8", accent: "#ffffff", text: "#0c3a5e" },
  "🔥": { primary: "#e63900", accent: "#ff9500", text: "#ffffff" },
  "🦁": { primary: "#d4a017", accent: "#8b4513", text: "#ffffff" },
  "🐉": { primary: "#16a34a", accent: "#14532d", text: "#ffffff" },
  "👑": { primary: "#7c3aed", accent: "#fbbf24", text: "#ffffff" },
  "🦅": { primary: "#1e3a5f", accent: "#ffffff", text: "#ffffff" },
  "🦈": { primary: "#546e7a", accent: "#263238", text: "#ffffff" },
  "🐺": { primary: "#64748b", accent: "#334155", text: "#ffffff" },
  "🤖": { primary: "#94a3b8", accent: "#475569", text: "#0f172a" },
  "👽": { primary: "#84cc16", accent: "#365314", text: "#ffffff" },
  "💀": { primary: "#1f2937", accent: "#f3f4f6", text: "#ffffff" },
  "🎯": { primary: "#dc2626", accent: "#ffffff", text: "#ffffff" },
  "⚡": { primary: "#facc15", accent: "#1e1b4b", text: "#1e1b4b" },
  "🌟": { primary: "#7c3aed", accent: "#fde047", text: "#ffffff" },
  "🚀": { primary: "#ef4444", accent: "#ffffff", text: "#ffffff" },
  "🎩": { primary: "#111827", accent: "#b91c1c", text: "#ffffff" },
};

export function getIconKitColors(icon: string | undefined | null): IconKitColors {
  if (icon && icon in ICON_KIT_COLORS) {
    return ICON_KIT_COLORS[icon as keyof typeof ICON_KIT_COLORS];
  }
  return ICON_KIT_COLORS["⚽"];
}
