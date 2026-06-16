"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@draftoff/shared";
import { getUserId } from "@/lib/identity";
import { useSocket } from "./useSocket";

const MAX_MESSAGES = 50;

/** Subscribe to quick-chat for a room and expose a send helper. */
export function useChat(code: string): {
  messages: ChatMessage[];
  send: (text: string) => void;
} {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const onMessage = (msg: ChatMessage) =>
      setMessages((prev) => [...prev, msg].slice(-MAX_MESSAGES));

    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket, connected]);

  const send = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      socket.emit("chat:send", { code, userId: getUserId(code), text: clean }, () => {});
    },
    [socket, code]
  );

  return { messages, send };
}
