"use client";

import { useEffect, useState } from "react";

function WhistleIcon() {
  return (
    <svg className="ht-splash-icon" viewBox="0 0 64 64" aria-hidden>
      <ellipse cx="32" cy="34" rx="22" ry="14" fill="white" stroke="#111" strokeWidth="2" />
      <circle cx="48" cy="34" r="5" fill="#111" />
      <path d="M10 34 L22 34" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 28 Q18 22 24 24" fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function HalftimeOverlay({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className="ht-splash" role="status" aria-live="polite">
      <div className="ht-splash-track">
        <div className="ht-splash-left">
          <WhistleIcon />
        </div>
        <div className="ht-splash-text-wrap">
          <span className="ht-splash-title">HALF TIME!</span>
        </div>
      </div>
    </div>
  );
}
