"use client";

import type { CSSProperties } from "react";
import type { IconKitColors, PitchPlayerDot } from "@draftoff/shared";

export function MatchPitch({
  homeKit,
  awayKit,
  ballX = 50,
  ballY = 50,
  scene,
  eventLabel,
  highlight,
}: {
  homeKit?: IconKitColors;
  awayKit?: IconKitColors;
  ballX?: number;
  ballY?: number;
  scene?: PitchPlayerDot[] | null;
  eventLabel?: string | null;
  highlight?: { team: "home" | "away"; index: number } | null;
}) {
  const dots = scene ?? [];

  const homeStyle = homeKit
    ? ({
        "--kit-primary": homeKit.primary,
        "--kit-accent": homeKit.accent,
      } as CSSProperties)
    : undefined;

  const awayStyle = awayKit
    ? ({
        "--kit-primary": awayKit.primary,
        "--kit-accent": awayKit.accent,
      } as CSSProperties)
    : undefined;

  return (
    <div className="match-pitch">
      <div className="match-pitch-grass" />
      <div className="match-pitch-markings">
        <div className="match-pitch-halfway" />
        <div className="match-pitch-circle" />
        <div className="match-pitch-box match-pitch-box-top" />
        <div className="match-pitch-box match-pitch-box-bottom" />
        <div className="match-pitch-goal-area match-pitch-goal-top" />
        <div className="match-pitch-goal-area match-pitch-goal-bottom" />
      </div>

      {eventLabel && (
        <div className="match-pitch-event-label">{eventLabel}</div>
      )}

      <div className="match-pitch-players">
        {dots.map((pos, i) => {
          const isHome = pos.team === "home";
          const active = highlight?.index === i && highlight.team === pos.team;
          return (
            <div
              key={`${pos.team}-${i}`}
              className={`match-pitch-dot match-pitch-dot-${pos.team} ${active ? "match-pitch-dot-active" : ""}`}
              style={{
                ...(isHome ? homeStyle : awayStyle),
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            />
          );
        })}
      </div>

      <div
        className="match-pitch-ball"
        style={{ left: `${ballX}%`, top: `${ballY}%` }}
      />
    </div>
  );
}

export function highlightFromAnim(
  anim: { teamUserId: string; slotIndex?: number } | undefined,
  homeUserId: string,
  awayUserId: string
): { team: "home" | "away"; index: number } | null {
  if (!anim || anim.slotIndex == null) return null;
  if (anim.teamUserId === homeUserId) {
    return { team: "home", index: anim.slotIndex };
  }
  if (anim.teamUserId === awayUserId) {
    return { team: "away", index: anim.slotIndex };
  }
  return null;
}
