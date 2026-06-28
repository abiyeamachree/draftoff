"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerPoolEntry, PlayerSummaryStats } from "@draftoff/shared";
import { normalizePlayerPositions } from "@draftoff/shared";
import { NationFlag } from "@/components/NationFlag";
import { StatBar } from "@/components/StatBar";

export type HoverPlayer = Pick<
  PlayerPoolEntry,
  "name" | "overall" | "nation" | "team" | "bestPosition" | "positions" | "summary" | "isPeak"
>;

const FACE_STATS: { key: keyof PlayerSummaryStats; label: string }[] = [
  { key: "pace", label: "PAC" },
  { key: "shooting", label: "SHO" },
  { key: "passing", label: "PAS" },
  { key: "dribbling", label: "DRI" },
  { key: "defending", label: "DEF" },
  { key: "physical", label: "PHY" },
];

const CARD_W = 300;
const CARD_EST_H = 148;
const VIEWPORT_PAD = 8;

function HoverCardBody({ player }: { player: HoverPlayer }) {
  const positions = normalizePlayerPositions(player.positions ?? [player.bestPosition]);
  const summary = player.summary;

  return (
    <div className="player-hover-grid">
      <div className="player-hover-top">
        <div className="player-hover-identity">
          <span className="player-hover-head">
            <NationFlag nation={player.nation} size={18} />
            <span className="player-hover-name">{player.name}</span>
            {player.isPeak ? <span className="player-hover-peak">Peak</span> : null}
          </span>
          <span className="player-hover-positions">{positions.join(" · ")}</span>
          <span className="player-hover-meta">
            {player.team || "Free agent"} · {player.nation}
          </span>
        </div>
        <StatBar
          value={player.overall}
          size="sm"
          label="OVR"
          showRecall
          className="player-hover-ovr"
        />
      </div>
      {summary ? (
        <div className="player-hover-stats">
          {FACE_STATS.map(({ key, label }) => (
            <StatBar
              key={key}
              label={label}
              value={summary[key] ?? 0}
              size="xs"
              showRecall
            />
          ))}
        </div>
      ) : (
        <span className="player-hover-meta player-hover-stats-fallback">Stats unavailable</span>
      )}
    </div>
  );
}

export function PlayerHoverCard({
  player,
  children,
  align = "center",
  placement = "above",
  className = "",
}: {
  player: HoverPlayer;
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  placement?: "above" | "below";
  className?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const preferBelow = placement === "below";
    let top = preferBelow
      ? rect.bottom + 6
      : rect.top - CARD_EST_H - 6;

    if (top < VIEWPORT_PAD) {
      top = rect.bottom + 6;
    } else if (top + CARD_EST_H > window.innerHeight - VIEWPORT_PAD) {
      top = Math.max(VIEWPORT_PAD, rect.top - CARD_EST_H - 6);
    }

    let left =
      align === "center"
        ? rect.left + rect.width / 2 - CARD_W / 2
        : align === "right"
          ? rect.right - CARD_W
          : rect.left;

    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - CARD_W - VIEWPORT_PAD)
    );

    setCoords({ top, left });
  }, [align, placement]);

  const show = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    hideTimerRef.current = window.setTimeout(() => setOpen(false), 80);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  return (
    <>
      <span
        ref={anchorRef}
        className={`player-hover-wrap ${className}`.trim()}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`player-hover-card player-hover-card-portal ${
              player.overall >= 97 ? "player-hover-card-elite" : ""
            }`}
            style={{ top: coords.top, left: coords.left, width: CARD_W }}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <HoverCardBody player={player} />
          </div>,
          document.body
        )}
    </>
  );
}
