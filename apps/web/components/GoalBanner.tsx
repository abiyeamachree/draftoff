"use client";

import { useEffect, useState } from "react";

function SoccerBallIcon() {
  return (
    <svg className="goal-splash-ball" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="28" fill="white" stroke="#111" strokeWidth="2" />
      <polygon points="32,12 38,22 32,28 26,22" fill="#111" />
      <polygon points="32,28 44,26 48,36 38,40" fill="#111" />
      <polygon points="32,28 20,26 16,36 26,40" fill="#111" />
      <polygon points="26,40 32,52 38,40" fill="#111" />
    </svg>
  );
}

function SpeedLines() {
  return (
    <svg className="goal-splash-lines" viewBox="0 0 120 48" aria-hidden>
      <path d="M8 24 Q40 8 72 24" fill="none" stroke="#fde047" strokeWidth="5" strokeLinecap="round" />
      <path d="M0 30 Q35 18 68 30" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <path d="M12 16 Q44 4 76 16" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function GoalBanner({
  teamName,
  scorerName,
  minute,
  teamColor,
  onDone,
}: {
  teamName: string;
  scorerName: string;
  minute: number;
  teamColor: string;
  accentColor?: string;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 3400);
    return () => window.clearTimeout(t);
  }, [teamName, scorerName, minute, onDone]);

  if (!visible) return null;

  return (
    <div className="goal-splash" role="status" aria-live="assertive">
      <div
        className="goal-splash-track"
        style={{
          background: `linear-gradient(90deg, ${shade(teamColor, -30)} 0%, ${teamColor} 35%, ${shade(teamColor, 10)} 100%)`,
        }}
      >
        <div className="goal-splash-left">
          <SoccerBallIcon />
          <SpeedLines />
        </div>
        <div className="goal-splash-text-wrap">
          <span className="goal-splash-goal">GOAL!</span>
          <span className="goal-splash-meta">
            {scorerName} · {teamName} · {minute}&apos;
          </span>
        </div>
      </div>
    </div>
  );
}

function shade(hex: string, pct: number): string {
  if (!hex.startsWith("#") || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + pct));
  const b = Math.max(0, Math.min(255, (n & 255) + pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
