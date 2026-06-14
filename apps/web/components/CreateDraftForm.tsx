"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LobbySettings, TeamSize } from "@draftoff/shared";
import { useSocket } from "@/hooks/useSocket";
import { getName, setName, setUserId } from "@/lib/identity";

const TEAM_SIZES: TeamSize[] = [5, 7, 8, 11];

export function CreateDraftForm() {
  const router = useRouter();
  const { socket } = useSocket();

  const [displayName, setDisplayName] = useState(getName);
  const [teamSize, setTeamSize] = useState<TeamSize>(5);
  const [draftTimerSeconds, setDraftTimerSeconds] = useState(30);
  const [tournamentType, setTournamentType] =
    useState<LobbySettings["tournamentType"]>("knockout");
  const [peakCardsEnabled, setPeakCardsEnabled] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameReady = displayName.trim().length > 0;

  function create() {
    if (!nameReady || busy) return;
    setError(null);
    setBusy(true);
    setName(displayName.trim());

    const settings: LobbySettings = {
      teamSize,
      draftTimerSeconds,
      tournamentType,
      peakCardsEnabled,
    };

    socket.emit(
      "lobby:create",
      { displayName: displayName.trim(), settings },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setUserId(res.data.code, res.data.userId);
        router.push(`/lobby/${res.data.code}`);
      }
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm font-bold uppercase tracking-wide text-white/50 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="title mt-3 text-2xl text-gold">Create a draft</h1>
        <p className="mt-2 text-lg text-white/70">Set the rules, then share the link.</p>
      </header>

      <div className="panel space-y-5">
        <label className="block">
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Display name
          </span>
          <input
            className="field mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Gaffer"
            maxLength={24}
          />
        </label>

        <div>
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Squad size
          </span>
          <div className="mt-1 flex gap-2">
            {TEAM_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setTeamSize(size)}
                className={`btn flex-1 ${teamSize === size ? "" : "btn-grey"}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Pick timer: <span className="font-mono text-gold">{draftTimerSeconds}s</span>
          </span>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={draftTimerSeconds}
            onChange={(e) => setDraftTimerSeconds(Number(e.target.value))}
            className="mt-2 w-full accent-gold"
          />
        </label>

        <div>
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Tournament format
          </span>
          <div className="mt-1 flex gap-2">
            {(["knockout", "round_robin"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTournamentType(type)}
                className={`btn flex-1 ${tournamentType === type ? "" : "btn-grey"}`}
              >
                {type === "knockout" ? "Knockout" : "Round robin"}
              </button>
            ))}
          </div>
        </div>

        <label className="inset flex items-center justify-between px-3 py-3">
          <span>
            <span className="block font-extrabold">Peak cards</span>
            <span className="text-xs text-white/50">
              Use each player&apos;s best-ever edition
            </span>
          </span>
          <input
            type="checkbox"
            checked={peakCardsEnabled}
            onChange={(e) => setPeakCardsEnabled(e.target.checked)}
            className="h-6 w-6 accent-gold"
          />
        </label>

        <button
          type="button"
          onClick={create}
          disabled={!nameReady || busy}
          className="btn w-full py-4 text-sm"
        >
          {busy ? "Creating…" : "Create lobby"}
        </button>

        {error && <p className="text-sm font-bold text-red-300">{error}</p>}
      </div>
    </div>
  );
}
