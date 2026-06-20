"use client";

import { useEffect, useState } from "react";
import type { DraftState } from "@draftoff/shared";
import { getUserId } from "@/lib/identity";
import { useSocket } from "./useSocket";

/**
 * Subscribe to authoritative draft state + per-second timer ticks. Syncs on
 * mount so a direct link / refresh re-attaches to the running draft.
 */
export function useDraft(code: string): {
  draft: DraftState | null;
  timeRemaining: number | null;
  startCountdown: number | null;
} {
  const { socket, connected } = useSocket();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);

  useEffect(() => {
    const onState = (state: DraftState) => {
      setDraft(state);
      setTimeRemaining(state.timeRemaining);
      setStartCountdown(state.startCountdown ?? null);
    };
    const onTick = ({
      timeRemaining: remaining,
      startCountdown: countdown,
    }: {
      timeRemaining: number;
      startCountdown?: number | null;
    }) => {
      setTimeRemaining(remaining);
      if (countdown !== undefined) {
        setStartCountdown(countdown);
      }
    };

    socket.on("draft:state", onState);
    socket.on("draft:tick", onTick);

    socket.emit("draft:sync", { code, userId: getUserId(code) }, (res) => {
      if (res.ok) onState(res.data);
    });

    return () => {
      socket.off("draft:state", onState);
      socket.off("draft:tick", onTick);
    };
  }, [socket, connected, code]);

  return { draft, timeRemaining, startCountdown };
}
