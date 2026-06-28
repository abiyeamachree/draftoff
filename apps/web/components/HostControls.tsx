"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLobby } from "@/hooks/useLobby";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";

export function HostControls({ code }: { code: string }) {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobby } = useLobby(code);
  const [myUserId, setMyUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMyUserId(getUserId(code) ?? ""), [code]);

  const isHost = Boolean(lobby && myUserId && myUserId === lobby.hostId);
  if (!isHost) return null;

  function reopenSettings() {
    if (!confirm("Return to settings? This resets the current draft and tournament.")) return;
    setError(null);
    setBusy(true);
    socket.emit("lobby:reopen", { code, userId: myUserId }, (res) => {
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/lobby/${code}`);
    });
  }

  function endGame() {
    if (!confirm("End this game for everyone?")) return;
    setError(null);
    setBusy(true);
    socket.emit("lobby:end", { code, userId: myUserId }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="fixed right-4 top-4 z-50 text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-grey px-4 py-2 text-[0.6rem]"
      >
        Host ▾
      </button>
      {open && (
        <div className="panel mt-2 w-52 space-y-2 p-3 shadow-xl">
          {lobby?.status !== "LOBBY" && (
            <button
              type="button"
              disabled={busy}
              onClick={reopenSettings}
              className="btn btn-grey w-full py-2 text-[0.55rem]"
            >
              Change settings
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={endGame}
            className="btn w-full border border-red-500/40 bg-red-950/60 py-2 text-[0.55rem] text-red-200"
          >
            Exit game
          </button>
          {error && <p className="text-xs font-bold text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function kickPlayer(
  socket: ReturnType<typeof useSocket>["socket"],
  code: string,
  hostUserId: string,
  targetUserId: string,
  onDone?: (error?: string) => void
) {
  socket.emit(
    "lobby:kick",
    { code, userId: hostUserId, targetUserId },
    (res) => onDone?.(res.ok ? undefined : res.error)
  );
}
