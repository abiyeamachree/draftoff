"use client";

import { useEffect, useRef, useState } from "react";

export const HALFTIME_BREAK_MS = 1500;

/** Pause at 45', show HT overlay, then resume at 46'. */
export function useHalftimeBreak(
  minute: number,
  maxMinute: number,
  isActive: boolean,
  onMinuteChange: (m: number) => void,
  onPause: () => void,
  onResume: () => void
) {
  const [halftime, setHalftime] = useState(false);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!isActive || maxMinute <= 45 || triggeredRef.current) return;
    if (minute !== 45) return;

    triggeredRef.current = true;
    setHalftime(true);
    onPause();

    const t = window.setTimeout(() => {
      setHalftime(false);
      onMinuteChange(46);
      onResume();
    }, HALFTIME_BREAK_MS);

    return () => window.clearTimeout(t);
  }, [minute, maxMinute, isActive, onMinuteChange, onPause, onResume]);

  return halftime;
}
