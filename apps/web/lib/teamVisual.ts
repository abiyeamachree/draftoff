import type { LobbyPlayer } from "@draftoff/shared";
import { getIconKitColors, parseFillLabel } from "@draftoff/shared";
import { CLUB_PRIMARY } from "@/lib/clubColors.generated";
import { nationPrimaryColor } from "@/lib/nationKitColors";

const FALLBACK_CLUB = "#4B5563";

export function clubPrimaryColor(club: string): string {
  const { name } = parseFillLabel(club);
  return CLUB_PRIMARY[name] ?? CLUB_PRIMARY[club] ?? FALLBACK_CLUB;
}

export type TeamVisualKind = "human" | "nation" | "club" | "bot";

export interface TeamVisual {
  kind: TeamVisualKind;
  name: string;
  /** Left/right fixture stripe colour */
  color: string;
  /** Emoji for human managers */
  emoji?: string;
  /** Nation label for flags */
  nation?: string;
}

export function teamVisual(player: LobbyPlayer | undefined, userId: string | null): TeamVisual {
  if (!player) {
    return { kind: "bot", name: userId?.slice(0, 6) ?? "?", color: "#374151" };
  }
  if (player.isFiller) {
    if (player.fillKind === "nation") {
      const color = nationPrimaryColor(player.displayName);
      return {
        kind: "nation",
        name: player.displayName,
        nation: player.displayName,
        color,
      };
    }
    if (player.fillKind === "club") {
      const color = clubPrimaryColor(player.displayName);
      return { kind: "club", name: player.displayName, color };
    }
    return { kind: "bot", name: player.displayName, color: "#475569" };
  }
  const kit = getIconKitColors(player.icon);
  return {
    kind: "human",
    name: player.displayName,
    emoji: player.icon,
    color: kit.primary,
  };
}

export function fixtureStripe(home: TeamVisual, away: TeamVisual): string {
  return `linear-gradient(90deg, ${home.color} 0%, ${away.color} 100%)`;
}
