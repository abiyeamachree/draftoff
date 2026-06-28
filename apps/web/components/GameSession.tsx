"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearUserId } from "@/lib/identity";
import { useSocket } from "@/hooks/useSocket";

type OverlayState = { title: string; message: string } | null;

const Ctx = createContext<{ dismiss: () => void } | null>(null);

export function GameSessionProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { socket } = useSocket();
  const [overlay, setOverlay] = useState<OverlayState>(null);

  useEffect(() => {
    const onKicked = (payload: { message: string }) => {
      clearUserId(code);
      setOverlay({ title: "Removed from lobby", message: payload.message });
    };
    const onEnded = (payload: { message: string }) => {
      clearUserId(code);
      setOverlay({ title: "Game ended", message: payload.message });
    };
    socket.on("lobby:kicked", onKicked);
    socket.on("lobby:ended", onEnded);
    return () => {
      socket.off("lobby:kicked", onKicked);
      socket.off("lobby:ended", onEnded);
    };
  }, [socket, code]);

  function dismiss() {
    setOverlay(null);
    router.push("/");
  }

  return (
    <Ctx.Provider value={{ dismiss }}>
      {children}
      {overlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6">
          <div className="panel max-w-md space-y-4 text-center">
            <h2 className="title text-xl text-gold">{overlay.title}</h2>
            <p className="text-white/80">{overlay.message}</p>
            <button type="button" onClick={dismiss} className="btn w-full py-3">
              Back to home
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useGameSessionDismiss() {
  const ctx = useContext(Ctx);
  return ctx?.dismiss;
}
