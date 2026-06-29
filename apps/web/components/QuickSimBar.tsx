"use client";

import { useEffect, useRef, useState } from "react";
import type { LobbyPlayer, MatchResult } from "@draftoff/shared";
import {
  displayScoreAtMinute,
  type QuickSimPhase,
} from "@draftoff/shared";
import { TeamBadge } from "@/components/TeamBadge";
import { teamVisual } from "@/lib/teamVisual";

export function QuickSimBar({
  result,
  players,
  homeUserId,
  awayUserId,
  durationMs,
  maxMinute,
  phase,
  paused = false,
  onComplete,
}: {
  result: MatchResult;
  players: LobbyPlayer[];
  homeUserId: string;
  awayUserId: string;
  durationMs: number;
  maxMinute: number;
  phase: QuickSimPhase;
  paused?: boolean;
  onComplete: () => void;
}) {
  const [minute, setMinute] = useState(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const pausedRef = useRef(paused);
  onCompleteRef.current = onComplete;
  pausedRef.current = paused;

  const homeP = players.find((p) => p.userId === homeUserId);
  const awayP = players.find((p) => p.userId === awayUserId);
  const homeV = teamVisual(homeP, homeUserId);
  const awayV = teamVisual(awayP, awayUserId);

  useEffect(() => {
    doneRef.current = false;
    setMinute(0);

    let elapsed = 0;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      if (!pausedRef.current) {
        elapsed += now - last;
      }
      last = now;

      const t = Math.min(1, elapsed / durationMs);
      setMinute(Math.floor(t * maxMinute));

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setMinute(maxMinute);
        onCompleteRef.current();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result.matchId, durationMs, maxMinute]);

  const score = displayScoreAtMinute(result, minute, phase);
  const phaseLabel =
    phase === "extra_time" && minute > 90
      ? "ET"
      : phase === "penalties" && minute >= 120
        ? "Pens"
        : null;

  return (
    <div className="quick-sim-bar inset space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-white/50">
        <span>Quick sim</span>
        <span className="font-mono text-gold">
          {minute}&apos;{phaseLabel ? ` · ${phaseLabel}` : ""}
          {paused ? " · paused" : ""}
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm font-bold">
        <TeamBadge visual={homeV} />
        <span className="truncate">{homeV.name}</span>
        <span className="font-mono text-lg text-gold">
          {score.label ? `${score.home}–${score.away} (${score.label})` : `${score.home} – ${score.away}`}
        </span>
        <span className="truncate">{awayV.name}</span>
        <TeamBadge visual={awayV} />
      </div>
      <div className="quick-sim-progress">
        <div
          className="quick-sim-progress-fill"
          style={{ width: `${(minute / maxMinute) * 100}%` }}
        />
      </div>
    </div>
  );
}
