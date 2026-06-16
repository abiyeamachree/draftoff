"use client";

import { useEffect, useState } from "react";
import { defaultFormation } from "@draftoff/shared";
import { useLobby } from "@/hooks/useLobby";
import { useDraft } from "@/hooks/useDraft";
import { getUserId } from "@/lib/identity";
import { PitchView } from "@/components/PitchView";
import { RoomChatProvider, SpeechBubble, useRoomChat } from "@/components/RoomChat";

function DraftContent({ code }: { code: string }) {
  const { draft, timeRemaining } = useDraft(code);
  const { lobby } = useLobby(code);
  const { bubbleFor } = useRoomChat();

  const [myUserId, setMyUserId] = useState("");
  useEffect(() => setMyUserId(getUserId(code) ?? ""), [code]);

  const playerFor = (userId: string | null) =>
    lobby?.players.find((p) => p.userId === userId) ?? null;
  const nameFor = (userId: string | null) =>
    playerFor(userId)?.displayName ?? userId ?? "?";

  const teamSize = lobby?.settings.teamSize ?? 11;
  const activeSquad = draft?.squads.find((s) => s.userId === draft.activeUserId) ?? null;
  const activePlayer = playerFor(draft?.activeUserId ?? null);
  const formation = activePlayer?.formation || defaultFormation(teamSize);
  const picks = activeSquad?.players ?? [];
  const squads = draft?.squads ?? [];

  return (
    <section className="relative mx-auto flex min-h-[85vh] max-w-5xl flex-col pb-20">
      <header className="flex items-center justify-between">
        <h1 className="title text-xl">
          {lobby?.settings.name || (
            <>
              Draft <span className="font-mono text-gold">{code}</span>
            </>
          )}
        </h1>
        <div className="inset title px-4 py-2 text-base text-gold">
          {timeRemaining ?? "--"}s
        </div>
      </header>

      {!draft ? (
        <p className="mt-6 font-bold text-white/60">Waiting for the draft to start…</p>
      ) : (
        <div className="mt-4 flex-1 space-y-4">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-white/50">
            Round {draft.round + 1} of {draft.totalRounds} · pick{" "}
            {draft.currentPickIndex + 1} of {draft.order.length}
          </p>

          <div className="relative mx-auto w-full max-w-2xl px-2 py-4">
            {/* Managers around the pitch */}
            <div className="relative aspect-[4/5] w-full">
              {squads.map((squad, i) => {
                const angle = (i / Math.max(1, squads.length)) * 2 * Math.PI - Math.PI / 2;
                const left = 50 + 46 * Math.cos(angle);
                const top = 50 + 46 * Math.sin(angle);
                const isActive = squad.userId === draft.activeUserId;
                const p = playerFor(squad.userId);
                return (
                  <div
                    key={squad.userId}
                    className="absolute z-20 flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
                    style={{ left: `${left}%`, top: `${top}%` }}
                  >
                    <div className="relative">
                      <SpeechBubble
                        text={bubbleFor(squad.userId)}
                        className="bottom-full left-1/2 mb-1 -translate-x-1/2"
                      />
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-black/50 text-2xl shadow-lg ${
                          isActive ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent" : ""
                        }`}
                      >
                        {p?.icon ?? "⚽"}
                      </div>
                    </div>
                    <span
                      className={`mt-1 max-w-full truncate text-[0.55rem] font-bold ${
                        isActive ? "text-gold" : "text-white/80"
                      }`}
                      style={{ textShadow: "1px 1px 0 #000" }}
                    >
                      {nameFor(squad.userId)}
                    </span>
                    <span className="text-[0.5rem] text-white/50">
                      {squad.players.length}/{draft.totalRounds}
                    </span>
                  </div>
                );
              })}

              {/* Centre pitch */}
              <div className="absolute left-1/2 top-1/2 z-10 w-[62%] -translate-x-1/2 -translate-y-1/2">
                <PitchView
                  formation={formation}
                  picks={picks}
                  compact
                  header={
                    <>
                      <span className="text-lg leading-none">{activePlayer?.icon ?? "⚽"}</span>
                      <span className="truncate text-[0.55rem] font-extrabold text-gold">
                        {draft.complete ? "Draft complete" : nameFor(draft.activeUserId)}
                      </span>
                      <span className="text-[0.5rem] text-white/60">{formation}</span>
                    </>
                  }
                />
              </div>
            </div>
          </div>

          {draft.activeUserId === myUserId && !draft.complete && (
            <p className="text-center text-lg text-emerald-300">Your pick!</p>
          )}
        </div>
      )}
    </section>
  );
}

export function DraftRoom({ code }: { code: string }) {
  const { lobby } = useLobby(code);
  const playerIds = lobby?.players.map((p) => p.userId) ?? [];

  return (
    <RoomChatProvider code={code} playerIds={playerIds}>
      <DraftContent code={code} />
    </RoomChatProvider>
  );
}
