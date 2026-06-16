"use client";

import { useState } from "react";
import {
  describePool,
  emptyPoolFilter,
  type PoolLogic,
  type PoolRules,
} from "@draftoff/shared";
import { LEAGUE_CLUBS, POOL_OPTIONS, type PoolKey } from "@/lib/draftPresets";

type Side = "include" | "exclude";

const SIMPLE_SECTIONS: { key: PoolKey; label: string }[] = [
  { key: "nations", label: "Nations" },
  { key: "seasons", label: "Seasons" },
];

function PlusMinus({
  side,
  onInclude,
  onExclude,
}: {
  side: Side | null;
  onInclude: () => void;
  onExclude: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onInclude}
        aria-label="Include"
        className={`h-7 w-7 border-2 border-black text-sm font-extrabold ${
          side === "include"
            ? "bg-green-500 text-black"
            : "bg-black/40 text-white/50 hover:text-white"
        }`}
      >
        +
      </button>
      <button
        type="button"
        onClick={onExclude}
        aria-label="Exclude"
        className={`h-7 w-7 border-2 border-black text-sm font-extrabold ${
          side === "exclude"
            ? "bg-red-500 text-black"
            : "bg-black/40 text-white/50 hover:text-white"
        }`}
      >
        −
      </button>
    </span>
  );
}

