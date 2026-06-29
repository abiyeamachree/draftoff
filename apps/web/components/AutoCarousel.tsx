"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

export function AutoCarousel({
  slides,
  intervalMs = 4500,
  className = "",
}: {
  slides: ReactNode[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => go(1), intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs, go]);

  if (count === 0) {
    return (
      <div className={`fixtures-carousel empty ${className}`}>
        <p className="text-xs text-white/40">No data yet</p>
      </div>
    );
  }

  return (
    <div className={`fixtures-carousel ${className}`}>
      <div className="fixtures-carousel-viewport">{slides[index]}</div>
      {count > 1 && (
        <div className="fixtures-carousel-controls">
          <button type="button" className="fixtures-carousel-btn" onClick={() => go(-1)} aria-label="Previous">
            ‹
          </button>
          <div className="fixtures-carousel-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`fixtures-carousel-dot ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button type="button" className="fixtures-carousel-btn" onClick={() => go(1)} aria-label="Next">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
