"use client";

import type { LobbyPlayer, Match, TournamentState } from "@draftoff/shared";
import { TeamBadge } from "@/components/TeamBadge";
import { fixtureStripe, teamVisual } from "@/lib/teamVisual";

function playerFor(players: LobbyPlayer[], userId: string | null) {
  if (!userId) return undefined;
  return players.find((p) => p.userId === userId);
}

function FixtureRow({
  match,
  idx,
  players,
  isHost,
  simmingId,
  onSim,
  onWatch,
}: {
  match: Match;
  idx: number;
  players: LobbyPlayer[];
  isHost: boolean;
  simmingId?: string | null;
  onSim: (match: Match) => void;
  onWatch: (match: Match) => void;
}) {
  const played = match.status === "played" && match.result;
  const home = match.homeUserId;
  const away = match.awayUserId;
  const homeP = playerFor(players, home);
  const awayP = playerFor(players, away);
  const homeV = teamVisual(homeP, home);
  const awayV = teamVisual(awayP, away);
  const score = played
    ? `${match.result!.homeScore} – ${match.result!.awayScore}`
    : "vs";
  const highlight = match.isHumanFixture === true;

  return (
    <li
      className={`fixtures-row overflow-hidden rounded-lg border ${
        highlight ? "border-gold/60" : "border-white/15"
      }`}
      style={{ background: fixtureStripe(homeV, awayV) }}
    >
      <div className="flex flex-wrap items-center gap-2 bg-black/30 px-3 py-2 backdrop-blur-[1px]">
        <span className="w-8 text-xs text-white/40">#{idx + 1}</span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <TeamBadge visual={homeV} />
          <span className="truncate font-semibold drop-shadow-sm">{homeV.name}</span>
          <span className="mx-1 font-mono text-white/80">{score}</span>
          <span className="truncate font-semibold drop-shadow-sm">{awayV.name}</span>
          <TeamBadge visual={awayV} />
        </span>
        {isHost && (
          <div className="flex gap-2">
            {!played ? (
              <button
                type="button"
                disabled={simmingId === match.matchId}
                className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold hover:bg-emerald-600 disabled:opacity-50"
                onClick={() => onSim(match)}
              >
                {simmingId === match.matchId ? "Simulating…" : "Sim"}
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-sky-700 px-3 py-1 text-xs font-bold hover:bg-sky-600"
                onClick={() => onWatch(match)}
              >
                Watch
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function FixturesView({
  tournament,
  players,
  isHost,
  onSim,
  onWatch,
  simmingId,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
  isHost: boolean;
  onSim: (match: Match) => void;
  onWatch: (match: Match) => void;
  simmingId?: string | null;
}) {
  const isGroups = tournament.type === "groups_knockout";
  let fixtureIdx = 0;

  return (
    <div className="fixtures-view space-y-4">
      <h3 className="text-lg font-bold text-gold">Fixtures</h3>
      {!isHost && (
        <p className="text-sm text-white/50">Only the host can sim or watch matches.</p>
      )}

      {isGroups ? (
        tournament.rounds.map((groupMatches, gi) => {
          const groupLabel = groupMatches[0]?.group ?? String.fromCharCode(65 + gi);
          return (
            <section key={groupLabel} className="space-y-2">
              <h4 className="title text-sm text-gold">Group {groupLabel}</h4>
              <ul className="fixtures-list space-y-2">
                {groupMatches.map((match) => {
                  const idx = fixtureIdx++;
                  return (
                    <FixtureRow
                      key={match.matchId}
                      match={match}
                      idx={idx}
                      players={players}
                      isHost={isHost}
                      simmingId={simmingId}
                      onSim={onSim}
                      onWatch={onWatch}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })
      ) : (
        <ul className="fixtures-list space-y-2">
          {tournament.rounds.flat().map((match, idx) => (
            <FixtureRow
              key={match.matchId}
              match={match}
              idx={idx}
              players={players}
              isHost={isHost}
              simmingId={simmingId}
              onSim={onSim}
              onWatch={onWatch}
            />
          ))}
        </ul>
      )}

      {tournament.standings.length > 0 && (
        <div className="standings-table overflow-x-auto rounded-lg bg-black/30 p-3">
          <h4 className="mb-2 text-sm font-bold text-white/80">Standings</h4>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-white/50">
                <th className="py-1">#</th>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {tournament.standings.map((row, i) => {
                const p = playerFor(players, row.userId);
                const v = teamVisual(p, row.userId);
                return (
                  <tr key={row.userId} className="border-t border-white/10">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <TeamBadge visual={v} size={14} />
                        {v.name}
                      </span>
                    </td>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                    <td className="font-bold text-gold">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tournament.complete && tournament.winnerUserId && (
        <p className="flex items-center justify-center gap-2 text-center text-lg font-bold text-gold">
          Champion:
          <TeamBadge visual={teamVisual(playerFor(players, tournament.winnerUserId), tournament.winnerUserId)} />
          {teamVisual(playerFor(players, tournament.winnerUserId), tournament.winnerUserId).name}
        </p>
      )}
    </div>
  );
}
