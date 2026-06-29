"use client";

import type { LobbyPlayer, TournamentState } from "@draftoff/shared";
import { aggregateTournamentStats } from "@draftoff/shared";
import { AutoCarousel } from "@/components/AutoCarousel";
import { TeamBadge } from "@/components/TeamBadge";
import { teamVisual } from "@/lib/teamVisual";

function StatList({
  title,
  entries,
  players,
  emptyLabel,
}: {
  title: string;
  entries: { userId: string; name: string; count: number }[];
  players: LobbyPlayer[];
  emptyLabel: string;
}) {
  return (
    <div className="fixtures-stats-slide">
      <h4 className="fixtures-panel-title">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-xs text-white/40">{emptyLabel}</p>
      ) : (
        <ul className="fixtures-stat-list">
          {entries.map((e, i) => {
            const p = players.find((x) => x.userId === e.userId);
            const v = teamVisual(p, e.userId);
            return (
              <li key={`${e.userId}-${e.name}-${i}`} className="fixtures-stat-row">
                <span className="fixtures-stat-rank">{i + 1}</span>
                <span className="fixtures-stat-name truncate">{e.name}</span>
                {e.userId ? <TeamBadge visual={v} size={12} /> : null}
                <span className="fixtures-stat-count">{e.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TournamentStatsPanel({
  tournament,
  players,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
}) {
  const stats = aggregateTournamentStats(tournament);

  const slides = [
    <StatList key="goals" title="Top scorers" entries={stats.goals} players={players} emptyLabel="No goals yet" />,
    <StatList key="assists" title="Most assists" entries={stats.assists} players={players} emptyLabel="No assists yet" />,
    <StatList
      key="cs"
      title="Clean sheets"
      entries={stats.cleanSheets}
      players={players}
      emptyLabel="No clean sheets yet"
    />,
    <StatList key="yc" title="Yellow cards" entries={stats.yellowCards} players={players} emptyLabel="No yellow cards" />,
    <StatList key="rc" title="Red cards" entries={stats.redCards} players={players} emptyLabel="No red cards" />,
  ];

  return (
    <div className="fixtures-panel fixtures-stats-panel">
      <h3 className="fixtures-panel-heading">Player stats</h3>
      <AutoCarousel slides={slides} intervalMs={5000} />
    </div>
  );
}
