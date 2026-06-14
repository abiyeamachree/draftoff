"use client";

import { useLobby } from "@/hooks/useLobby";

/**
 * Lobby screen: player list, ready toggles, host-only settings, start button.
 *
 * Boilerplate. TODO(web): render `lobby.players`, ready toggle (emit
 */
export function LobbyRoom({ code }: { code: string }) {
  const { lobby } = useLobby(code);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">
        Lobby <span className="font-mono text-pitch">{code}</span>
      </h2>

      {!lobby ? (
        <p className="text-white/60">Connecting to lobby…</p>
      ) : (
        <pre className="overflow-auto rounded-lg bg-black/30 p-4 text-xs text-white/70">
          {/* TODO(web): replace debug dump with player list + settings UI */}
          {JSON.stringify(lobby, null, 2)}
        </pre>
      )}
    </section>
  );
}
