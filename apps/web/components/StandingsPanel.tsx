"use client";

import type { LobbyPlayer, TournamentState } from "@draftoff/shared";
import {
  groupLabels,
  groupStandings,
  isKnockoutPhase,
} from "@draftoff/shared";
import { AutoCarousel } from "@/components/AutoCarousel";
import { RadialKnockoutBracket } from "@/components/RadialKnockoutBracket";
import { TeamBadge } from "@/components/TeamBadge";
import { teamVisual } from "@/lib/teamVisual";

function playerFor(players: LobbyPlayer[], userId: string | null) {
  if (!userId) return undefined;
  return players.find((p) => p.userId === userId);
}

function GroupTable({
  group,
  tournament,
  players,
}: {
  group: string;
  tournament: TournamentState;
  players: LobbyPlayer[];
}) {
  const rows = groupStandings(tournament, group);

  return (
    <div className="fixtures-standings-slide">
      <h4 className="fixtures-panel-title">Group {group}</h4>
      <table className="fixtures-mini-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const p = playerFor(players, row.userId);
            const v = teamVisual(p, row.userId);
            return (
              <tr key={row.userId}>
                <td>{i + 1}</td>
                <td>
                  <span className="inline-flex items-center gap-1">
                    <TeamBadge visual={v} size={14} />
                    <span className="truncate">{v.name}</span>
                  </span>
                </td>
                <td>{row.played}</td>
                <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className="text-gold">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeagueTable({
  tournament,
  players,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
}) {
  return (
    <div className="fixtures-standings-slide">
      <h4 className="fixtures-panel-title">League table</h4>
      <table className="fixtures-mini-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {tournament.standings.map((row, i) => {
            const p = playerFor(players, row.userId);
            const v = teamVisual(p, row.userId);
            return (
              <tr key={row.userId}>
                <td>{i + 1}</td>
                <td>
                  <span className="inline-flex items-center gap-1">
                    <TeamBadge visual={v} size={14} />
                    <span className="truncate">{v.name}</span>
                  </span>
                </td>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className="text-gold">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KnockoutBracketSlide({
  tournament,
  players,
  preview,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
  preview?: boolean;
}) {
  return (
    <div className="fixtures-standings-slide fixtures-bracket-slide">
      <h4 className="fixtures-panel-title">Knockout bracket</h4>
      <RadialKnockoutBracket tournament={tournament} players={players} preview={preview} />
    </div>
  );
}

export function StandingsPanel({
  tournament,
  players,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
}) {
  const isGroups = tournament.type === "groups_knockout";
  const isLeague =
    tournament.type === "round_robin" || tournament.type === "double_round_robin";
  const inKnockout = isKnockoutPhase(tournament);
  const groups = groupLabels(tournament);

  const slides = [];

  if (isLeague) {
    slides.push(
      <LeagueTable key="league" tournament={tournament} players={players} />
    );
  } else if (isGroups) {
    if (!inKnockout) {
      for (const g of groups) {
        slides.push(
          <GroupTable key={g} group={g} tournament={tournament} players={players} />
        );
      }
      slides.push(
        <KnockoutBracketSlide
          key="bracket-preview"
          tournament={tournament}
          players={players}
          preview
        />
      );
    } else {
      slides.push(
        <KnockoutBracketSlide key="bracket" tournament={tournament} players={players} />
      );
    }
  } else {
    slides.push(
      <KnockoutBracketSlide key="bracket" tournament={tournament} players={players} />
    );
  }

  return (
    <div className="fixtures-panel fixtures-standings-panel">
      <h3 className="fixtures-panel-heading">Standings</h3>
      <AutoCarousel slides={slides} />
    </div>
  );
}
