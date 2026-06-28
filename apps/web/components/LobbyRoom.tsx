"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FORMATIONS_BY_SIZE,
  PLAYER_ICONS,
  TOURNAMENT_LABELS,
} from "@draftoff/shared";
import { useLobby } from "@/hooks/useLobby";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";
import { sanitiseName } from "@/lib/name";
import { RoomChatProvider, SpeechBubble, useRoomChat } from "@/components/RoomChat";
import { GameSessionProvider } from "@/components/GameSession";
import { HostControls, kickPlayer } from "@/components/HostControls";
import { LobbySettingsEditor } from "@/components/LobbySettingsEditor";

function LobbyContent({ code }: { code: string }) {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobby } = useLobby(code);
  const { bubbleFor } = useRoomChat();

  const [myUserId, setMyUserId] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  useEffect(() => setMyUserId(getUserId(code) ?? ""), [code]);

  useEffect(() => {
    if (lobby?.status === "DRAFTING") router.push(`/draft/${code}`);
  }, [lobby?.status, code, router]);

  const me = lobby?.players.find((p) => p.userId === myUserId) ?? null;
  const isHost = !!lobby && myUserId === lobby.hostId;
  const formations = lobby ? FORMATIONS_BY_SIZE[lobby.settings.teamSize] ?? [] : [];
  const takenIcons = new Set(
    lobby?.players.filter((p) => p.userId !== myUserId).map((p) => p.icon) ?? []
  );

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/lobby/${code}` : "";

  function customise(patch: { icon?: string; displayName?: string; formation?: string }) {
    setIconError(null);
    socket.emit("lobby:customise", { code, userId: myUserId, ...patch }, (res) => {
      if (!res.ok) setIconError(res.error);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
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

  function leaveQuietly() {
    socket.emit("lobby:leave", { code, userId: myUserId, quit: true }, () => {
      router.push("/");
    });
  }

  function kick(targetUserId: string) {
    if (!confirm("Remove this player from the lobby?")) return;
    kickPlayer(socket, code, myUserId, targetUserId, (err) => {
      if (err) setError(err);
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

  const title =
    lobby.settings.name ||
    `${lobby.players.find((p) => p.isHost)?.displayName ?? "Open"}'s draft`;

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-2xl flex-col pb-20">
      <HostControls code={code} />
      <div className="flex-1 space-y-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="title text-xl">{title}</h1>
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

        <div className="panel space-y-4">
          <h2 className="title text-sm">Your team</h2>

          <div>
            <span className="text-sm font-bold uppercase tracking-wide text-white/60">
              Icon
            </span>
            {iconError && (
              <p className="mt-1 text-sm font-bold text-red-300">{iconError}</p>
            )}
            <div className="mt-1 grid grid-cols-8 gap-1">
              {PLAYER_ICONS.map((icon) => {
                const taken = takenIcons.has(icon);
                const mine = me?.icon === icon;
                return (
                  <button
                    key={icon}
                    type="button"
                    disabled={taken}
                    onClick={() => !taken && customise({ icon })}
                    title={taken ? "Already taken" : undefined}
                    className={`relative inset h-9 text-lg leading-none ${
                      mine
                        ? "ring-2 ring-gold"
                        : taken
                          ? "cursor-not-allowed opacity-30"
                          : "hover:bg-black/60"
                    }`}
                  >
                    {icon}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-bold uppercase tracking-wide text-white/60">
              Name
            </span>
            <input
              className="field mt-1"
              value={nameDraft ?? me?.displayName ?? ""}
              onChange={(e) => setNameDraft(sanitiseName(e.target.value))}
              onBlur={() => {
                if (nameDraft && nameDraft.trim()) customise({ displayName: nameDraft.trim() });
                setNameDraft(null);
              }}
              placeholder="Your name"
            />
          </label>

          <div>
            <span className="text-sm font-bold uppercase tracking-wide text-white/60">
              Formation
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {formations.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => customise({ formation: f })}
                  className={`btn px-3 ${me?.formation === f ? "" : "btn-grey"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="title text-sm">
              Teams {lobby.players.length}/{lobby.settings.numTeams}
            </h2>
            <span className="text-xs font-bold uppercase tracking-wide text-white/40">
              {lobby.settings.teamSize}-a-side ·{" "}
              {TOURNAMENT_LABELS[lobby.settings.tournamentType]} ·{" "}
              {lobby.settings.draftTimerSeconds}s ·{" "}
              {lobby.settings.rerollsPerPick} re-roll
              {lobby.settings.rerollsPerPick === 1 ? "" : "s"}/pick
            </span>
          </div>
          <ul className="space-y-2">
            {lobby.players.map((p) => (
              <li
                key={p.userId}
                className="inset relative flex items-center justify-between px-4 py-2"
              >
                <SpeechBubble
                  text={bubbleFor(p.userId)}
                  className="bottom-full left-8 mb-1"
                />
                <span className="flex items-center gap-2 font-extrabold">
                  <span className="relative text-2xl leading-none">{p.icon}</span>
                  {p.displayName}
                  {p.userId === myUserId && (
                    <span className="text-xs text-white/40">(you)</span>
                  )}
                  {p.formation && (
                    <span className="pill bg-black/40 text-[0.55rem] text-white/50">
                      {p.formation}
                    </span>
                  )}
                </span>
                {p.isHost && <span className="pill bg-gold/20 text-gold">Host</span>}
                {isHost && p.userId !== myUserId && (
                  <button
                    type="button"
                    onClick={() => kick(p.userId)}
                    className="btn btn-grey px-2 py-1 text-[0.5rem] text-red-200"
                  >
                    Kick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isHost && <LobbySettingsEditor code={code} settings={lobby.settings} />}

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
          <div className="space-y-3 text-center">
            <p className="font-bold text-white/50">
              Waiting for the host to start the draft…
            </p>
            <button type="button" onClick={leaveQuietly} className="btn btn-grey px-6 py-2 text-sm">
              Leave lobby
            </button>
          </div>
        )}

        {error && <p className="text-center text-sm font-bold text-red-300">{error}</p>}
      </div>
    </section>
  );
}

export function LobbyRoom({ code }: { code: string }) {
  const { lobby } = useLobby(code);
  const playerIds = lobby?.players.map((p) => p.userId) ?? [];

  return (
    <GameSessionProvider code={code}>
      <RoomChatProvider code={code} playerIds={playerIds}>
        <LobbyContent code={code} />
      </RoomChatProvider>
    </GameSessionProvider>
  );
}
