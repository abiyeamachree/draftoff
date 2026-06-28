"use client";

import { useEffect, useMemo, useState } from "react";
import type { LobbyPlayer, SquadSummary } from "@draftoff/shared";
import { defaultFormation, getIconKitColors } from "@draftoff/shared";
import type { DraftState } from "@draftoff/shared";
import { PitchView } from "@/components/PitchView";
import { squadPicksBySlot } from "@/components/PickPanel";
import { StatBar } from "@/components/StatBar";

const REVEAL_MS = 3200;

export function TeamReveal({
  players,
  draft,
  summaries,
  teamSize,
  onComplete,
}: {
  players: LobbyPlayer[];
  draft: DraftState;
  summaries: SquadSummary[];
  teamSize: number;
  onComplete: () => void;
}) {
  const humanIds = useMemo(
    () => new Set(players.filter((p) => !p.isFiller).map((p) => p.userId)),
    [players]
  );
  const squads = useMemo(
    () => draft.squads.filter((s) => humanIds.has(s.userId)),
    [draft.squads, humanIds]
  );
  const [index, setIndex] = useState(0);
  const total = squads.length;

  useEffect(() => {
    if (total === 0) {
      onComplete();
      return;
    }
    if (index >= total) {
      onComplete();
      return;
    }
    const timer = window.setTimeout(() => setIndex((i) => i + 1), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, total, onComplete]);

  if (total === 0 || index >= total) {
    return null;
  }

  const squad = squads[index];
  const manager = players.find((p) => p.userId === squad.userId);
  const summary = summaries.find((s) => s.userId === squad.userId);
  const formation = manager?.formation || defaultFormation(teamSize);
  const kitColors = getIconKitColors(manager?.icon);
  const picks = squadPicksBySlot(squad.players, teamSize);

  return (
    <div className="team-reveal">
      <p className="mb-2 text-center text-xs uppercase tracking-widest text-white/50">
        Manager {index + 1} of {total}
      </p>
      <div className="team-reveal-flash mx-auto max-w-md">
        <PitchView
          formation={formation}
          picks={picks}
          teamSize={teamSize}
          kitColors={kitColors}
          header={
            <>
              <span className="text-lg leading-none">{manager?.icon ?? "⚽"}</span>
              <span className="truncate text-[0.55rem] font-extrabold text-gold">
                {manager?.displayName ?? "Manager"}
              </span>
            </>
          }
        />
      </div>
      <div className="team-reveal-footer mx-auto mt-4 max-w-sm space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">{manager?.icon ?? "⚽"}</span>
          <span className="text-xl font-bold text-gold">{manager?.displayName ?? "—"}</span>
        </div>
        {summary ? (
          <div className="space-y-1.5 rounded-lg bg-black/40 p-3">
            <StatBar label="OVR" value={summary.overall} size="sm" showRecall />
            <StatBar label="ATT" value={summary.attack} size="sm" showRecall />
            <StatBar label="MID" value={summary.midfield} size="sm" showRecall />
            <StatBar label="DEF" value={summary.defense} size="sm" showRecall />
          </div>
        ) : null}
      </div>
    </div>
  );
}
