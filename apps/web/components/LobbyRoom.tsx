"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOURNAMENT_LABELS } from "@draftoff/shared";
import { useLobby } from "@/hooks/useLobby";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";

export function LobbyRoom({ code }: { code: string }) {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobby } = useLobby(code);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const myUserId = getUserId(code);
  const isHost = !!lobby && myUserId === lobby.hostId;

  useEffect(() => {
    if (lobby?.status === "DRAFTING") {
      router.push(`/draft/${code}`);
    }
  }, [lobby?.status, code, router]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/lobby/${code}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked, field stays selectable */
    }
  }

  function start() {
    if (busy) return;
    setError(null);
    setBusy(true);
    socket.emit("lobby:start", { code }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  }

  if (!lobby) {
    return (
      <section className="mx-auto max-w-2xl space-y-4">
        <h1 className="title text-xl">
          Lobby <span className="font-mono text-gold">{code}</span>
        </h1>
        <p className="text-white/60">Connecting to lobby…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="title text-xl">
          {lobby.settings.visibility === "private" ? (
            <>
              Lobby <span className="font-mono text-gold">{code}</span>
            </>
          ) : (
            <>{lobby.players.find((p) => p.isHost)?.displayName ?? "Open"}&apos;s draft</>
          )}
        </h1>
        <span className="pill shrink-0 bg-black/40 text-white/70">{lobby.status}</span>
      </header>

      {lobby.settings.visibility === "private" ? (
        <div className="panel space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-white/60">
            Invite link
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="field text-sm"
            />
            <button type="button" onClick={copyLink} className="btn btn-grey shrink-0">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <p className="text-white/70">
            This lobby is public and listed in the lobby browser. Anyone can join.
          </p>
        </div>
      )}

      <div className="panel space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="title text-sm">Players</h2>
          <span className="text-xs font-bold uppercase tracking-wide text-white/40">
            {lobby.settings.teamSize}-a-side ·{" "}
            {TOURNAMENT_LABELS[lobby.settings.tournamentType]} ·{" "}
            {lobby.settings.draftTimerSeconds}s
          </span>
        </div>
        <ul className="space-y-2">
          {lobby.players.map((p) => (
            <li
              key={p.userId}
              className="inset flex items-center justify-between px-4 py-2"
            >
              <span className="font-extrabold">
                {p.displayName}
                {p.userId === myUserId && (
                  <span className="ml-2 text-xs text-white/40">(you)</span>
                )}
              </span>
              {p.isHost && <span className="pill bg-gold/20 text-gold">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="btn w-full py-4 text-sm"
        >
          {busy ? "Starting…" : "Start draft"}
        </button>
      ) : (
        <p className="text-center font-bold text-white/50">
          Waiting for the host to start the draft…
        </p>
      )}

      {error && <p className="text-center text-sm font-bold text-red-300">{error}</p>}
    </section>
  );
}
