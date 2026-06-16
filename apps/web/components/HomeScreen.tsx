"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOURNAMENT_LABELS } from "@draftoff/shared";
import { useLobbyList } from "@/hooks/useLobbyList";
import { useSocket } from "@/hooks/useSocket";
import { getName, setName, setUserId } from "@/lib/identity";
import { sanitiseName } from "@/lib/name";

export function HomeScreen() {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobbies } = useLobbyList();

  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDisplayName(sanitiseName(getName())), []);

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
          Pick 11 players and simulate a tournament with friends!
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
              onChange={(e) => setDisplayName(sanitiseName(e.target.value))}
              placeholder="e.g. Gaffer"
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
              {lobbies.map((l) => {
                const meta = (
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">
                      {l.name || `${l.hostName}'s draft`}
                    </p>
                    <p className="text-xs font-medium text-white/50">
                      {l.playerCount}/{l.numTeams} teams · {l.teamSize}-a-side ·{" "}
                      {TOURNAMENT_LABELS[l.tournamentType]}
                    </p>
                  </div>
                );

                if (l.status !== "LOBBY") {
                  return (
                    <li
                      key={l.code}
                      className="inset flex items-center justify-between px-4 py-3 opacity-70"
                    >
                      {meta}
                      <span className="pill bg-black/40 text-white/60">
                        {l.status === "DRAFTING" ? "Drafting" : "In play"}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      onClick={() => join(l.code)}
                      disabled={!nameReady || busy || l.playerCount >= l.maxPlayers}
                      className="inset group flex w-full items-center justify-between px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-gold hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-black"
                    >
                      {meta}
                      <span className="title shrink-0 text-[0.55rem] text-gold opacity-60 transition group-hover:opacity-100">
                        Join ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
