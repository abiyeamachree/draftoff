"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerPoolEntry } from "@draftoff/shared";
import { defaultFormation, eligibleSlots, getIconKitColors } from "@draftoff/shared";
import { useLobby } from "@/hooks/useLobby";
import { useDraft } from "@/hooks/useDraft";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";
import { PitchView } from "@/components/PitchView";
import { PickPanel, squadPicksBySlot } from "@/components/PickPanel";
import { RoomChatProvider, SpeechBubble, useRoomChat } from "@/components/RoomChat";
import { GameSessionProvider } from "@/components/GameSession";
import { HostControls } from "@/components/HostControls";

function DraftContent({ code }: { code: string }) {
  const router = useRouter();
  const { socket } = useSocket();
  const { draft, timeRemaining, startCountdown } = useDraft(code);
  const { lobby } = useLobby(code);
  const { bubbleFor } = useRoomChat();

  const [myUserId, setMyUserId] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPoolEntry | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [viewOwnTeam, setViewOwnTeam] = useState(false);

  useEffect(() => setMyUserId(getUserId(code) ?? ""), [code]);

  useEffect(() => {
    if (draft?.complete) {
      router.push(`/results/${code}`);
    }
  }, [draft?.complete, code, router]);

  useEffect(() => {
    if (lobby?.status === "LOBBY") {
      router.push(`/lobby/${code}`);
    }
  }, [lobby?.status, code, router]);

  const playerFor = (userId: string | null) =>
    lobby?.players.find((p) => p.userId === userId) ?? null;
  const nameFor = (userId: string | null) =>
    playerFor(userId)?.displayName ?? userId ?? "?";

  const teamSize = lobby?.settings.teamSize ?? 11;
  const activeUserId = draft?.activeUserId ?? null;
  const mySquad = draft?.squads.find((s) => s.userId === myUserId) ?? null;
  const activeSquad = draft?.squads.find((s) => s.userId === activeUserId) ?? null;
  const displayUserId = viewOwnTeam ? myUserId : activeUserId;
  const displaySquad =
    draft?.squads.find((s) => s.userId === displayUserId) ?? activeSquad;
  const displayPlayer = playerFor(displayUserId);
  const myPlayer = playerFor(myUserId);
  const pickFormation = myPlayer?.formation || defaultFormation(teamSize);
  const displayFormation = displayPlayer?.formation || defaultFormation(teamSize);
  const kitColors = getIconKitColors(displayPlayer?.icon);
  const pitchPicks = squadPicksBySlot(displaySquad?.players ?? [], teamSize);
  const occupiedSlots = new Set(
    (mySquad?.players ?? [])
      .map((p) => p.slotIndex)
      .filter((s): s is number => typeof s === "number" && s >= 0)
  );
  const squads = draft?.squads ?? [];
  const countingDown = typeof startCountdown === "number" && startCountdown > 0;
  const isMyTurn = Boolean(
    draft?.activeUserId === myUserId && !draft?.complete && !countingDown
  );
  const timerPaused = Boolean(
    draft?.turnOffer && !countingDown && !draft.complete && !draft.pickTimerActive
  );
  const viewingOwnTeam = viewOwnTeam;

  const signalPickReady = useCallback(() => {
    socket.emit(
      "draft:pickReady",
      { code, userId: getUserId(code) },
      () => {}
    );
  }, [code, socket]);

  const assignPick = useCallback(
    (player: PlayerPoolEntry, slotIndex: number) => {
      if (player.pickable === false || picking || !isMyTurn || !draft) return;

      const allowed = eligibleSlots(
        player.positions ?? [player.bestPosition],
        pickFormation,
        occupiedSlots,
        teamSize
      );
      if (!allowed.includes(slotIndex)) {
        setPickError("That position is not available for this player");
        return;
      }

      setPickError(null);
      setPicking(true);
      socket.emit(
        "draft:pick",
        {
          code,
          userId: getUserId(code),
          playerId: player.playerId,
          edition: player.edition,
          slotIndex,
        },
        (res) => {
          setPicking(false);
          if (!res.ok) {
            setPickError(res.error);
            return;
          }
          setSelectedPlayer(null);
        }
      );
    },
    [code, isMyTurn, picking, socket, pickFormation, teamSize, occupiedSlots, draft]
  );

  const turnKey = draft
    ? `${draft.currentPickIndex}-${draft.activeUserId ?? ""}-${draft.turnOffer?.label ?? ""}`
    : "";

  useEffect(() => {
    setSelectedPlayer(null);
    setPickError(null);
    setViewOwnTeam(draft?.activeUserId === myUserId);
  }, [turnKey, draft?.activeUserId, myUserId]);

  return (
    <section className="relative mx-auto flex min-h-[85vh] w-full max-w-none flex-col px-4 pb-20 lg:px-6">
      <HostControls code={code} />
      <header className="flex items-center justify-between">
        <h1 className="title text-xl">
          {lobby?.settings.name || (
            <>
              Draft <span className="font-mono text-gold">{code}</span>
            </>
          )}
        </h1>
        <div
          className={`inset title px-4 py-2 text-base ${
            timerPaused ? "text-white/50" : "text-gold"
          }`}
        >
          {countingDown
            ? "Starting…"
            : timerPaused
              ? `${draft?.timeRemaining ?? "--"}s · waiting`
              : `${timeRemaining ?? "--"}s`}
        </div>
      </header>

      {!draft ? (
        <p className="mt-6 font-bold text-white/60">Waiting for the draft to start…</p>
      ) : (
        <div className="mt-4 flex-1">
          <div className="draft-room-body">
            <div className="draft-room-pitch">
              <div className="draft-pitch-stage">
                {countingDown && (
                  <div className="draft-start-countdown" aria-live="polite">
                    <span className="draft-start-countdown-num">{startCountdown}</span>
                  </div>
                )}
                <div className="draft-pitch-stage-inner">
                  {squads.map((squad, i) => {
                    const angle = (i / Math.max(1, squads.length)) * 2 * Math.PI - Math.PI / 2;
                    const left = 50 + 48 * Math.cos(angle);
                    const top = 50 + 48 * Math.sin(angle);
                    const isActive = squad.userId === activeUserId;
                    const p = playerFor(squad.userId);
                    return (
                      <div
                        key={squad.userId}
                        className="absolute z-20 flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      >
                        <div className="relative">
                          <SpeechBubble
                            text={bubbleFor(squad.userId)}
                            className="bottom-full left-1/2 mb-2 -translate-x-1/2"
                          />
                          <div
                            className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-black bg-black/50 text-4xl shadow-lg ${
                              isActive ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent" : ""
                            }`}
                          >
                            {p?.icon ?? "⚽"}
                          </div>
                        </div>
                        <span
                          className={`mt-1.5 max-w-full truncate text-[0.65rem] font-bold ${
                            isActive ? "text-gold" : "text-white/80"
                          }`}
                          style={{ textShadow: "1px 1px 0 #000" }}
                        >
                          {nameFor(squad.userId)}
                        </span>
                        <span className="text-[0.55rem] text-white/50">
                          {squad.players.length}/{draft.totalRounds}
                        </span>
                      </div>
                    );
                  })}

                  <div className="absolute left-1/2 top-1/2 z-10 w-[58%] -translate-x-1/2 -translate-y-1/2">
                    <PitchView
                      formation={displayFormation}
                      picks={pitchPicks}
                      teamSize={teamSize}
                      kitColors={kitColors}
                      compact
                      highlightSlots={
                        isMyTurn && viewingOwnTeam && selectedPlayer
                          ? eligibleSlots(
                              selectedPlayer.positions ?? [selectedPlayer.bestPosition],
                              pickFormation,
                              occupiedSlots,
                              teamSize
                            )
                          : undefined
                      }
                      onSlotClick={
                        isMyTurn && viewingOwnTeam && selectedPlayer
                          ? (slot) => assignPick(selectedPlayer, slot)
                          : undefined
                      }
                      header={
                        <>
                          <span className="text-lg leading-none">{displayPlayer?.icon ?? "⚽"}</span>
                          <span className="truncate text-[0.55rem] font-extrabold text-gold">
                            {draft.complete
                              ? "Draft complete"
                              : viewingOwnTeam
                                ? "My team"
                                : nameFor(activeUserId)}
                          </span>
                          <span className="text-[0.5rem] text-white/60">{displayFormation}</span>
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="draft-room-panel">
              <div className="draft-room-panel-header">
                <div>
                  <p className="text-sm font-bold">Draft</p>
                  <p className="text-xs text-white/50">
                    Round {draft.round + 1} of {draft.totalRounds} · pick{" "}
                    {draft.currentPickIndex + 1} of {draft.order.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewOwnTeam((v) => !v)}
                  className="btn btn-grey shrink-0 px-3 py-2 text-[0.55rem]"
                >
                  {viewOwnTeam ? "View opponent" : "View my team"}
                </button>
              </div>

              <div className="draft-room-panel-body">
                {isMyTurn && (
                  <p className="text-center text-lg text-emerald-300">Your pick!</p>
                )}

                {pickError && (
                  <p className="text-center text-sm font-bold text-red-300">{pickError}</p>
                )}

                {countingDown ? (
                  <p className="text-center text-sm text-white/50">Draft starting…</p>
                ) : (
                  <PickPanel
                    key={turnKey}
                    code={code}
                    offer={draft.turnOffer}
                    turnKey={turnKey}
                    isMyTurn={isMyTurn}
                    hideRatings={lobby?.settings.hideRatings ?? false}
                    formation={pickFormation}
                    teamSize={teamSize}
                    occupiedSlots={occupiedSlots}
                    selectedPlayer={selectedPlayer}
                    picking={picking}
                    onSelectPlayer={setSelectedPlayer}
                    onAssignSlot={assignPick}
                    onPickReady={signalPickReady}
                    rerollsRemaining={draft.rerollsRemaining}
                    rerollsPerPick={lobby?.settings.rerollsPerPick ?? 0}
                    embedded
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function DraftRoom({ code }: { code: string }) {
  const { lobby } = useLobby(code);
  const playerIds = lobby?.players.map((p) => p.userId) ?? [];

  return (
    <GameSessionProvider code={code}>
      <RoomChatProvider code={code} playerIds={playerIds}>
        <DraftContent code={code} />
      </RoomChatProvider>
    </GameSessionProvider>
  );
}
