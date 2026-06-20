"use client";

import { useEffect, useState } from "react";
import type { LobbyState } from "@draftoff/shared";
import { getUserId } from "@/lib/identity";
import { useSocket } from "./useSocket";

/**
 * Subscribe to authoritative lobby state for a given code. On mount we `sync`
 * (join the room + fetch the current snapshot) so a refresh/direct-link works.
 */
export function useLobby(code: string): { lobby: LobbyState | null } {
  const { socket, connected } = useSocket();
  const [lobby, setLobby] = useState<LobbyState | null>(null);

  useEffect(() => {
    socket.on("lobby:state", setLobby);

    socket.emit("lobby:sync", { code, userId: getUserId(code) }, (res) => {
      if (res.ok) setLobby(res.data);
    });

    return () => {
      socket.off("lobby:state", setLobby);
      socket.emit("lobby:leave", { code, userId: getUserId(code) }, () => {});
    };
  }, [socket, connected, code]);

  return { lobby };
}
