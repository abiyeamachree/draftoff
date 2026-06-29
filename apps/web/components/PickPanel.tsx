"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { DraftTurnOffer, FootballPlayer, PlayerPoolEntry } from "@draftoff/shared";
import { OFFER_PLAYER_LIMIT, slotLineLabel, normalizePlayerPositions, eligibleSlots } from "@draftoff/shared";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";
import { NationFlag } from "@/components/NationFlag";
import { PlayerHoverCard, type HoverPlayer } from "@/components/PlayerHoverCard";
import { StatBar } from "@/components/StatBar";

type Phase = "rolling" | "revealing" | "ready";

const ROLL_MS = 3800;
const REVEAL_STAGGER_MS = 65;
const PREFIX_LEN = 56;
const SUFFIX_LEN = 22;
const DEFAULT_ITEM_W = 144;

function cycleNames(pool: string[], count: number): string[] {
  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const out: string[] = [];
  while (out.length < count) {
    out.push(...shuffled);
  }
  return out.slice(0, count);
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.filter(Boolean))];
}

function buildStrip(
  pool: string[],
  winner: string
): { strip: string[]; winnerIndex: number } {
  const source = uniqueNames(pool.filter((n) => n && n !== winner));
  if (source.length === 0) source.push(winner);

  const strip = [
    ...cycleNames(source, PREFIX_LEN),
    winner,
    ...cycleNames(source, SUFFIX_LEN),
  ];
  return { strip, winnerIndex: PREFIX_LEN };
}

function scrollToCenter(
  index: number,
  containerWidth: number,
  itemWidth: number
): number {
  return Math.max(0, index * itemWidth + itemWidth / 2 - containerWidth / 2);
}

function rollWinnerLabel(offer: DraftTurnOffer): string {
  if (offer.cycleMode === "nation" || offer.nation) {
    return offer.label.split(" · ")[0] || offer.nation || offer.label;
  }
  return (
    offer.team ||
    offer.league ||
    offer.position ||
    offer.label.split(" · ")[0] ||
    offer.label
  );
}

export function squadPicksBySlot(
  players: FootballPlayer[],
  teamSize: number
): (HoverPlayer | null)[] {
  const slots: (HoverPlayer | null)[] = Array(teamSize).fill(null);
  players.forEach((p, fallbackIdx) => {
    const idx =
      typeof p.slotIndex === "number" && p.slotIndex >= 0 && p.slotIndex < teamSize
        ? p.slotIndex
        : fallbackIdx;
    if (idx >= 0 && idx < teamSize) {
      slots[idx] = {
        name: p.name,
        overall: p.overall,
        nation: p.nation,
        team: p.team,
        bestPosition: p.bestPosition,
        positions: p.positions,
        summary: p.summary,
        isPeak: p.isPeak,
      };
    }
  });
  return slots;
}

