"use client";

import type { CSSProperties } from "react";
import type { IconKitColors } from "@draftoff/shared";
import { formationRows } from "@draftoff/shared";

function halfSlotPositions(rowCounts: number[], team: "home" | "away"): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  rowCounts.forEach((count, rowIdx) => {
    const baseY = team === "home" ? 86 - rowIdx * 14 : 14 + rowIdx * 14;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : 14 + (72 / Math.max(1, count - 1)) * i;
      positions.push({ x, y: baseY });
    }
  });
  return positions;
}

export function MatchPitch({
  homeFormation,
  awayFormation,
  homeKit,
  awayKit,
  ballX = 50,
  ballY = 50,
  highlight,
}: {
  homeFormation: string;
  awayFormation: string;
  homeKit?: IconKitColors;
  awayKit?: IconKitColors;
  ballX?: number;
  ballY?: number;
  highlight?: { teamUserId: "home" | "away"; slotIndex: number } | null;
}) {
  const homeRows = [1, ...formationRows(homeFormation)];
  const awayRows = [1, ...formationRows(awayFormation)];
  const homePos = halfSlotPositions(homeRows, "home");
  const awayPos = halfSlotPositions(awayRows, "away");

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

      <div className="match-pitch-players">
        {homePos.map((pos, i) => {
          const active = highlight?.teamUserId === "home" && highlight.slotIndex === i;
          return (
            <div
              key={`h-${i}`}
              className={`match-pitch-dot match-pitch-dot-home ${active ? "match-pitch-dot-active" : ""}`}
              style={{ ...homeStyle, left: `${pos.x}%`, top: `${pos.y}%` }}
            />
          );
        })}
        {awayPos.map((pos, i) => {
          const active = highlight?.teamUserId === "away" && highlight.slotIndex === i;
          return (
            <div
              key={`a-${i}`}
              className={`match-pitch-dot match-pitch-dot-away ${active ? "match-pitch-dot-active" : ""}`}
              style={{ ...awayStyle, left: `${pos.x}%`, top: `${pos.y}%` }}
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
): { teamUserId: "home" | "away"; slotIndex: number } | null {
  if (!anim || anim.slotIndex == null) return null;
  if (anim.teamUserId === homeUserId) {
    return { teamUserId: "home", slotIndex: anim.slotIndex };
  }
  if (anim.teamUserId === awayUserId) {
    return { teamUserId: "away", slotIndex: anim.slotIndex };
  }
  return null;
}
