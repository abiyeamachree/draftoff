"use client";

import type { CSSProperties } from "react";
import type { IconKitColors } from "@draftoff/shared";
import { formationRows, slotLineLabel } from "@draftoff/shared";
import type { HoverPlayer } from "@/components/PlayerHoverCard";
import { PlayerHoverCard } from "@/components/PlayerHoverCard";

/** Percent positions on one half: GK by the goal (bottom), attack toward halfway (top). */
function slotPositions(rowCounts: number[]): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const rows = rowCounts.length;
  const yGoal = 86;
  const yHalfway = 16;
  rowCounts.forEach((count, rowIdx) => {
    const y = rows === 1 ? 50 : yGoal - (rowIdx / (rows - 1)) * (yGoal - yHalfway);
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : 14 + (72 / Math.max(1, count - 1)) * i;
      positions.push({ x, y });
    }
  });
  return positions;
}

export function PitchView({
  formation,
  picks,
  header,
  compact = false,
  teamSize = 11,
  highlightSlots,
  onSlotClick,
  kitColors,
}: {
  formation: string;
  picks: (HoverPlayer | null)[];
  header?: React.ReactNode;
  compact?: boolean;
  teamSize?: number;
  highlightSlots?: number[];
  onSlotClick?: (slotIndex: number) => void;
  kitColors?: IconKitColors;
}) {
  const rowCounts = [1, ...formationRows(formation)];
  const positions = slotPositions(rowCounts);
  const highlightSet = new Set(highlightSlots ?? []);
  const interactive = Boolean(onSlotClick && highlightSlots && highlightSlots.length > 0);
  const kitStyle = kitColors
    ? ({
        "--kit-primary": kitColors.primary,
        "--kit-accent": kitColors.accent,
        "--kit-text": kitColors.text,
      } as CSSProperties)
    : undefined;

  return (
    <div className={`pitch ${compact ? "pitch-compact" : ""}`} style={kitStyle}>
      <div className="pitch-grass" />
      <div className="pitch-markings">
        <div className="pitch-halfway" />
        <div className="pitch-circle-arc" />
        <div className="pitch-box pitch-box-goal" />
        <div className="pitch-goal-area" />
        <div className="pitch-spot pitch-spot-pen" />
      </div>

      {header && <div className="pitch-header">{header}</div>}

      <div className="pitch-players">
        {positions.map((pos, i) => {
          const pick = picks[i] ?? null;
          const isGk = i === 0;
          const highlighted = highlightSet.has(i);
          const empty = !pick;
          const clickable = interactive && empty && highlighted;

          return (
            <div
              key={i}
              className="pitch-player"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {pick ? (
                <PlayerHoverCard player={pick} align="center" placement="below">
                  <div
                    className={`pitch-marker pitch-marker-filled ${
                      isGk ? "pitch-marker-gk" : ""
                    }`}
                  >
                    <span className="pitch-marker-label">
                      {pick.name.split(" ").pop()}
                    </span>
                  </div>
                </PlayerHoverCard>
              ) : (
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onSlotClick?.(i)}
                  className={`pitch-marker pitch-marker-empty ${
                    highlighted ? "pitch-marker-highlight" : ""
                  } ${clickable ? "pitch-marker-clickable" : ""}`}
                  title={
                    highlighted && empty
                      ? `Place here (${slotLineLabel(i, formation, teamSize)})`
                      : undefined
                  }
                >
                  {highlighted ? (
                    <span className="pitch-slot-label">
                      {slotLineLabel(i, formation, teamSize)}
                    </span>
                  ) : (
                    <span className="pitch-plus">+</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
