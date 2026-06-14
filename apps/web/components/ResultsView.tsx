"use client";

import { useEffect, useState } from "react";
import type { MatchResult, TournamentState } from "@draftoff/shared";
import { useSocket } from "@/hooks/useSocket";

/**
 * Tournament results: bracket / standings, per-match results with templated
 * commentary, and the final winner/leaderboard.
 *
 * Boilerplate. TODO(web): render bracket (knockout) or standings table
 * (round robin), a match-result feed, and a winner banner when complete.
 */
export function ResultsView({ code }: { code: string }) {
  const { socket } = useSocket();
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);

  useEffect(() => {
    const onTournament = (state: TournamentState) => setTournament(state);
    const onMatch = (result: MatchResult) =>
      setResults((prev) => [...prev, result]);

    socket.on("tournament:state", onTournament);
    socket.on("sim:matchResult", onMatch);
    return () => {
      socket.off("tournament:state", onTournament);
      socket.off("sim:matchResult", onMatch);
    };
  }, [socket]);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Results · {code}</h2>
      {!tournament ? (
        <p className="text-white/60">Simulating…</p>
      ) : (
        <pre className="overflow-auto rounded-lg bg-black/30 p-4 text-xs text-white/70">
          {/* TODO(web): bracket/standings + winner banner */}
          {JSON.stringify({ tournament, results }, null, 2)}
        </pre>
      )}
    </section>
  );
}
