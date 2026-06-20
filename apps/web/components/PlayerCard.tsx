"use client";

import type { FootballPlayer } from "@draftoff/shared";
import { NationFlag } from "@/components/NationFlag";
import { PlayerHoverCard } from "@/components/PlayerHoverCard";
import { StatBar } from "@/components/StatBar";

/**
 * summary stats, peak badge, and a draft button when used in the pool.
 */
export function PlayerCard({
  player,
  onDraft,
  disabled,
  hideRatings = false,
}: {
  player: FootballPlayer;
  onDraft?: () => void;
  disabled?: boolean;
  hideRatings?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-black/30 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <NationFlag nation={player.nation} size={20} />
        <PlayerHoverCard player={player} align="left">
          <div className="min-w-0">
            <div className="truncate font-semibold">{player.name}</div>
            <div className="text-xs text-white/60">
              {player.bestPosition} · {player.team || "Free agent"} · {player.edition}
            </div>
          </div>
        </PlayerHoverCard>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!hideRatings && (
          <StatBar value={player.overall} size="sm" className="w-20" />
        )}
        {onDraft && (
          <button
            type="button"
            onClick={onDraft}
            disabled={disabled}
            className="rounded-md bg-white/10 px-3 py-1 text-sm font-semibold hover:bg-white/20 disabled:opacity-40"
          >
            Draft
          </button>
        )}
      </div>
    </div>
  );
}
