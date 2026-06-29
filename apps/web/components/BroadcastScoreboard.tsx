"use client";

import type { GoalEvent } from "@draftoff/shared";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function BroadcastScoreboard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  minute,
  homeColor,
  awayColor,
  goals,
  homeUserId,
  awayUserId,
  halftime = false,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  homeColor: string;
  awayColor: string;
  goals: GoalEvent[];
  homeUserId: string;
  awayUserId: string;
  halftime?: boolean;
}) {
  const homeGoals = goals.filter((g) => g.userId === homeUserId);
  const awayGoals = goals.filter((g) => g.userId === awayUserId);

  return (
    <div className="broadcast-scoreboard-wrap">
      <div className="broadcast-scoreboard">
        <div
          className="broadcast-scoreboard-team broadcast-scoreboard-team-home"
          style={{ background: `linear-gradient(180deg, ${homeColor} 0%, ${shade(homeColor, -20)} 100%)` }}
        >
          <span className="broadcast-scoreboard-name">{homeName}</span>
          <span className="broadcast-scoreboard-pts">{homeScore}</span>
        </div>

        <div className="broadcast-scoreboard-center">
          <div className="broadcast-scoreboard-clock">
            {halftime ? "HT" : `${pad(Math.min(minute, 90))}:00`}
          </div>
          <div className="broadcast-scoreboard-tab">Scoreboard</div>
        </div>

        <div
          className="broadcast-scoreboard-team broadcast-scoreboard-team-away"
          style={{ background: `linear-gradient(180deg, ${awayColor} 0%, ${shade(awayColor, -20)} 100%)` }}
        >
          <span className="broadcast-scoreboard-pts broadcast-scoreboard-pts-away">{awayScore}</span>
          <span className="broadcast-scoreboard-name broadcast-scoreboard-name-away">{awayName}</span>
        </div>
      </div>

      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="broadcast-scorers-drop">
          <div className="broadcast-scorers-col" style={{ borderColor: homeColor }}>
            {homeGoals.length === 0 ? (
              <span className="broadcast-scorers-empty">—</span>
            ) : (
              homeGoals.map((g, i) => (
                <div key={`${g.minute}-${i}`} className="broadcast-scorer-row">
                  <span className="broadcast-scorer-dot" style={{ background: homeColor }} />
                  <span className="broadcast-scorer-min">{g.minute}&apos;</span>
                  <span className="broadcast-scorer-name">{shortName(g.scorerName)}</span>
                </div>
              ))
            )}
          </div>
          <div className="broadcast-scorers-col" style={{ borderColor: awayColor }}>
            {awayGoals.length === 0 ? (
              <span className="broadcast-scorers-empty">—</span>
            ) : (
              awayGoals.map((g, i) => (
                <div key={`${g.minute}-${i}`} className="broadcast-scorer-row">
                  <span className="broadcast-scorer-dot" style={{ background: awayColor }} />
                  <span className="broadcast-scorer-min">{g.minute}&apos;</span>
                  <span className="broadcast-scorer-name">{shortName(g.scorerName)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

function shade(hex: string, pct: number): string {
  if (!hex.startsWith("#") || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + pct));
  const b = Math.max(0, Math.min(255, (n & 255) + pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
