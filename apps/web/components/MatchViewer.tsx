"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LobbyPlayer, MatchResult } from "@draftoff/shared";
import { defaultFormation, getIconKitColors } from "@draftoff/shared";
import { MatchPitch, highlightFromAnim } from "@/components/MatchPitch";

const MS_PER_MINUTE = 700;

function nameFor(players: LobbyPlayer[], userId: string) {
  return players.find((p) => p.userId === userId)?.displayName ?? userId.slice(0, 8);
}

export function MatchViewer({
  result,
  players,
  onClose,
}: {
  result: MatchResult;
  players: LobbyPlayer[];
  onClose: () => void;
}) {
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const homePlayer = players.find((p) => p.userId === result.homeUserId);
  const awayPlayer = players.find((p) => p.userId === result.awayUserId);
  const homeKit = getIconKitColors(homePlayer?.icon);
  const awayKit = getIconKitColors(awayPlayer?.icon);

  const maxMinute = useMemo(
    () =>
      Math.max(
        90,
        ...result.commentary.map((c) => c.minute),
        ...result.animations.map((a) => a.minute)
      ),
    [result]
  );

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setMinute((m) => {
        if (m >= maxMinute) {
          setPlaying(false);
          return maxMinute;
        }
        return m + 1;
      });
    }, MS_PER_MINUTE);
    return () => window.clearInterval(id);
  }, [playing, maxMinute]);

  const visibleLines = result.commentary.filter((c) => c.minute <= minute);
  const activeAnims = result.animations.filter((a) => a.minute <= minute);
  const latestAnim = activeAnims[activeAnims.length - 1];
  const ballX = latestAnim?.ballX ?? 50;
  const ballY = latestAnim?.ballY ?? 50;
  const highlight = highlightFromAnim(latestAnim, result.homeUserId, result.awayUserId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleLines.length]);

  const jumpTo = useCallback((m: number) => {
    setMinute(m);
    setPlaying(false);
  }, []);

  return (
    <div className="match-viewer">
      <div className="match-viewer-header flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-sm text-white/60 hover:text-white"
          onClick={onClose}
        >
          ← Fixtures
        </button>
        <span className="text-sm font-bold text-gold">
          {nameFor(players, result.homeUserId)} {result.homeScore} – {result.awayScore}{" "}
          {nameFor(players, result.awayUserId)}
        </span>
        <span className="match-viewer-minute">{minute}&apos;</span>
      </div>

      <div className="match-viewer-body">
        <div className="match-viewer-pitch">
          <MatchPitch
            homeFormation={homePlayer?.formation ?? defaultFormation(11)}
            awayFormation={awayPlayer?.formation ?? defaultFormation(11)}
            homeKit={homeKit}
            awayKit={awayKit}
            ballX={ballX}
            ballY={ballY}
            highlight={highlight}
          />
        </div>

        <div className="match-viewer-feed">
          <div className="match-viewer-feed-header">
            <span>{minute}&apos;</span>
            <button
              type="button"
              className="match-viewer-play-btn"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? "⏸" : "▶"}
            </button>
          </div>
          <div ref={scrollRef} className="match-viewer-commentary">
            {visibleLines.map((line, i) => (
              <div
                key={`${line.minute}-${i}`}
                className={`match-commentary-line ${
                  line.highlight ? "match-commentary-highlight" : ""
                }`}
              >
                {line.minute > 0 && (
                  <span className="match-commentary-minute">{line.minute}</span>
                )}
                <span>{line.text}</span>
              </div>
            ))}
          </div>
          <div className="match-viewer-scrubber">
            <input
              type="range"
              min={0}
              max={maxMinute}
              value={minute}
              onChange={(e) => jumpTo(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
