"use client";

import { nationFlagSrc } from "@/lib/nationFlags";

export function NationFlag({
  nation,
  size = 16,
  className = "",
}: {
  nation: string;
  size?: number;
  className?: string;
}) {
  const src = nationFlagSrc(nation, size <= 20 ? 20 : 40);
  if (!src) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-white/10 text-[0.55rem] ${className}`}
        style={{ width: size, height: Math.round(size * 0.75) }}
        title={nation}
        aria-hidden
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block shrink-0 rounded-sm object-cover shadow-sm ${className}`}
      title={nation}
      loading="lazy"
    />
  );
}
