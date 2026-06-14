"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@draftoff/shared";

/** Fully-typed client socket. */
export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

let socket: ClientSocket | null = null;

/**
 * Lazily create a singleton socket connection. 
 */
export function getSocket(): ClientSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
}
