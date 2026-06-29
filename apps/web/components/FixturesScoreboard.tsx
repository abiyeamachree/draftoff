"use client";

import type { LobbyPlayer, Match } from "@draftoff/shared";
import {
  displayScoreAtMinute,
  type LiveMatchState,
  type QuickSimPhase,
} from "@draftoff/shared";
import { TeamBadge } from "@/components/TeamBadge";
import { teamVisual } from "@/lib/teamVisual";

function teamGradient(color: string) {
  return `linear-gradient(180deg, ${color} 0%, ${shade(color, -28)} 100%)`;
}

function shade(hex: string, pct: number): string {
  if (!hex.startsWith("#") || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + pct));
  const b = Math.max(0, Math.min(255, (n & 255) + pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function FixturesScoreboard({
  focusMatch,
  liveSession,
  players,
  isHost,
  pendingCount,
  onSim,
  onWatch,
  onSimAll,
  onPause,
  halftime = false,
}: {
  focusMatch: Match | null;
  liveSession: LiveMatchState | null;
  players: LobbyPlayer[];
  isHost: boolean;
  pendingCount: number;
  onSim: () => void;
  onWatch: () => void;
  onSimAll: () => void;
  onPause: () => void;
  halftime?: boolean;
}) {
  const simActive = liveSession?.mode === "sim";
  const watchActive = liveSession?.mode === "watch";
  const displayResult = liveSession?.result ?? null;
  const displayPhase: QuickSimPhase = liveSession?.phase ?? "normal";
  const displayPaused = liveSession?.paused ?? false;
  const clockMinute = liveSession?.minute ?? 0;

  const show = liveSession
    ? {
        homeUserId: liveSession.homeUserId,
        awayUserId: liveSession.awayUserId,
      }
    : focusMatch
      ? {
          homeUserId: focusMatch.homeUserId!,
          awayUserId: focusMatch.awayUserId!,
        }
      : null;

  if (!show) {
    return (
      <div className="fixtures-scoreboard fixtures-scoreboard-idle panel">
        <p className="text-center text-sm text-white/60">Tournament complete</p>
      </div>
    );
  }

  const homeP = players.find((p) => p.userId === show.homeUserId);
  const awayP = players.find((p) => p.userId === show.awayUserId);
  const homeV = teamVisual(homeP, show.homeUserId);
  const awayV = teamVisual(awayP, show.awayUserId);

  let homeScore = 0;
  let awayScore = 0;
  let scoreLabel: string | undefined;
  let phaseLabel: string | null = null;
  let progress = 0;

  if (liveSession && displayResult) {
    const score = displayScoreAtMinute(displayResult, clockMinute, displayPhase);
    homeScore = score.home;
    awayScore = score.away;
    scoreLabel = score.label;
    phaseLabel =
      displayPhase === "extra_time" && clockMinute > 90
        ? "ET"
        : displayPhase === "penalties" && clockMinute >= 120
          ? "Pens"
          : null;
    const progressMax =
      displayPhase === "penalties" ? 120 : displayPhase === "extra_time" ? 120 : 90;
    progress = progressMax > 0 ? (clockMinute / progressMax) * 100 : 0;
  } else if (focusMatch?.status === "played" && focusMatch.result) {
    homeScore = focusMatch.result.homeScore;
    awayScore = focusMatch.result.awayScore;
    progress = 100;
  }

  const canStart = Boolean(focusMatch?.status === "pending" && isHost);
  const canWatch =
    Boolean(liveSession) ||
    focusMatch?.status === "played" ||
    canStart;
  const showPause = isHost && Boolean(liveSession) && (simActive || watchActive);
  const showSimAll = isHost && pendingCount > 0 && !watchActive;

  const statusKey = simActive
    ? "sim"
    : watchActive
      ? "watch"
      : canStart
        ? "next"
        : "final";

  const statusLabel =
    statusKey === "sim"
      ? "Live sim"
      : statusKey === "watch"
        ? "Watching"
        : statusKey === "next"
          ? "Up next"
          : "Final";

  const clockLabel = halftime
    ? "HT"
    : liveSession
      ? `${clockMinute}'`
      : "0'";

  return (
    <div className="fixtures-scoreboard">
      <div className="fixtures-scoreboard-header">
        <div className="fixtures-scoreboard-meta">
          <span className={`fixtures-scoreboard-status fixtures-scoreboard-status-${statusKey}`}>
            {statusLabel}
          </span>
          <span className="fixtures-scoreboard-clock">
            {clockLabel}
            {displayPaused && !halftime ? " · pause" : ""}
          </span>
        </div>
        {showSimAll && (
          <button
            type="button"
            className="fixtures-scoreboard-sim-all btn btn-grey"
            disabled={simActive && !displayPaused}
            onClick={onSimAll}
          >
            Sim all ({pendingCount})
          </button>
        )}
      </div>

      <div className="fixtures-scoreboard-match">
        <div
          className="fixtures-scoreboard-team fixtures-scoreboard-team-home"
          style={{ background: teamGradient(homeV.color) }}
        >
          <TeamBadge visual={homeV} size={20} />
          <span className="fixtures-scoreboard-team-name">{homeV.name}</span>
          <span className="fixtures-scoreboard-team-score">{homeScore}</span>
        </div>

        <div className="fixtures-scoreboard-center">
          <span className="fixtures-scoreboard-center-label">vs</span>
          {(scoreLabel || phaseLabel) && (
            <span className="fixtures-scoreboard-center-extra">
              {scoreLabel ? scoreLabel : ""}
              {phaseLabel ? ` ${phaseLabel}` : ""}
            </span>
          )}
        </div>

        <div
          className="fixtures-scoreboard-team fixtures-scoreboard-team-away"
          style={{ background: teamGradient(awayV.color) }}
        >
          <span className="fixtures-scoreboard-team-score">{awayScore}</span>
          <span className="fixtures-scoreboard-team-name">{awayV.name}</span>
          <TeamBadge visual={awayV} size={20} />
        </div>
      </div>

      <div className="fixtures-scoreboard-progress">
        <div className="fixtures-scoreboard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="fixtures-scoreboard-actions">
        {isHost && (
          <button
            type="button"
            className={`btn fixtures-scoreboard-action-sim${simActive ? " fixtures-scoreboard-action-active" : ""}`}
            disabled={simActive || (!canStart && !watchActive)}
            onClick={onSim}
          >
            Sim
          </button>
        )}
        {showPause && (
          <button
            type="button"
            className="btn btn-grey fixtures-scoreboard-action-pause"
            aria-label={displayPaused ? "Play" : "Pause"}
            onClick={onPause}
          >
            {displayPaused ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}
        <button
          type="button"
          className={`btn fixtures-scoreboard-action-watch${watchActive ? " fixtures-scoreboard-action-active" : ""}`}
          disabled={!canWatch || watchActive}
          onClick={onWatch}
        >
          Watch
        </button>
      </div>

      {!isHost && simActive && (
        <p className="fixtures-scoreboard-host-note">Host is simulating…</p>
      )}
    </div>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
      <rect x="2" y="1" width="3.5" height="12" fill="currentColor" />
      <rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 1.5v11l9-5.5-9-5.5z" fill="currentColor" />
    </svg>
  );
}