export function PickPanel({
  code,
  offer,
  turnKey,
  isMyTurn,
  hideRatings,
  formation,
  teamSize,
  occupiedSlots,
  selectedPlayer,
  picking,
  onSelectPlayer,
  onAssignSlot,
  rerollsRemaining = 0,
  rerollsPerPick = 0,
  onPickReady,
  embedded = false,
}: {
  code: string;
  offer: DraftTurnOffer | null;
  turnKey: string;
  isMyTurn: boolean;
  hideRatings: boolean;
  formation: string;
  teamSize: number;
  occupiedSlots: ReadonlySet<number>;
  selectedPlayer: PlayerPoolEntry | null;
  picking: boolean;
  onSelectPlayer: (player: PlayerPoolEntry | null) => void;
  onAssignSlot: (player: PlayerPoolEntry, slotIndex: number) => void;
  rerollsRemaining?: number;
  rerollsPerPick?: number;
  onPickReady?: () => void;
  embedded?: boolean;
}) {
  const { socket } = useSocket();
  const [phase, setPhase] = useState<Phase>("rolling");
  const [revealedCount, setRevealedCount] = useState(0);
  const [scrollPx, setScrollPx] = useState(0);
  const [strip, setStrip] = useState<string[]>([]);
  const [winnerIndex, setWinnerIndex] = useState(0);
  const [stripReady, setStripReady] = useState(false);
  const [animating, setAnimating] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rollTokenRef = useRef(0);
  const pickReadySentRef = useRef("");

  const winnerLabel = useMemo(() => {
    if (!offer) return "";
    if (offer.team) return `${offer.team} · ${offer.season}`;
    return offer.label;
  }, [offer]);

  useEffect(() => {
    onSelectPlayer(null);
    pickReadySentRef.current = "";
  }, [turnKey, onSelectPlayer]);

  useEffect(() => {
    if (!offer) return;
    let cancelled = false;
    const rollToken = ++rollTokenRef.current;

    setPhase("rolling");
    setRevealedCount(0);
    setScrollPx(0);
    setAnimating(false);
    setStripReady(false);
    setStrip([]);

    const winner = rollWinnerLabel(offer);
    const pool = uniqueNames(
      offer.rollPool?.length > 0
        ? offer.rollPool
        : offer.options.map((p) => p.team)
    );

    const { strip: nextStrip, winnerIndex: winIdx } = buildStrip(
      pool.length ? pool : [winner],
      winner
    );
    setWinnerIndex(winIdx);
    setStrip(nextStrip);
    setStripReady(true);

    const rollDone = window.setTimeout(() => {
      if (!cancelled && rollToken === rollTokenRef.current) {
        setAnimating(false);
        setPhase("revealing");
      }
    }, ROLL_MS + 120);

    return () => {
      cancelled = true;
      window.clearTimeout(rollDone);
    };
  }, [turnKey]);

  useLayoutEffect(() => {
    if (!stripReady || strip.length === 0 || phase !== "rolling") return;

    const container = windowRef.current;
    const firstItem = stripRef.current?.children[0] as HTMLElement | undefined;
    if (!container || !firstItem) return;

    const itemWidth = firstItem.getBoundingClientRect().width || DEFAULT_ITEM_W;
    const targetScroll = scrollToCenter(
      winnerIndex,
      container.clientWidth,
      itemWidth
    );

    flushSync(() => {
      setAnimating(false);
      setScrollPx(0);
    });

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      flushSync(() => setAnimating(true));
      raf2 = requestAnimationFrame(() => {
        setScrollPx(targetScroll);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [stripReady, strip, winnerIndex, phase]);

  useEffect(() => {
    if (phase !== "revealing" || !offer) return;
    if (revealedCount >= offer.options.length) {
      setPhase("ready");
      return;
    }
    const t = window.setTimeout(
      () => setRevealedCount((c) => c + 1),
      REVEAL_STAGGER_MS
    );
    return () => window.clearTimeout(t);
  }, [phase, revealedCount, offer]);

  const firstPageCount = offer
    ? Math.min(OFFER_PLAYER_LIMIT, offer.options.length)
    : 0;
  const isPickable =
    Boolean(offer) &&
    firstPageCount > 0 &&
    phase !== "rolling" &&
    revealedCount >= firstPageCount;

  useEffect(() => {
    if (!isMyTurn || !onPickReady || !offer) return;
    if (phase !== "ready" || firstPageCount === 0) return;
    if (pickReadySentRef.current === turnKey) return;

    const lastPopMs = (firstPageCount - 1) * 20 + 280 + 40;

    const t = window.setTimeout(() => {
      if (pickReadySentRef.current === turnKey) return;
      pickReadySentRef.current = turnKey;
      onPickReady();
    }, lastPopMs);

    return () => window.clearTimeout(t);
  }, [isMyTurn, onPickReady, turnKey, phase, firstPageCount, offer]);

  if (!offer) return null;

  function cycle() {
    onSelectPlayer(null);
    socket.emit("draft:cycle", { code, userId: getUserId(code) }, () => {});
  }

  function selectPlayer(player: PlayerPoolEntry) {
    const slots = eligibleSlots(
      player.positions ?? [player.bestPosition],
      formation,
      occupiedSlots,
      teamSize
    );
    if (!slots.length || !isMyTurn || !isPickable || picking) return;
    onSelectPlayer(selectedPlayer?.playerId === player.playerId ? null : player);
  }

  const canInteract = isMyTurn && isPickable && !picking;
  const visiblePlayers =
    phase === "rolling"
      ? []
      : phase === "ready"
        ? offer.options
        : offer.options.slice(0, revealedCount);

  const selectedSlots = selectedPlayer
    ? eligibleSlots(
        selectedPlayer.positions ?? [selectedPlayer.bestPosition],
        formation,
        occupiedSlots,
        teamSize
      )
    : [];

  if (!offer) {
    return null;
  }

  return (
    <div
      className={`panel space-y-3 ${
        embedded ? "pick-panel-embedded" : "mx-auto mt-4 max-w-2xl"
      }`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="title text-[0.55rem] text-white/50">
            {phase === "rolling"
              ? "Rolling…"
              : isPickable
                ? "Your options"
                : "Revealing…"}
          </p>
          <p className="text-xs text-white/40">
            {offer.cycleMode} mode · {offer.options.length} players
            {offer.rollPool?.length ? ` · ${offer.rollPool.length} eligible` : ""}
            {rerollsPerPick > 0
              ? ` · ${rerollsRemaining} re-roll${rerollsRemaining === 1 ? "" : "s"} left`
              : ""}
          </p>
        </div>
        {isMyTurn && isPickable && rerollsPerPick > 0 && (
          <button
            type="button"
            onClick={cycle}
            disabled={rerollsRemaining <= 0}
            className="btn btn-grey px-3 py-2 text-[0.55rem] disabled:opacity-40"
          >
            Re-roll 🎲 ({rerollsRemaining})
          </button>
        )}
      </div>

      <div ref={windowRef} className="team-roll-window">
        {!stripReady && (
          <p className="flex h-full items-center justify-center text-[0.45rem] text-white/40">
            Preparing reel…
          </p>
        )}
        <div
          ref={stripRef}
          className="team-roll-strip"
          style={{
            visibility: stripReady ? "visible" : "hidden",
            transform: `translate3d(-${scrollPx}px, 0, 0)`,
            transition: animating
              ? `transform ${ROLL_MS}ms cubic-bezier(0.08, 0.82, 0.17, 1)`
              : "none",
          }}
        >
          {strip.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className={`team-roll-item ${
                i === winnerIndex && phase !== "rolling" ? "team-roll-winner" : ""
              }`}
            >
              {name}
            </div>
          ))}
        </div>
        <div className="team-roll-marker" aria-hidden />
        <div className="team-roll-vignette team-roll-vignette-left" aria-hidden />
        <div className="team-roll-vignette team-roll-vignette-right" aria-hidden />
      </div>

      {phase !== "rolling" && (
        <p className="text-center text-lg font-bold text-gold">{winnerLabel}</p>
      )}

      {selectedPlayer && canInteract && (
        <div className="inset space-y-2 px-3 py-2">
          <p className="text-center text-xs font-bold text-gold">
            Where should {selectedPlayer.name.split(" ").pop()} play?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {selectedSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onAssignSlot(selectedPlayer, slot)}
                className="btn px-3 py-2 text-[0.55rem]"
              >
                {slotLineLabel(slot, formation, teamSize)}
              </button>
            ))}
          </div>
          <p className="text-center text-[0.65rem] text-white/45">
            Or tap a highlighted slot on the pitch
          </p>
        </div>
      )}

      <ul className="pick-player-list space-y-0.5">
        {phase === "rolling" && (
          <li className="text-center text-white/40">Waiting for the roll to land…</li>
        )}
        {visiblePlayers.map((p, i) => {
          const slots = eligibleSlots(
            p.positions ?? [p.bestPosition],
            formation,
            occupiedSlots,
            teamSize
          );
          const positionsLabel = normalizePlayerPositions(
            p.positions ?? [p.bestPosition]
          ).join(" · ");
          const pickable = p.available && slots.length > 0;
          const isSelected = selectedPlayer?.playerId === p.playerId;
          return (
            <li
              key={`${p.playerId}-${p.edition}`}
              className="player-pop-in"
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <button
                type="button"
                disabled={!canInteract || !pickable}
                onClick={() => selectPlayer(p)}
                className={`inset flex w-full items-center gap-2 px-3 py-1.5 text-left hover:text-gold disabled:opacity-40 ${
                  isSelected ? "ring-2 ring-gold" : ""
                }`}
              >
                <NationFlag nation={p.nation} size={18} />
                <div className="min-w-0 flex-1">
                  <PlayerHoverCard
                    player={p}
                    align="left"
                    placement="below"
                    className="block min-w-0"
                  >
                    <span className="block truncate font-extrabold">{p.name}</span>
                  </PlayerHoverCard>
                  <span className="mt-0.5 block text-[0.6rem] font-bold uppercase tracking-wide text-gold/75">
                    {positionsLabel}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-sm text-white/60">
                  {p.isPeak && <span className="text-amber-300/90">Peak</span>}
                  {!hideRatings && (
                    <StatBar
                      value={p.overall}
                      size="sm"
                      className="min-w-[5.75rem]"
                    />
                  )}
                </span>
              </button>
              {!pickable && isPickable && (
                <p className="px-3 pb-1 text-[0.6rem] text-white/35">No open slot</p>
              )}
            </li>
          );
        })}
        {phase === "ready" && offer.options.length === 0 && (
          <li className="text-white/50">No players left for this roll.</li>
        )}
      </ul>

      {isMyTurn && isPickable && !selectedPlayer && (
        <p className="text-center text-xs text-emerald-300/80">
          Tap a player with an open slot, then choose their position
        </p>
      )}
    </div>
  );
}
