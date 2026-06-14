"use client";

import { useDraft } from "@/hooks/useDraft";

/**
 * Live draft screen. Composition target for: turn indicator + Timer,
 *
 * Boilerplate. TODO(web): build the three-pane layout; wire pool search
 */
export function DraftRoom({ code }: { code: string }) {
  const { draft, timeRemaining } = useDraft(code);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Draft · {code}</h2>
        <div className="rounded-lg bg-black/30 px-3 py-1 font-mono">
          {/* TODO(web): proper Timer component */}
          {timeRemaining ?? "--"}s
        </div>
      </header>

      {!draft ? (
        <p className="text-white/60">Waiting for the draft to start…</p>
      ) : (
        <pre className="overflow-auto rounded-lg bg-black/30 p-4 text-xs text-white/70">
          {/* TODO(web): replace debug dump with pool / squad / board panes */}
          {JSON.stringify(draft, null, 2)}
        </pre>
      )}
    </section>
  );
}
