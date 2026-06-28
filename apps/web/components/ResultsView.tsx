"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, MatchResult, TournamentState } from "@draftoff/shared";
import { useLobby } from "@/hooks/useLobby";
import { useDraft } from "@/hooks/useDraft";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";
import { TeamReveal } from "@/components/TeamReveal";
import { FixturesView } from "@/components/FixturesView";
import { MatchViewer } from "@/components/MatchViewer";
import { GameSessionProvider } from "@/components/GameSession";
import { HostControls } from "@/components/HostControls";
import { RoomChatProvider } from "@/components/RoomChat";

type Phase = "reveal" | "fixtures" | "match";

function ResultsContent({ code }: { code: string }) {
  const router = useRouter();
  const { socket } = useSocket();
  const { lobby } = useLobby(code);
  const { draft } = useDraft(code);
  const [myUserId, setMyUserId] = useState("");
  const [tournament, setTournament] = useState<TournamentState | null>(
    lobby?.tournament ?? null
  );
  const [phase, setPhase] = useState<Phase>("reveal");
  const [watching, setWatching] = useState<MatchResult | null>(null);
  const [simmingId, setSimmingId] = useState<string | null>(null);
  const [revealDone, setRevealDone] = useState(false);

  useEffect(() => setMyUserId(getUserId(code) ?? ""), [code]);

  const isHost = Boolean(lobby && myUserId && myUserId === lobby.hostId);

  useEffect(() => {
    if (lobby?.status === "LOBBY") {
      router.push(`/lobby/${code}`);
    }
  }, [lobby?.status, code, router]);

  useEffect(() => {
    if (lobby?.tournament) setTournament(lobby.tournament);
  }, [lobby?.tournament]);

  useEffect(() => {
    const onTournament = (state: TournamentState) => setTournament(state);
    socket.on("tournament:state", onTournament);
    return () => {
      socket.off("tournament:state", onTournament);
    };
  }, [socket]);

  useEffect(() => {
    if (revealDone && phase === "reveal") setPhase("fixtures");
  }, [revealDone, phase]);

  const players = lobby?.players ?? [];
  const humanCount = players.filter((p) => !p.isFiller).length;

  useEffect(() => {
    if (humanCount === 0 && phase === "reveal" && !revealDone) {
      setRevealDone(true);
    }
  }, [humanCount, phase, revealDone]);

  const skipReveal = useCallback(() => setRevealDone(true), []);

  const handleSim = useCallback(
    (match: Match) => {
      if (!isHost) return;
      if (match.status === "played" && match.result) {
        setWatching(match.result);
        setPhase("match");
        return;
      }
      setSimmingId(match.matchId);
      socket.emit(
        "sim:runMatch",
        { code, matchId: match.matchId, userId: myUserId },
        (res) => {
          setSimmingId(null);
          if (res.ok) {
            setWatching(res.data);
            setPhase("match");
          }
        }
      );
    },
    [code, socket, isHost, myUserId]
  );

  const handleWatch = useCallback(
    (match: Match) => {
      if (!isHost || !match.result) return;
      setWatching(match.result);
      setPhase("match");
    },
    [isHost]
  );

  const summaries = lobby?.squadSummaries ?? [];
  const teamSize = lobby?.settings.teamSize ?? 11;

  if (!draft || !tournament) {
    return (
      <section className="space-y-4 p-4">
        <h2 className="text-2xl font-bold">Results · {code}</h2>
        <p className="text-white/60">Preparing tournament…</p>
      </section>
    );
  }

  return (
    <section className="results-view relative space-y-4 p-4">
      <HostControls code={code} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">
          {lobby?.settings.name || "DraftOff"} · {code}
        </h2>
        {phase === "reveal" && !revealDone && isHost && (
          <button
            type="button"
            className="btn btn-grey px-3 py-2 text-[0.6rem]"
            onClick={skipReveal}
          >
            Skip to fixtures
          </button>
        )}
      </div>

      {phase === "reveal" && !revealDone && (
        <>
          {humanCount === 0 ? (
            <p className="text-white/60">Loading fixtures…</p>
          ) : (
            <TeamReveal
              players={players}
              draft={draft}
              summaries={summaries}
              teamSize={teamSize}
              onComplete={() => setRevealDone(true)}
            />
          )}
        </>
      )}

      {phase === "fixtures" && tournament && (
        <FixturesView
          tournament={tournament}
          players={players}
          isHost={isHost}
          onSim={handleSim}
          onWatch={handleWatch}
          simmingId={simmingId}
        />
      )}

      {phase === "match" && watching && isHost && (
        <MatchViewer
          result={watching}
          players={players}
          onClose={() => {
            setWatching(null);
            setPhase("fixtures");
          }}
        />
      )}
    </section>
  );
}

export function ResultsView({ code }: { code: string }) {
  const { lobby } = useLobby(code);
  const playerIds = lobby?.players.map((p) => p.userId) ?? [];

  return (
    <GameSessionProvider code={code}>
      <RoomChatProvider code={code} playerIds={playerIds}>
        <ResultsContent code={code} />
      </RoomChatProvider>
    </GameSessionProvider>
  );
}
