"use client";

import { useEffect, useState } from "react";
import type { LobbySummary } from "@draftoff/shared";
import { useSocket } from "./useSocket";

/**
 * Live list of open lobbies for the home browser. Seeds via an ack request and
 * then stays current through `lobby:list` broadcasts.
 */
export function useLobbyList(): { lobbies: LobbySummary[] } {
  const { socket, connected } = useSocket();
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);

  useEffect(() => {
    const onList = (list: LobbySummary[]) => setLobbies(list);
    socket.on("lobby:list", onList);

    socket.emit("lobby:list", (res) => {
      if (res.ok) setLobbies(res.data);
    });

    return () => {
      socket.off("lobby:list", onList);
    };
  }, [socket, connected]);

  return { lobbies };
}
