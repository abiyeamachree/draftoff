"use client";

import type { FootballPlayer } from "@draftoff/shared";

/**
 * summary stats, peak badge, and a draft button when used in the pool.
 */
export function PlayerCard({
  player,
  onDraft,
  disabled,
}: {
  player: FootballPlayer;
  onDraft?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-black/30 p-3">
      <div>
        <div className="font-semibold">{player.name}</div>
        <div className="text-xs text-white/60">
          {player.bestPosition} · {player.team || "Free agent"} · {player.edition}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-pitch px-2 py-1 text-sm font-bold">
          {player.overall}
        </span>
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
