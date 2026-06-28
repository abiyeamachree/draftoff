"use client";

import type { TeamVisual } from "@/lib/teamVisual";
import { NationFlag } from "@/components/NationFlag";

export function TeamBadge({
  visual,
  size = 18,
}: {
  visual: TeamVisual;
  size?: number;
}) {
  if (visual.kind === "nation" && visual.nation) {
    return <NationFlag nation={visual.nation} size={size} />;
  }
  if (visual.kind === "club") {
    return (
      <span
        className="inline-block shrink-0 rounded-full border border-white/40 shadow-sm"
        style={{
          width: size,
          height: size,
          background: visual.color,
        }}
        title={visual.name}
      />
    );
  }
  if (visual.kind === "human" && visual.emoji) {
    return (
      <span className="text-base leading-none" title={visual.name}>
        {visual.emoji}
      </span>
    );
  }
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-white/30"
      style={{ width: size, height: size, background: visual.color }}
      title={visual.name}
    />
  );
}
