"use client";

import { getRatingVisual } from "@/lib/ratingVisual";

export function StatBar({
  value,
  max = 99,
  size = "md",
  label,
  showRecall = false,
  className = "",
}: {
  value: number;
  max?: number;
  size?: "xs" | "sm" | "md";
  label?: string;
  showRecall?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = (clamped / max) * 100;
  const visual = getRatingVisual(clamped);

  return (
    <div
      className={`stat-bar stat-bar-${size} ${visual.elite ? "stat-bar-elite" : ""} ${className}`.trim()}
      aria-label={label ? `${label} rating bar` : "Rating bar"}
    >
      {label ? <span className="stat-bar-label">{label}</span> : null}
      <div className={`stat-bar-track ${visual.track}`.trim()}>
        <div className="stat-bar-fill" style={{ width: `${pct}%` }}>
          <div
            className={`stat-bar-body ${visual.fill} ${visual.pattern} ${visual.glow}`.trim()}
          />
          {showRecall && visual.recall ? (
            <span
              className={`stat-bar-recall ${visual.recallClass}`.trim()}
              aria-hidden
            >
              {visual.recall}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
