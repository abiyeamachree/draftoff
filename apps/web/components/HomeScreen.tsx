"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TOURNAMENT_LABELS, type LobbySummary } from "@draftoff/shared";
import { useLobbyList } from "@/hooks/useLobbyList";
import { useSocket } from "@/hooks/useSocket";
import { getName, setName, setUserId } from "@/lib/identity";
import { sanitiseName } from "@/lib/name";

function lobbyMeta(l: LobbySummary) {
  return (
    <div className="min-w-0">
      <p className="truncate font-extrabold">{l.name || `${l.hostName}'s draft`}</p>
      <p className="text-xs font-medium text-white/50">
        {l.playerCount}/{l.numTeams} teams · {l.teamSize}-a-side ·{" "}
        {TOURNAMENT_LABELS[l.tournamentType]}
      </p>
    </div>
  );
}

function closedStatusLabel(status: LobbySummary["status"]) {
  if (status === "DRAFTING") return "Drafting";
  if (status === "SIMULATING") return "In play";
  if (status === "FINISHED") return "Finished";
  return status;
}

export function HomeScreen() {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobbies } = useLobbyList();

  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);

  const openLobbies = useMemo(
    () => lobbies.filter((l) => l.status === "LOBBY"),
    [lobbies]
  );
  const closedLobbies = useMemo(
    () => lobbies.filter((l) => l.status !== "LOBBY"),
    [lobbies]
  );

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
        <p className="text-xl text-white/80">
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
            <span className="pill bg-black/40 text-white/60">
              {openLobbies.length} live
            </span>
          </div>

          {openLobbies.length === 0 ? (
            <p className="py-10 text-center font-bold text-white/40">
              No open lobbies. Create the first one!
            </p>
          ) : (
            <ul className="space-y-2">
              {openLobbies.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => join(l.code)}
                    disabled={!nameReady || busy || l.playerCount >= l.maxPlayers}
                    className="inset group flex w-full items-center justify-between px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-gold hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-black"
                  >
                    {lobbyMeta(l)}
                    <span className="title shrink-0 text-[0.55rem] text-gold opacity-60 transition group-hover:opacity-100">
                      Join ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {closedLobbies.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setClosedOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-bold uppercase tracking-wide text-white/50">
                  Closed lobbies
                </span>
                <span className="flex items-center gap-2 text-xs text-white/40">
                  {closedLobbies.length}
                  <span className="text-gold">{closedOpen ? "▾" : "▸"}</span>
                </span>
              </button>
              {closedOpen && (
                <ul className="mt-2 space-y-2">
                  {closedLobbies.map((l) => (
                    <li
                      key={l.code}
                      className="inset flex items-center justify-between px-4 py-3 opacity-70"
                    >
                      {lobbyMeta(l)}
                      <span className="pill bg-black/40 text-white/60">
                        {closedStatusLabel(l.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
