"use client";

import { useLobby } from "@/hooks/useLobby";
import { useDraft } from "@/hooks/useDraft";
import { getUserId } from "@/lib/identity";

export function DraftRoom({ code }: { code: string }) {
  const { draft, timeRemaining } = useDraft(code);
  const { lobby } = useLobby(code);

  const myUserId = getUserId(code);
  const nameFor = (userId: string | null) =>
    lobby?.players.find((p) => p.userId === userId)?.displayName ?? userId ?? "?";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="title text-xl">
          Draft <span className="font-mono text-gold">{code}</span>
        </h1>
        <div className="inset title px-4 py-2 text-base text-gold">
          {timeRemaining ?? "--"}s
        </div>
      </header>

      {!draft ? (
        <p className="font-bold text-white/60">Waiting for the draft to start…</p>
      ) : (
        <>
          <div className="panel">
            <p className="text-xs font-bold uppercase tracking-wide text-white/50">
              Round {draft.round + 1} of {draft.totalRounds} · pick{" "}
              {draft.currentPickIndex + 1} of {draft.order.length}
            </p>
            <p className="title mt-2 text-base leading-relaxed">
              {draft.complete ? (
                "Draft complete"
              ) : (
                <>
                  On the clock:{" "}
                  <span className="text-gold">{nameFor(draft.activeUserId)}</span>
                </>
              )}
            </p>
            {draft.activeUserId === myUserId && !draft.complete && (
              <p className="mt-2 text-lg text-emerald-300">Your pick!</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {draft.squads.map((squad) => (
              <div key={squad.userId} className="panel">
                <div className="flex items-center justify-between">
                  <h2 className="title text-xs">
                    {nameFor(squad.userId)}
                    {squad.userId === myUserId && (
                      <span className="ml-2 text-xs text-white/40">(you)</span>
                    )}
                  </h2>
                  <span className="pill bg-black/40 text-white/60">
                    {squad.players.length}/{draft.totalRounds}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm font-medium text-white/70">
                  {squad.players.length === 0 ? (
                    <li className="text-white/30">No picks yet</li>
                  ) : (
                    squad.players.map((p) => (
                      <li key={`${p.playerId}:${p.edition}`}>
                        {p.name} · {p.overall}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center text-xs font-bold uppercase tracking-wide text-white/30">
            Picking goes live next. This screen shows real-time draft state.
          </p>
        </>
      )}
    </section>
  );
}
