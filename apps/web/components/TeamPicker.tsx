"use client";

import { useMemo, useState } from "react";
import {
  SEASON_LEAGUE_CLUBS,
  TEAM_SEASONS,
  teamLabel,
  teamsBySeason,
} from "@/lib/draftPresets";

export function TeamPicker({
  teams,
  setTeams,
  spots,
  onClose,
}: {
  teams: string[];
  setTeams: (updater: (prev: string[]) => string[]) => void;
  spots: number;
  onClose: () => void;
}) {
  const [season, setSeason] = useState<string>(TEAM_SEASONS[0]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const leagueClubs = SEASON_LEAGUE_CLUBS[season] ?? {};
  const leagues = Object.keys(leagueClubs);
  const grouped = useMemo(() => teamsBySeason(teams), [teams]);

  function toggle(label: string) {
    setTeams((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  }

  function toggleLeague(labels: string[], allOn: boolean) {
    setTeams((prev) =>
      allOn
        ? prev.filter((c) => !labels.includes(c))
        : Array.from(new Set([...prev, ...labels]))
    );
  }

  function removeSelected(label: string) {
    setTeams((prev) => prev.filter((c) => c !== label));
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
          <h2 className="title text-sm">League teams</h2>
          <button
            type="button"
            onClick={onClose}
            className="pill bg-black/40 text-white/70 hover:text-gold"
          >
            Done
          </button>
        </div>

        <p
          className="inset px-3 py-2 normal-case leading-snug text-gold"
          style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
        >
          {teams.length === 0
            ? `Pick clubs to fill up to ${spots} league spots. Switch season to add teams from other years.`
            : `${Math.min(teams.length, spots)} of ${spots} spots filled (${teams.length} selected).`}
        </p>

        <label className="block">
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Season
          </span>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="field mt-1"
          >
            {TEAM_SEASONS.map((s) => (
              <option key={s} value={s} className="bg-pitch-dark">
                {s}
              </option>
            ))}
          </select>
        </label>

        {teams.length > 0 && (
          <div className="max-h-28 space-y-2 overflow-y-auto rounded border-2 border-black/40 bg-black/20 p-2">
            <span className="title text-[0.55rem] text-white/50">Selected</span>
            {Object.entries(grouped).map(([s, clubs]) => (
              <div key={s} className="space-y-1">
                <span className="title text-[0.55rem] text-gold">{s}</span>
                <div className="flex flex-wrap gap-1">
                  {clubs.map((club) => {
                    const label = teamLabel(club, s);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => removeSelected(label)}
                        className="pill bg-gold/20 text-[0.55rem] text-gold hover:bg-red-900/40 hover:text-red-200"
                        title="Remove"
                      >
                        {club} ×
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${season} clubs…`}
          className="field"
        />

        <div className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2">
          {leagues.map((league) => {
            const allClubs = leagueClubs[league] ?? [];
            const clubs = allClubs.filter(
              (c) => !q || c.toLowerCase().includes(q) || league.toLowerCase().includes(q)
            );
            if (clubs.length === 0) return null;
            const allLabels = allClubs.map((c) => teamLabel(c, season));
            const allOn = allLabels.every((l) => teams.includes(l));
            return (
              <div key={league} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="title text-[0.6rem] text-gold">{league}</span>
                  <button
                    type="button"
                    onClick={() => toggleLeague(allLabels, allOn)}
                    className="pill bg-black/40 text-white/70 hover:text-gold"
                  >
                    {allOn ? "Clear" : "Add all"}
                  </button>
                </div>
                <ul>
                  {clubs.map((club) => {
                    const label = teamLabel(club, season);
                    const on = teams.includes(label);
                    return (
                      <li key={label}>
                        <button
                          type="button"
                          onClick={() => toggle(label)}
                          className="flex w-full items-center gap-2 px-1 py-1 text-left hover:text-gold"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black text-sm ${
                              on ? "bg-gold text-black" : "bg-black/40"
                            }`}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span>{club}</span>
                          <span className="ml-auto text-xs text-white/40">{season}</span>
                        </button>
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
            onClick={() => setTeams(() => [])}
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
