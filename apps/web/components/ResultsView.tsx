"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, MatchResult, TournamentState } from "@draftoff/shared";
import {
  allMatches,
  countPending,
  getNextPendingMatch,
  quickSimTiming,
  type LiveMatchState,
  type QuickSimSyncPayload,
} from "@draftoff/shared";
import { useLobby } from "@/hooks/useLobby";
import { useDraft } from "@/hooks/useDraft";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";
import { TeamReveal } from "@/components/TeamReveal";
import { FixturesView } from "@/components/FixturesView";
import { FixturesScoreboard } from "@/components/FixturesScoreboard";
import { StandingsPanel } from "@/components/StandingsPanel";
import { TournamentStatsPanel } from "@/components/TournamentStatsPanel";
import { MatchViewer } from "@/components/MatchViewer";
import { HalftimeOverlay } from "@/components/HalftimeOverlay";
import { GameSessionProvider } from "@/components/GameSession";
import { HostControls } from "@/components/HostControls";
import { RoomChatProvider } from "@/components/RoomChat";
import { HALFTIME_BREAK_MS } from "@/lib/useHalftimeBreak";

type Phase = "reveal" | "fixtures" | "match";

function lastPlayedMatch(tournament: TournamentState): Match | null {
  const played = allMatches(tournament).filter((m) => m.status === "played" && m.result);
  return played.length > 0 ? played[played.length - 1]! : null;
}

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
  const [revealDone, setRevealDone] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveMatchState | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [simAllRunning, setSimAllRunning] = useState(false);
  const [halftime, setHalftime] = useState(false);

  const quickSimAbortRef = useRef(false);
  const liveSessionRef = useRef(liveSession);
  const htTriggeredRef = useRef(false);
  const htWaitingRef = useRef(false);

  liveSessionRef.current = liveSession;

  useEffect(() => {
    htTriggeredRef.current = false;
    htWaitingRef.current = false;
    setHalftime(false);
  }, [liveSession?.matchId]);

  useEffect(() => setMyUserId(getUserId(code) ?? ""), [code]);

  const isHost = Boolean(lobby && myUserId && myUserId === lobby.hostId);

  useEffect(() => {
    if (!liveSession || liveSession.maxMinute <= 45 || isHost) return;
    if (liveSession.minute === 45 && liveSession.paused && liveSession.mode === "sim") {
      setHalftime(true);
      const t = window.setTimeout(() => setHalftime(false), HALFTIME_BREAK_MS);
      return () => window.clearTimeout(t);
    }
    if (liveSession.minute >= 46) setHalftime(false);
  }, [liveSession, isHost]);

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

  const nextMatch = useMemo(
    () => (tournament ? getNextPendingMatch(tournament) : null),
    [tournament]
  );

  const pendingCount = useMemo(
    () => (tournament ? countPending(tournament) : 0),
    [tournament]
  );

  const selectedMatch = useMemo(() => {
    if (!tournament) return null;
    if (selectedMatchId) {
      return allMatches(tournament).find((m) => m.matchId === selectedMatchId) ?? null;
    }
    return lastPlayedMatch(tournament);
  }, [tournament, selectedMatchId]);

  const focusMatch = useMemo(() => {
    if (liveSession && tournament) {
      return (
        allMatches(tournament).find((m) => m.matchId === liveSession.matchId) ?? nextMatch
      );
    }
    return nextMatch ?? selectedMatch;
  }, [liveSession, tournament, nextMatch, selectedMatch]);

  const emitLiveSync = useCallback(
    (payload: QuickSimSyncPayload) => {
      socket.emit("sim:quickSync", { code, userId: myUserId, ...payload }, () => {});
    },
    [code, socket, myUserId]
  );

  const applyLiveState = useCallback((state: LiveMatchState) => {
    setLiveSession(state);
    setPhase(state.mode === "watch" ? "match" : "fixtures");
  }, []);

  const endLiveSession = useCallback(() => {
    setLiveSession(null);
    setPhase("fixtures");
  }, []);

  const applyQuickSync = useCallback(
    (payload: QuickSimSyncPayload) => {
      switch (payload.action) {
        case "start":
          setRevealDone(true);
          setSimAllRunning(true);
          break;
        case "live":
          setRevealDone(true);
          applyLiveState(payload.state);
          break;
        case "liveEnd":
          endLiveSession();
          break;
        case "pause":
          setLiveSession((s) => (s ? { ...s, paused: payload.paused } : s));
          break;
        case "stop":
          setSimAllRunning(false);
          endLiveSession();
          break;
        case "match":
          applyLiveState({
            matchId: payload.result.matchId,
            result: payload.result,
            homeUserId: payload.homeUserId,
            awayUserId: payload.awayUserId,
            durationMs: payload.durationMs,
            maxMinute: payload.maxMinute,
            phase: payload.phase,
            minute: 0,
            mode: "sim",
            paused: false,
          });
          break;
        case "watch":
          applyLiveState({
            matchId: payload.result.matchId,
            result: payload.result,
            homeUserId: payload.result.homeUserId,
            awayUserId: payload.result.awayUserId,
            durationMs: 5000,
            maxMinute: 90,
            phase: "normal",
            minute: 0,
            mode: "watch",
            paused: false,
          });
          break;
      }
    },
    [applyLiveState, endLiveSession]
  );

  useEffect(() => {
    const onQuickSync = (payload: QuickSimSyncPayload) => applyQuickSync(payload);
    socket.on("sim:quickSync", onQuickSync);
    return () => {
      socket.off("sim:quickSync", onQuickSync);
    };
  }, [socket, applyQuickSync]);

  const publishLive = useCallback(
    (state: LiveMatchState) => {
      applyLiveState(state);
      emitLiveSync({ action: "live", state });
    },
    [applyLiveState, emitLiveSync]
  );

  const simOnServer = useCallback(
    (match: Match) =>
      new Promise<MatchResult>((resolve, reject) => {
        socket.emit(
          "sim:runMatch",
          { code, matchId: match.matchId, userId: myUserId },
          (res) => {
            if (res.ok) resolve(res.data);
            else reject(new Error(res.error));
          }
        );
      }),
    [code, socket, myUserId]
  );

  const buildLiveState = useCallback(
    (
      match: Match,
      result: MatchResult,
      mode: LiveMatchState["mode"],
      minute: number,
      paused: boolean
    ): LiveMatchState => {
      const timing = quickSimTiming(match, tournament!.type);
      return {
        matchId: match.matchId,
        result,
        homeUserId: match.homeUserId!,
        awayUserId: match.awayUserId!,
        ...timing,
        minute,
        mode,
        paused,
      };
    },
    [tournament]
  );

  const resolveMatchForLive = useCallback((): Match | null => {
    if (liveSession && tournament) {
      return allMatches(tournament).find((m) => m.matchId === liveSession.matchId) ?? null;
    }
    if (nextMatch) return nextMatch;
    if (selectedMatch?.status === "played") return selectedMatch;
    return null;
  }, [liveSession, tournament, nextMatch, selectedMatch]);

  const beginOrContinueLive = useCallback(
    async (mode: LiveMatchState["mode"], minute = 0) => {
      if (!tournament) return;
      const match = resolveMatchForLive();
      if (!match) return;

      let result = match.result ?? liveSession?.result;
      if (!result) {
        if (!isHost || match.status !== "pending") return;
        result = await simOnServer(match);
      }

      publishLive(buildLiveState(match, result, mode, minute, false));
    },
    [
      tournament,
      resolveMatchForLive,
      liveSession?.result,
      isHost,
      simOnServer,
      publishLive,
      buildLiveState,
    ]
  );

  const switchLiveMode = useCallback(
    (mode: LiveMatchState["mode"]) => {
      const session = liveSessionRef.current;
      if (!session) return;
      const next = { ...session, mode, paused: false };
      publishLive(next);
    },
    [publishLive]
  );

  const updateLiveMinute = useCallback(
    (minute: number) => {
      const session = liveSessionRef.current;
      if (!session || session.minute === minute) return;
      const next = { ...session, minute };
      setLiveSession(next);
      if (isHost) {
        emitLiveSync({ action: "live", state: next });
      }
    },
    [isHost, emitLiveSync]
  );

  const togglePause = useCallback(() => {
    const session = liveSessionRef.current;
    if (!session) return;
    const paused = !session.paused;
    const next = { ...session, paused };
    publishLive(next);
  }, [publishLive]);

  const handlePause = useCallback(() => {
    togglePause();
  }, [togglePause]);

  const finishLiveMatch = useCallback(() => {
    emitLiveSync({ action: "liveEnd" });
    endLiveSession();
  }, [emitLiveSync, endLiveSession]);

  const handleSim = useCallback(() => {
    if (liveSession?.mode === "watch") {
      switchLiveMode("sim");
      return;
    }
    if (liveSession?.mode === "sim") return;
    void beginOrContinueLive("sim", 0);
  }, [liveSession, switchLiveMode, beginOrContinueLive]);

  const handleWatch = useCallback(() => {
    if (liveSession?.mode === "sim") {
      switchLiveMode("watch");
      return;
    }
    if (liveSession?.mode === "watch") return;
    void beginOrContinueLive("watch", 0);
  }, [liveSession, switchLiveMode, beginOrContinueLive]);

  const handleBackFromWatch = useCallback(() => {
    switchLiveMode("sim");
  }, [switchLiveMode]);

  const runQuickSimChain = useCallback(
    async (matches: Match[]) => {
      if (!tournament || !isHost || matches.length === 0) return;
      quickSimAbortRef.current = false;
      setSimAllRunning(true);
      emitLiveSync({ action: "start" });

      try {
        for (const match of matches) {
          if (quickSimAbortRef.current) break;

          const result = await simOnServer(match);
          const state = buildLiveState(match, result, "sim", 0, false);
          publishLive(state);

          await new Promise<void>((resolve) => {
            const { durationMs, maxMinute } = state;
            let elapsed = 0;
            let last = performance.now();
            let raf = 0;
            let htDone = false;

            const tick = (now: number) => {
              const session = liveSessionRef.current;
              if (quickSimAbortRef.current || !session) {
                resolve();
                return;
              }

              if (htWaitingRef.current || session.paused) {
                last = now;
                raf = requestAnimationFrame(tick);
                return;
              }

              elapsed += now - last;
              last = now;
              const t = Math.min(1, elapsed / durationMs);
              let minute = Math.floor(t * maxMinute);

              if (
                !htDone &&
                maxMinute > 45 &&
                minute >= 45 &&
                !htTriggeredRef.current
              ) {
                htDone = true;
                htTriggeredRef.current = true;
                htWaitingRef.current = true;
                setHalftime(true);
                updateLiveMinute(45);
                publishLive({ ...session, minute: 45, paused: true });
                window.setTimeout(() => {
                  htWaitingRef.current = false;
                  setHalftime(false);
                  elapsed = (46 / maxMinute) * durationMs;
                  updateLiveMinute(46);
                  const s = liveSessionRef.current;
                  if (s) publishLive({ ...s, minute: 46, paused: false });
                }, HALFTIME_BREAK_MS);
                last = now;
                raf = requestAnimationFrame(tick);
                return;
              }

              if (minute !== session.minute) updateLiveMinute(minute);

              if (t < 1) {
                raf = requestAnimationFrame(tick);
              } else {
                updateLiveMinute(maxMinute);
                resolve();
              }
            };

            raf = requestAnimationFrame(tick);
          });

          if (quickSimAbortRef.current) break;
          finishLiveMatch();
        }
      } catch (err) {
        console.error("Sim all failed:", err);
      } finally {
        emitLiveSync({ action: "stop" });
        setSimAllRunning(false);
        endLiveSession();
      }
    },
    [
      tournament,
      isHost,
      simOnServer,
      buildLiveState,
      publishLive,
      updateLiveMinute,
      finishLiveMatch,
      emitLiveSync,
      endLiveSession,
    ]
  );

  const handleSimAll = useCallback(() => {
    if (!tournament || !isHost) return;
    const pending = allMatches(tournament).filter((m) => m.status === "pending");
    void runQuickSimChain(pending);
  }, [tournament, isHost, runQuickSimChain]);

  const handleSelectMatch = useCallback((match: Match) => {
    setSelectedMatchId(match.matchId);
  }, []);

  // Host sim clock (single-match, not sim-all chain)
  useEffect(() => {
    if (!isHost || simAllRunning) return;
    const session = liveSession;
    if (!session || session.mode !== "sim") return;

    let elapsed = (session.minute / session.maxMinute) * session.durationMs;
    let last = performance.now();
    let raf = 0;
    let done = false;
    let htDone = false;

    const tick = (now: number) => {
      const current = liveSessionRef.current;
      if (!current || current.mode !== "sim" || current.matchId !== session.matchId) return;

      if (htWaitingRef.current || current.paused) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      elapsed += now - last;
      last = now;

      const t = Math.min(1, elapsed / current.durationMs);
      const minute = Math.floor(t * current.maxMinute);

      if (
        !htDone &&
        current.maxMinute > 45 &&
        minute >= 45 &&
        !htTriggeredRef.current
      ) {
        htDone = true;
        htTriggeredRef.current = true;
        htWaitingRef.current = true;
        setHalftime(true);
        updateLiveMinute(45);
        publishLive({ ...current, minute: 45, paused: true });
        window.setTimeout(() => {
          htWaitingRef.current = false;
          setHalftime(false);
          elapsed = (46 / current.maxMinute) * current.durationMs;
          updateLiveMinute(46);
          const s = liveSessionRef.current;
          if (s) publishLive({ ...s, minute: 46, paused: false });
        }, HALFTIME_BREAK_MS);
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (minute !== current.minute) {
        updateLiveMinute(minute);
      }

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!done) {
        done = true;
        updateLiveMinute(current.maxMinute);
        finishLiveMatch();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    isHost,
    simAllRunning,
    liveSession?.matchId,
    liveSession?.mode,
    liveSession?.paused,
    updateLiveMinute,
    finishLiveMatch,
    publishLive,
  ]);

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

      {(phase === "fixtures" || phase === "match") && tournament && (
        <div className="fixtures-hub">
          <FixturesScoreboard
            focusMatch={focusMatch}
            liveSession={liveSession}
            players={players}
            isHost={isHost}
            pendingCount={pendingCount}
            onSim={handleSim}
            onWatch={handleWatch}
            onSimAll={handleSimAll}
            onPause={handlePause}
            halftime={halftime}
          />

          {halftime && phase === "fixtures" && <HalftimeOverlay />}

          {phase === "fixtures" && (
            <div className="fixtures-hub-body">
              <FixturesView
                tournament={tournament}
                players={players}
                myUserId={myUserId}
                selectedMatchId={selectedMatchId}
                liveSession={liveSession}
                onSelectMatch={handleSelectMatch}
              />

              <div className="fixtures-hub-side">
                <StandingsPanel tournament={tournament} players={players} />
                <TournamentStatsPanel tournament={tournament} players={players} />
              </div>
            </div>
          )}

          {phase === "match" && liveSession && (
            <MatchViewer
              result={liveSession.result}
              players={players}
              minute={liveSession.minute}
              phase={liveSession.phase}
              playing={!liveSession.paused}
              isDriver={isHost}
              onMinuteChange={updateLiveMinute}
              onPlayingChange={(playing) => {
                const session = liveSessionRef.current;
                if (!session) return;
                if (playing === session.paused) togglePause();
              }}
              onBack={handleBackFromWatch}
            />
          )}
        </div>
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
