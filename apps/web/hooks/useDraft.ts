"use client";

import { useEffect, useState } from "react";
import type { DraftState } from "@draftoff/shared";
import { useSocket } from "./useSocket";

/**
 * Subscribe to authoritative draft state + per-second timer ticks.
 */
export function useDraft(_code: string): {
  draft: DraftState | null;
  timeRemaining: number | null;
} {
  const { socket } = useSocket();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    const onState = (state: DraftState) => {
      setDraft(state);
      setTimeRemaining(state.timeRemaining);
    };
    const onTick = ({ timeRemaining }: { timeRemaining: number }) =>
      setTimeRemaining(timeRemaining);

    socket.on("draft:state", onState);
    socket.on("draft:tick", onTick);
    return () => {
      socket.off("draft:state", onState);
      socket.off("draft:tick", onTick);
    };
  }, [socket]);

  return { draft, timeRemaining };
}
