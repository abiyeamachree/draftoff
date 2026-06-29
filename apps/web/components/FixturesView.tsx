"use client";

import type { LobbyPlayer, Match, TournamentState } from "@draftoff/shared";
import { displayScoreAtMinute, type LiveMatchState } from "@draftoff/shared";
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
  myUserId,
  selectedMatchId,
  liveSession,
  onSelect,
}: {
  match: Match;
  idx: number;
  players: LobbyPlayer[];
  myUserId: string;
  selectedMatchId: string | null;
  liveSession: LiveMatchState | null;
  onSelect: (match: Match) => void;
}) {
  const isLive = liveSession?.matchId === match.matchId;
  const serverPlayed = match.status === "played" && match.result;
  const home = match.homeUserId;
  const away = match.awayUserId;
  const homeP = playerFor(players, home);
  const awayP = playerFor(players, away);
  const homeV = teamVisual(homeP, home);
  const awayV = teamVisual(awayP, away);
  const isMine = myUserId === home || myUserId === away;
  const isSelected = match.matchId === selectedMatchId;

  let score = "vs";
  if (isLive && liveSession?.result) {
    const s = displayScoreAtMinute(
      liveSession.result,
      liveSession.minute,
      liveSession.phase
    );
    score = `${s.home} – ${s.away}`;
  } else if (serverPlayed && !isLive) {
    score = `${match.result!.homeScore} – ${match.result!.awayScore}`;
  }

  return (
    <li>
      <button
        type="button"
        className={`fixtures-row fixtures-row-btn w-full overflow-hidden rounded-lg border text-left ${
          isMine ? "fixtures-row-mine" : "border-white/15"
        } ${isSelected ? "fixtures-row-selected" : ""} ${isLive ? "fixtures-row-live" : ""}`}
        style={{ background: fixtureStripe(homeV, awayV) }}
        onClick={() => onSelect(match)}
      >
        <div className="relative flex flex-wrap items-center gap-2 bg-black/30 px-3 py-2 backdrop-blur-[1px]">
          <span className="flex w-12 shrink-0 items-center gap-1 text-xs text-white/40">
            #{idx + 1}
            {match.group ? (
              <span className="rounded bg-black/40 px-1 text-[0.55rem] font-bold text-gold/80">
                {match.group}
              </span>
            ) : null}
          </span>
          <div className="fixtures-match-line min-w-0 flex-1">
            <div className="fixtures-side fixtures-side-home">
              <TeamBadge visual={homeV} />
              <span className="truncate font-semibold drop-shadow-sm">{homeV.name}</span>
            </div>
            <span className="fixtures-vs shrink-0 font-mono text-white/80">{score}</span>
            <div className="fixtures-side fixtures-side-away">
              <span className="truncate font-semibold drop-shadow-sm">{awayV.name}</span>
              <TeamBadge visual={awayV} />
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

export function FixturesView({
  tournament,
  players,
  myUserId,
  selectedMatchId,
  liveSession,
  onSelectMatch,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
  myUserId: string;
  selectedMatchId: string | null;
  liveSession: LiveMatchState | null;
  onSelectMatch: (match: Match) => void;
}) {
  let fixtureIdx = 0;
  const isGroups = tournament.type === "groups_knockout";

  return (
    <div className="fixtures-list-panel">
      <h3 className="fixtures-panel-heading">Fixtures</h3>
      <div className="fixtures-list-scroll">
        {isGroups ? (
          tournament.rounds.map((matchday, mdi) => (
            <section key={`md-${mdi}`} className="fixtures-matchday">
              <h4 className="fixtures-matchday-title">Matchday {mdi + 1}</h4>
              <ul className="fixtures-list space-y-2">
                {matchday.map((match) => {
                  const idx = fixtureIdx++;
                  return (
                    <FixtureRow
                      key={match.matchId}
                      match={match}
                      idx={idx}
                      players={players}
                      myUserId={myUserId}
                      selectedMatchId={selectedMatchId}
                      liveSession={liveSession}
                      onSelect={onSelectMatch}
                    />
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <ul className="fixtures-list space-y-2">
            {tournament.rounds.flat().map((match, idx) => (
              <FixtureRow
                key={match.matchId}
                match={match}
                idx={idx}
                players={players}
                myUserId={myUserId}
                selectedMatchId={selectedMatchId}
                liveSession={liveSession}
                onSelect={onSelectMatch}
              />
            ))}
          </ul>
        )}
      </div>

      {tournament.complete && tournament.winnerUserId && (
        <p className="mt-3 flex items-center justify-center gap-2 text-center text-sm font-bold text-gold">
          Champion:
          <TeamBadge
            visual={teamVisual(
              playerFor(players, tournament.winnerUserId),
              tournament.winnerUserId
            )}
          />
          {teamVisual(playerFor(players, tournament.winnerUserId), tournament.winnerUserId).name}
        </p>
      )}
    </div>
  );
}
