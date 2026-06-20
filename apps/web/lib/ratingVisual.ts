/** Dramatic reference scale on /99 — distinct 80/85/90/95/97+ bands. */

export type RatingVisual = {
  fill: string;
  pattern: string;
  track: string;
  recall: string;
  recallClass: string;
  glow: string;
  elite: boolean;
};

export function getRatingVisual(value: number): RatingVisual {
  const v = Math.max(0, Math.min(99, Math.round(value)));

  if (v >= 97) {
    return {
      fill: "stat-fill-legend",
      pattern: "stat-pattern-legend",
      track: "stat-track-legend",
      recall: "♛",
      recallClass: "stat-recall-crown",
      glow: "stat-glow-legend",
      elite: true,
    };
  }
  if (v >= 95) {
    return {
      fill: "stat-fill-blaze",
      pattern: "stat-pattern-blaze",
      track: "stat-track-blaze",
      recall: "★★",
      recallClass: "stat-recall-double",
      glow: "stat-glow-blaze",
      elite: false,
    };
  }
  if (v >= 90) {
    return {
      fill: "stat-fill-gold",
      pattern: "stat-pattern-gold",
      track: "stat-track-gold",
      recall: "★",
      recallClass: "stat-recall-star-cap",
      glow: "stat-glow-gold",
      elite: false,
    };
  }
  if (v >= 85) {
    return {
      fill: "stat-fill-peak",
      pattern: "stat-pattern-speed85",
      track: "stat-track-peak",
      recall: "",
      recallClass: "",
      glow: "stat-glow-green-strong",
      elite: false,
    };
  }
  if (v >= 80) {
    return {
      fill: "stat-fill-verygood",
      pattern: "stat-pattern-stripes80",
      track: "stat-track-verygood",
      recall: "",
      recallClass: "",
      glow: "stat-glow-green",
      elite: false,
    };
  }
  if (v >= 75) {
    return {
      fill: "stat-fill-good",
      pattern: "stat-pattern-glitch",
      track: "stat-track-good",
      recall: "",
      recallClass: "",
      glow: "",
      elite: false,
    };
  }
  if (v >= 70) {
    return {
      fill: "stat-fill-solid",
      pattern: "stat-pattern-chevron",
      track: "stat-track-solid",
      recall: "",
      recallClass: "",
      glow: "",
      elite: false,
    };
  }
  if (v >= 65) {
    return {
      fill: "stat-fill-mid",
      pattern: "stat-pattern-scanlines",
      track: "stat-track-default",
      recall: "",
      recallClass: "",
      glow: "",
      elite: false,
    };
  }
  if (v >= 60) {
    return {
      fill: "stat-fill-weak",
      pattern: "stat-pattern-dots",
      track: "stat-track-default",
      recall: "",
      recallClass: "",
      glow: "",
      elite: false,
    };
  }
  return {
    fill: "stat-fill-broken",
    pattern: "stat-pattern-hash",
    track: "stat-track-default",
    recall: "",
    recallClass: "",
    glow: "",
    elite: false,
  };
}
