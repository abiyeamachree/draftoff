"use client";

import { useEffect, useState } from "react";
import type { LobbyState } from "@draftoff/shared";
import { useSocket } from "./useSocket";

/**
 * Subscribe to authoritative lobby state for a given code.
 */
export function useLobby(_code: string): { lobby: LobbyState | null } {
  const { socket } = useSocket();
  const [lobby, setLobby] = useState<LobbyState | null>(null);

  useEffect(() => {
    socket.on("lobby:state", setLobby);
    return () => {
      socket.off("lobby:state", setLobby);
    };
  }, [socket]);

  return { lobby };
}
