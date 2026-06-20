import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  safelist: [
    // StatBar tier classes are composed dynamically from ratingVisual.ts
    { pattern: /^stat-fill-/ },
    { pattern: /^stat-pattern-/ },
    { pattern: /^stat-track-/ },
    { pattern: /^stat-recall-/ },
    { pattern: /^stat-glow-/ },
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: "#0b6e4f",
          dark: "#064e3b",
        },
        gold: "#f5c518",
      },
    },
  },
  plugins: [],
};

export default config;
