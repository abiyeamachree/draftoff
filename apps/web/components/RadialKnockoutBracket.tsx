"use client";

import { useMemo } from "react";
import type { LobbyPlayer, Match, TournamentState } from "@draftoff/shared";
import {
  knockoutBracketSeeds,
  knockoutMatches,
  knockoutQualificationConfig,
} from "@draftoff/shared";
import { TeamBadge } from "@/components/TeamBadge";
import { teamVisual } from "@/lib/teamVisual";

const CX = 200;
const CY = 200;

function bracketRoundCounts(slots: number): number[] {
  const counts: number[] = [];
  let n = slots / 2;
  while (n >= 1) {
    counts.push(n);
    n /= 2;
  }
  return counts;
}

function bracketRadii(roundCount: number): number[] {
  const maxR = 168;
  const minR = 26;
  const steps = roundCount + 1;
  return Array.from({ length: steps }, (_, i) =>
    steps === 1 ? maxR : maxR - (i / (steps - 1)) * (maxR - minR)
  );
}

function slotAngle(i: number, slots: number) {
  return -Math.PI / 2 + (i / slots) * Math.PI * 2;
}

function polar(r: number, i: number, slots: number) {
  const a = slotAngle(i, slots);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), a };
}

function innerNode(round: number, matchIndex: number, count: number, radii: number[]) {
  const a = -Math.PI / 2 + (matchIndex / count) * Math.PI * 2 + Math.PI / count;
  const r = radii[round] ?? radii[radii.length - 1]!;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), a };
}

function winnerPathForSlot(
  slot: number,
  seeds: (string | null)[],
  ko: Match[]
): boolean {
  const uid = seeds[slot];
  if (!uid) return false;
  for (const m of ko) {
    if (m.status === "played" && m.result?.winnerUserId === uid) return true;
  }
  return false;
}

function BracketTeamSlot({
  uid,
  players,
  index,
  slots,
  outerRadius,
}: {
  uid: string | null;
  players: LobbyPlayer[];
  index: number;
  slots: number;
  outerRadius: number;
}) {
  const p = uid ? players.find((x) => x.userId === uid) : undefined;
  const v = uid ? teamVisual(p, uid) : null;
  const pos = polar(outerRadius + 14, index, slots);
  const pctX = (pos.x / 400) * 100;
  const pctY = (pos.y / 400) * 100;
  const label = v?.name ?? "TBD";

  return (
    <div
      className="radial-bracket-team"
      style={{ left: `${pctX}%`, top: `${pctY}%` }}
    >
      {v ? (
        <TeamBadge visual={v} size={22} />
      ) : (
        <span className="radial-bracket-tbd">?</span>
      )}
      <span className="radial-bracket-team-tooltip">{label}</span>
    </div>
  );
}

export function RadialKnockoutBracket({
  tournament,
  players,
  preview = false,
}: {
  tournament: TournamentState;
  players: LobbyPlayer[];
  preview?: boolean;
}) {
  const config = knockoutQualificationConfig(tournament);
  const slots = config.knockoutSize;
  const seeds = knockoutBracketSeeds(tournament);
  const ko = knockoutMatches(tournament);

  const roundCounts = useMemo(() => bracketRoundCounts(slots), [slots]);
  const radii = useMemo(() => bracketRadii(roundCounts.length), [roundCounts.length]);

  const caption =
    config.thirdPlaceCount > 0
      ? `Top ${config.directPerGroup} per group + ${config.thirdPlaceCount} best 3rd · fills when qualified`
      : `Top ${config.directPerGroup} per group · fills when qualified`;

  return (
    <div className="radial-bracket-wrap">
      <svg
        viewBox="0 0 400 400"
        className="radial-bracket-svg"
        role="img"
        aria-label="Knockout bracket"
      >
        <defs>
          <radialGradient id="bracket-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.35)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={175} fill="url(#bracket-glow)" />

        {roundCounts[0] !== undefined &&
          Array.from({ length: roundCounts[0] }, (_, i) => {
            const a = polar(radii[0]!, i * 2, slots);
            const b = polar(radii[0]!, i * 2 + 1, slots);
            const mid = innerNode(1, i, roundCounts[0]!, radii);
            const hi =
              winnerPathForSlot(i * 2, seeds, ko) ||
              winnerPathForSlot(i * 2 + 1, seeds, ko);
            const stroke = hi ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)";
            const sw = hi ? 2.5 : 1;
            return (
              <g key={`r0-${i}`}>
                <line x1={a.x} y1={a.y} x2={mid.x} y2={mid.y} stroke={stroke} strokeWidth={sw} />
                <line x1={b.x} y1={b.y} x2={mid.x} y2={mid.y} stroke={stroke} strokeWidth={sw} />
                <circle cx={mid.x} cy={mid.y} r={3} fill={hi ? "#fff" : "rgba(255,255,255,0.35)"} />
              </g>
            );
          })}

        {roundCounts.slice(1).map((count, ri) => {
          const round = ri + 2;
          const prevCount = roundCounts[ri]!;
          return Array.from({ length: count }, (_, i) => {
            const from = innerNode(round - 1, i * 2, prevCount, radii);
            const from2 = innerNode(round - 1, i * 2 + 1, prevCount, radii);
            const to = innerNode(round, i, count, radii);
            const stroke = "rgba(255,255,255,0.14)";
            return (
              <g key={`r${round}-${i}`}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={stroke} strokeWidth={1} />
                <line x1={from2.x} y1={from2.y} x2={to.x} y2={to.y} stroke={stroke} strokeWidth={1} />
                <circle cx={to.x} cy={to.y} r={2.5} fill="rgba(255,255,255,0.3)" />
              </g>
            );
          });
        })}

        <circle cx={CX} cy={CY} r={18} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={1.5} />
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize={16} fill="#fde047">
          🏆
        </text>

        {roundCounts.length >= 2 &&
          [0, 1].map((i) => {
            const from = innerNode(roundCounts.length, i, 2, radii);
            return (
              <line
                key={`final-${i}`}
                x1={from.x}
                y1={from.y}
                x2={CX}
                y2={CY}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={1}
              />
            );
          })}
      </svg>

      <div className="radial-bracket-teams">
        {seeds.map((uid, i) => (
          <BracketTeamSlot
            key={i}
            uid={uid}
            players={players}
            index={i}
            slots={slots}
            outerRadius={radii[0]!}
          />
        ))}
      </div>

      {preview && ko.length === 0 && (
        <p className="radial-bracket-caption">{caption}</p>
      )}
    </div>
  );
}
