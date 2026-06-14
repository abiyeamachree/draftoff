"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LobbySummary } from "@draftoff/shared";
import { useLobbyList } from "@/hooks/useLobbyList";
import { useSocket } from "@/hooks/useSocket";
import { getName, setName, setUserId } from "@/lib/identity";

const TOURNAMENT_LABEL: Record<LobbySummary["tournamentType"], string> = {
  knockout: "Knockout",
  round_robin: "Round robin",
};

export function HomeScreen() {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobbies } = useLobbyList();

  const [displayName, setDisplayName] = useState(getName);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameReady = displayName.trim().length > 0;

  function goCreate() {
    if (!nameReady) return;
    setName(displayName.trim());
    router.push("/create");
  }

  function join(code: string) {
    if (!nameReady || busy) return;
    setError(null);
    setBusy(true);
    setName(displayName.trim());
    socket.emit(
      "lobby:join",
      { code: code.toUpperCase(), displayName: displayName.trim() },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setUserId(code.toUpperCase(), res.data.userId);
        router.push(`/lobby/${code.toUpperCase()}`);
      }
    );
  }

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="title text-3xl text-gold sm:text-4xl">DRAFTOFF</h1>
        <p className="mt-4 text-xl text-white/80">
          Draft football legends. Simulate glory.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel space-y-5">
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

          <button
            type="button"
            onClick={goCreate}
            disabled={!nameReady}
            className="btn w-full py-4 text-sm"
          >
            Create a draft
          </button>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            or join by code
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex gap-2">
            <input
              className="field uppercase tracking-[0.3em]"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={6}
            />
            <button
              type="button"
              onClick={() => join(joinCode)}
              disabled={!nameReady || joinCode.length < 6 || busy}
              className="btn btn-grey shrink-0"
            >
              Join
            </button>
          </div>

          {error && <p className="text-sm font-bold text-red-300">{error}</p>}
          {!nameReady && (
            <p className="text-xs text-white/40">
              Enter a display name to create or join.
            </p>
          )}
        </section>

        <section className="panel space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="title text-sm">Open lobbies</h2>
            <span className="pill bg-black/40 text-white/60">{lobbies.length} live</span>
          </div>

          {lobbies.length === 0 ? (
            <p className="py-10 text-center font-bold text-white/40">
              No lobbies yet. Create the first one!
            </p>
          ) : (
            <ul className="space-y-2">
              {lobbies.map((l) => (
                <li
                  key={l.code}
                  className="inset flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">
                      {l.hostName}
                      <span className="ml-2 font-mono text-gold">{l.code}</span>
                    </p>
                    <p className="text-xs font-medium text-white/50">
                      {l.playerCount}/{l.maxPlayers} · {l.teamSize}-a-side ·{" "}
                      {TOURNAMENT_LABEL[l.tournamentType]}
                    </p>
                  </div>
                  {l.status === "LOBBY" ? (
                    <button
                      type="button"
                      onClick={() => join(l.code)}
                      disabled={!nameReady || busy || l.playerCount >= l.maxPlayers}
                      className="btn shrink-0 px-3 py-1.5 text-sm"
                    >
                      Join
                    </button>
                  ) : (
                    <span className="pill bg-black/40 text-white/60">
                      {l.status === "DRAFTING" ? "Drafting" : "In play"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
