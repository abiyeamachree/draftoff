"use client";

import { useEffect, useState } from "react";
import { getSocket, type ClientSocket } from "@/lib/socket";

/**
 * Connect the singleton socket on mount and expose connection status.
 */
export function useSocket(): { socket: ClientSocket; connected: boolean } {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  return { socket, connected };
}