export function PoolPicker({
  pool,
  setPool,
  onClose,
}: {
  pool: PoolRules;
  setPool: (updater: (prev: PoolRules) => PoolRules) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  function sideOf(key: PoolKey, value: string): Side | null {
    if (pool.include[key].includes(value)) return "include";
    if (pool.exclude[key].includes(value)) return "exclude";
    return null;
  }

  function setSide(key: PoolKey, value: string, side: Side | null) {
    setPool((prev) => {
      const include = { ...prev.include, [key]: prev.include[key].filter((v) => v !== value) };
      const exclude = { ...prev.exclude, [key]: prev.exclude[key].filter((v) => v !== value) };
      if (side === "include") include[key] = [...include[key], value];
      if (side === "exclude") exclude[key] = [...exclude[key], value];
      return { ...prev, include, exclude };
    });
  }

  function toggle(key: PoolKey, value: string, side: Side) {
    setSide(key, value, sideOf(key, value) === side ? null : side);
  }

  // Clubs inherit their league's state unless overridden explicitly.
  function clubSide(league: string, club: string): Side | null {
    if (pool.include.clubs.includes(club)) return "include";
    if (pool.exclude.clubs.includes(club)) return "exclude";
    if (pool.include.leagues.includes(league)) return "include";
    if (pool.exclude.leagues.includes(league)) return "exclude";
    return null;
  }

  function toggleClub(club: string, side: Side) {
    toggle("clubs", club, side);
  }

  function allIncluded(key: PoolKey): boolean {
    const all = POOL_OPTIONS[key];
    return all.length > 0 && all.every((v) => pool.include[key].includes(v));
  }

  function selectAll(key: PoolKey, on: boolean) {
    const all = POOL_OPTIONS[key];
    setPool((prev) => ({
      ...prev,
      include: {
        ...prev.include,
        [key]: on
          ? Array.from(new Set([...prev.include[key], ...all]))
          : prev.include[key].filter((v) => !all.includes(v)),
      },
      exclude: {
        ...prev.exclude,
        [key]: on ? prev.exclude[key].filter((v) => !all.includes(v)) : prev.exclude[key],
      },
    }));
  }

  function setLogic(logic: PoolLogic) {
    setPool((prev) => ({ ...prev, logic }));
  }

  function clearAll() {
    setPool((prev) => ({ ...prev, include: emptyPoolFilter(), exclude: emptyPoolFilter() }));
  }

  function optionsFor(key: PoolKey): string[] {
    const merged = Array.from(
      new Set([...POOL_OPTIONS[key], ...pool.include[key], ...pool.exclude[key]])
    );
    return merged.filter((opt) => opt.toLowerCase().includes(q));
  }

  const allLeagues = Array.from(
    new Set([...POOL_OPTIONS.leagues, ...pool.include.leagues, ...pool.exclude.leagues])
  );
  const leagueRows = allLeagues
    .map((league) => {
      const clubs = LEAGUE_CLUBS[league] ?? [];
      const nameMatches = !q || league.toLowerCase().includes(q);
      const visibleClubs =
        q && !nameMatches ? clubs.filter((c) => c.toLowerCase().includes(q)) : clubs;
      const isExpanded =
        (expanded[league] ?? false) || (q.length > 0 && !nameMatches && visibleClubs.length > 0);
      return { league, clubs, visibleClubs, isExpanded };
    })
    .filter((row) => !q || row.league.toLowerCase().includes(q) || row.visibleClubs.length > 0);

  const includeChips = (["leagues", "nations", "seasons", "clubs"] as PoolKey[]).flatMap((key) =>
    pool.include[key].map((value) => ({ key, value }))
  );
  const excludeChips = (["leagues", "nations", "seasons", "clubs"] as PoolKey[]).flatMap((key) =>
    pool.exclude[key].map((value) => ({ key, value }))
  );

  function selectAllButton(key: PoolKey) {
    const on = allIncluded(key);
    return (
      <button
        type="button"
        onClick={() => selectAll(key, !on)}
        className="pill bg-black/40 text-white/70 hover:text-gold"
      >
        {on ? "Clear" : "Select all"}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[88vh] w-full max-w-md flex-col gap-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="title text-sm">Build your pool</h2>
          <button
            type="button"
            onClick={onClose}
            className="pill bg-black/40 text-white/70 hover:text-gold"
          >
            Done
          </button>
        </div>

        <p
          className="inset max-h-16 overflow-y-auto px-3 py-2 normal-case leading-snug text-gold"
          style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
        >
          {describePool(pool)}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-white/60">Match</span>
          <div className="flex gap-1">
            {(["OR", "AND"] as const).map((logic) => (
              <button
                key={logic}
                type="button"
                onClick={() => setLogic(logic)}
                className={`btn px-3 py-1 text-[0.55rem] ${pool.logic === logic ? "" : "btn-grey"}`}
              >
                {logic === "OR" ? "Any" : "All"}
              </button>
            ))}
          </div>
        </div>

        {(includeChips.length > 0 || excludeChips.length > 0) && (
          <div className="space-y-1.5">
            {includeChips.length > 0 && (
              <div>
                <span className="title text-[0.55rem] text-green-400">Include</span>
                <div
                  className="mt-1 flex flex-wrap gap-1 overflow-y-auto"
                  style={{ maxHeight: "4.8rem" }}
                >
                  {includeChips.map(({ key, value }) => (
                    <button
                      key={`${key}:${value}`}
                      type="button"
                      onClick={() => setSide(key, value, null)}
                      className="pill shrink-0 bg-green-600/30 text-green-200 hover:text-white"
                    >
                      {value} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
            {excludeChips.length > 0 && (
              <div>
                <span className="title text-[0.55rem] text-red-400">Exclude</span>
                <div
                  className="mt-1 flex flex-wrap gap-1 overflow-y-auto"
                  style={{ maxHeight: "4.8rem" }}
                >
                  {excludeChips.map(({ key, value }) => (
                    <button
                      key={`${key}:${value}`}
                      type="button"
                      onClick={() => setSide(key, value, null)}
                      className="pill shrink-0 bg-red-600/30 text-red-200 hover:text-white"
                    >
                      {value} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leagues, clubs, nations…"
          className="field"
        />

        <div className="-mr-2 space-y-4 overflow-y-auto pr-2">
          {leagueRows.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="title text-[0.6rem] text-gold">Leagues</span>
                {selectAllButton("leagues")}
              </div>
              <ul className="space-y-1">
                {leagueRows.map(({ league, clubs, visibleClubs, isExpanded }) => {
                  const lside = sideOf("leagues", league);
                  const hasClubs = clubs.length > 0;
                  return (
                    <li key={league}>
                      <div className="flex items-center justify-between gap-2 py-1">
                        <button
                          type="button"
                          onClick={() =>
                            hasClubs &&
                            setExpanded((e) => ({ ...e, [league]: !(e[league] ?? false) }))
                          }
                          className="flex items-center gap-2 text-left"
                        >
                          <span className="w-3 text-gold">
                            {hasClubs ? (isExpanded ? "▾" : "▸") : ""}
                          </span>
                          <span className={lside === "exclude" ? "text-white/40 line-through" : ""}>
                            {league}
                          </span>
                        </button>
                        <PlusMinus
                          side={lside}
                          onInclude={() => toggle("leagues", league, "include")}
                          onExclude={() => toggle("leagues", league, "exclude")}
                        />
                      </div>
                      {isExpanded && visibleClubs.length > 0 && (
                        <ul className="ml-5 border-l-2 border-black/40 pl-2">
                          {visibleClubs.map((club) => {
                            const cside = clubSide(league, club);
                            return (
                              <li
                                key={club}
                                className="flex items-center justify-between gap-2 py-1"
                              >
                                <span
                                  className={`text-sm ${
                                    cside === "exclude" ? "text-white/40 line-through" : ""
                                  }`}
                                >
                                  {club}
                                </span>
                                <PlusMinus
                                  side={cside}
                                  onInclude={() => toggleClub(club, "include")}
                                  onExclude={() => toggleClub(club, "exclude")}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {SIMPLE_SECTIONS.map(({ key, label }) => {
            const options = optionsFor(key);
            if (options.length === 0) return null;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="title text-[0.6rem] text-gold">{label}</span>
                  {selectAllButton(key)}
                </div>
                <ul>
                  {options.map((opt) => {
                    const side = sideOf(key, opt);
                    return (
                      <li key={opt} className="flex items-center justify-between gap-2 py-1">
                        <span className={side === "exclude" ? "text-white/40 line-through" : ""}>
                          {opt}
                        </span>
                        <PlusMinus
                          side={side}
                          onInclude={() => toggle(key, opt, "include")}
                          onExclude={() => toggle(key, opt, "exclude")}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between border-t-2 border-black/40 pt-3">
          <button
            type="button"
            onClick={clearAll}
            className="btn btn-grey px-3 py-2 text-[0.6rem]"
          >
            Clear all
          </button>
          <button type="button" onClick={onClose} className="btn px-3 py-2 text-[0.6rem]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
