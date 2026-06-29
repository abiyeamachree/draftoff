"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GoalEvent, LobbyPlayer, MatchResult } from "@draftoff/shared";
import { defaultFormation, displayScoreAtMinute, getIconKitColors } from "@draftoff/shared";
import type { QuickSimPhase } from "@draftoff/shared";
import { BroadcastScoreboard } from "@/components/BroadcastScoreboard";
import { GoalBanner } from "@/components/GoalBanner";
import { HalftimeOverlay } from "@/components/HalftimeOverlay";
import { MatchPitch } from "@/components/MatchPitch";
import {
  countSentOff,
  fullSceneForMatch,
} from "@/lib/matchPitchScenes";
import { teamVisual } from "@/lib/teamVisual";
import { useHalftimeBreak } from "@/lib/useHalftimeBreak";

const MS_PER_MINUTE = 700;

export function MatchViewer({
  result,
  players,
  minute,
  phase = "normal",
  playing,
  isDriver,
  onMinuteChange,
  onPlayingChange,
  onBack,
}: {
  result: MatchResult;
  players: LobbyPlayer[];
  minute: number;
  phase?: QuickSimPhase;
  playing: boolean;
  isDriver: boolean;
  onMinuteChange: (minute: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef(minute);
  const prevGoalCountRef = useRef(0);
  const [bannerGoal, setBannerGoal] = useState<GoalEvent | null>(null);

  minuteRef.current = minute;

  const homePlayer = players.find((p) => p.userId === result.homeUserId);
  const awayPlayer = players.find((p) => p.userId === result.awayUserId);
  const homeV = teamVisual(homePlayer, result.homeUserId);
  const awayV = teamVisual(awayPlayer, result.awayUserId);
  const homeKit = getIconKitColors(homePlayer?.icon);
  const awayKit = getIconKitColors(awayPlayer?.icon);
  const homeKitColors = { ...homeKit, primary: homeV.color, accent: homeV.color };
  const awayKitColors = { ...awayKit, primary: awayV.color, accent: awayV.color };

  const maxMinute = useMemo(
    () =>
      Math.max(
        90,
        ...result.commentary.map((c) => c.minute),
        ...result.animations.map((a) => a.minute)
      ),
    [result]
  );

  const halftime = useHalftimeBreak(
    minute,
    maxMinute,
    isDriver && playing,
    onMinuteChange,
    () => onPlayingChange(false),
    () => onPlayingChange(true)
  );

  useEffect(() => {
    if (!isDriver || !playing || halftime) return;
    const id = window.setInterval(() => {
      const m = minuteRef.current;
      if (m >= maxMinute) {
        onPlayingChange(false);
        return;
      }
      if (m === 45 && maxMinute > 45) return;
      onMinuteChange(m + 1);
    }, MS_PER_MINUTE);
    return () => window.clearInterval(id);
  }, [isDriver, playing, halftime, maxMinute, onMinuteChange, onPlayingChange]);

  const goalsSoFar = result.goals.filter((g) => g.minute <= minute);
  const visibleLines = result.commentary.filter((c) => c.minute <= minute);
  const homeFormation = homePlayer?.formation ?? defaultFormation(11);
  const awayFormation = awayPlayer?.formation ?? defaultFormation(11);

  const sentOff = useMemo(
    () => countSentOff(result.animations, minute, result.homeUserId, result.awayUserId),
    [result.animations, result.homeUserId, result.awayUserId, minute]
  );

  const activeAnims = result.animations.filter((a) => a.minute <= minute);
  const latestAnim = activeAnims[activeAnims.length - 1];
  const scene = useMemo(
    () => fullSceneForMatch(homeFormation, awayFormation, latestAnim, sentOff),
    [homeFormation, awayFormation, latestAnim, sentOff]
  );
  const ballX = latestAnim?.ballX ?? 50;
  const ballY = latestAnim?.ballY ?? 50;
  const eventLabel = latestAnim?.label ?? null;

  const score = displayScoreAtMinute(result, minute, phase);

  useEffect(() => {
    if (goalsSoFar.length > prevGoalCountRef.current) {
      const newest = goalsSoFar[goalsSoFar.length - 1]!;
      setBannerGoal(newest);
    }
    prevGoalCountRef.current = goalsSoFar.length;
  }, [goalsSoFar.length, goalsSoFar]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleLines.length]);

  const jumpTo = useCallback(
    (m: number) => {
      onMinuteChange(m);
      onPlayingChange(false);
    },
    [onMinuteChange, onPlayingChange]
  );

  const bannerTeam =
    bannerGoal?.userId === result.homeUserId ? homeV : awayV;

  return (
    <div className="match-viewer">
      <div className="match-viewer-toolbar">
        <button type="button" className="match-viewer-back" onClick={onBack}>
          ← Sim
        </button>
      </div>

      <BroadcastScoreboard
        homeName={homeV.name}
        awayName={awayV.name}
        homeScore={score.home}
        awayScore={score.away}
        minute={minute}
        homeColor={homeV.color}
        awayColor={awayV.color}
        goals={goalsSoFar}
        homeUserId={result.homeUserId}
        awayUserId={result.awayUserId}
        halftime={halftime}
      />

      {halftime && <HalftimeOverlay />}

      {bannerGoal && (
        <GoalBanner
          teamName={bannerTeam.name}
          scorerName={bannerGoal.scorerName}
          minute={bannerGoal.minute}
          teamColor={bannerTeam.color}
          onDone={() => setBannerGoal(null)}
        />
      )}

      <div className="match-viewer-body">
        <div className="match-viewer-pitch">
          <MatchPitch
            homeKit={homeKitColors}
            awayKit={awayKitColors}
            ballX={ballX}
            ballY={ballY}
            scene={scene}
            eventLabel={eventLabel}
          />
        </div>

        <div className="match-viewer-feed">
          <div className="match-viewer-feed-header">
            <span>Commentary</span>
            <span className="text-white/50">{minute}&apos;</span>
          </div>
          <div ref={scrollRef} className="match-viewer-commentary">
            {visibleLines.length === 0 ? (
              <p className="match-commentary-line text-white/40">Match in progress…</p>
            ) : (
              visibleLines.map((line, i) => (
                <div
                  key={`${line.minute}-${i}`}
                  className={`match-commentary-line ${
                    line.highlight ? "match-commentary-highlight" : ""
                  }`}
                >
                  {line.minute > 0 && (
                    <span className="match-commentary-minute">{line.minute}&apos;</span>
                  )}
                  <span>{line.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="match-viewer-scrubber">
            <input
              type="range"
              min={0}
              max={maxMinute}
              value={minute}
              disabled={!isDriver}
              onChange={(e) => jumpTo(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
