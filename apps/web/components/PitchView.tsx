"use client";

import { formationRows } from "@draftoff/shared";

type Pick = { name: string; overall: number };

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
}: {
  formation: string;
  picks: Pick[];
  header?: React.ReactNode;
  compact?: boolean;
}) {
  const rowCounts = [1, ...formationRows(formation)];
  const positions = slotPositions(rowCounts);

  let slotIndex = 0;
  const slots: (Pick | null)[] = [];
  for (const count of rowCounts) {
    for (let i = 0; i < count; i++) {
      slots.push(picks[slotIndex] ?? null);
      slotIndex += 1;
    }
  }

  return (
    <div className={`pitch ${compact ? "pitch-compact" : ""}`}>
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
          const pick = slots[i] ?? null;
          const isGk = i === 0;
          return (
            <div
              key={i}
              className="pitch-player"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div
                className={`pitch-dot ${isGk ? "pitch-dot-gk" : pick ? "pitch-dot-filled" : "pitch-dot-empty"}`}
              >
                {pick ? (
                  <span className="pitch-rating">{pick.overall}</span>
                ) : (
                  <span className="pitch-plus">+</span>
                )}
              </div>
              {pick && (
                <span className="pitch-name" title={pick.name}>
                  {pick.name.split(" ").pop()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
