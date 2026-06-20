"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchLeagues,
  fetchSeasons,
  fetchTeams,
  TAG_LABELS,
  type CatalogTeam,
  type TeamTag,
} from "@/lib/catalog";

const TAG_FILTERS: (TeamTag | "all")[] = [
  "all",
  "ucl",
  "uel",
  "uecl",
  "promoted",
  "relegated",
];

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
  const [seasons, setSeasons] = useState<{ season: string }[]>([]);
  const [season, setSeason] = useState("");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [league, setLeague] = useState<string>("");
  const [tag, setTag] = useState<TeamTag | "all">("all");
  const [catalogTeams, setCatalogTeams] = useState<CatalogTeam[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeasons()
      .then((s) => {
        setSeasons(s.map(({ season }) => ({ season })));
        if (s[0]) setSeason(s[0].season);
      })
      .catch(() => setError("Could not load seasons — is the server seeded?"));
  }, []);

  useEffect(() => {
    if (!season) return;
    setLoading(true);
    fetchLeagues(season)
      .then(setLeagues)
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, [season]);

  useEffect(() => {
    if (!season) return;
    setLoading(true);
    fetchTeams(season, {
      league: league || undefined,
      tag: tag === "all" ? undefined : tag,
    })
      .then(setCatalogTeams)
      .catch(() => {
        setCatalogTeams([]);
        setError("Could not load teams");
      })
      .finally(() => setLoading(false));
  }, [season, league, tag]);

  const q = query.trim().toLowerCase();
  const byLeague = useMemo(() => {
    const map = new Map<string, CatalogTeam[]>();
    for (const t of catalogTeams) {
      if (q && !t.team.toLowerCase().includes(q) && !t.league.toLowerCase().includes(q))
        continue;
      const list = map.get(t.league) ?? [];
      list.push(t);
      map.set(t.league, list);
    }
    return map;
  }, [catalogTeams, q]);

  function toggle(label: string) {
    setTeams((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  }

  function toggleLeague(entries: CatalogTeam[], allOn: boolean) {
    const labels = entries.map((e) => e.label);
    setTeams((prev) =>
      allOn
        ? prev.filter((c) => !labels.includes(c))
        : Array.from(new Set([...prev, ...labels]))
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
            ? `Pick clubs to fill up to ${spots} league spots. Filter by competition tags.`
            : `${Math.min(teams.length, spots)} of ${spots} spots filled (${teams.length} selected).`}
        </p>

        {error && <p className="text-sm font-bold text-red-300">{error}</p>}

        <label className="block">
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Season
          </span>
          <select
            value={season}
            onChange={(e) => {
              setSeason(e.target.value);
              setLeague("");
            }}
            className="field mt-1"
          >
            {seasons.map((s) => (
              <option key={s.season} value={s.season} className="bg-pitch-dark">
                {s.season}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-1">
          {TAG_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t)}
              className={`pill ${tag === t ? "bg-gold text-black" : "bg-black/40 text-white/70 hover:text-gold"}`}
            >
              {t === "all" ? "All" : TAG_LABELS[t]}
            </button>
          ))}
        </div>

        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="field"
        >
          <option value="">All leagues</option>
          {leagues.map((lg) => (
            <option key={lg} value={lg} className="bg-pitch-dark">
              {lg}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${season} clubs…`}
          className="field"
        />

        <div className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2">
          {loading && <p className="text-white/50">Loading teams…</p>}
          {Array.from(byLeague.entries()).map(([lg, entries]) => {
            const allOn = entries.every((e) => teams.includes(e.label));
            return (
              <div key={lg} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="title text-[0.6rem] text-gold">{lg}</span>
                  <button
                    type="button"
                    onClick={() => toggleLeague(entries, allOn)}
                    className="pill bg-black/40 text-white/70 hover:text-gold"
                  >
                    {allOn ? "Clear" : "Add all"}
                  </button>
                </div>
                <ul>
                  {entries.map((entry) => {
                    const on = teams.includes(entry.label);
                    return (
                      <li key={entry.label}>
                        <button
                          type="button"
                          onClick={() => toggle(entry.label)}
                          className="flex w-full items-center gap-2 px-1 py-1 text-left hover:text-gold"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black text-sm ${
                              on ? "bg-gold text-black" : "bg-black/40"
                            }`}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className="flex-1">{entry.team}</span>
                          <span className="flex gap-0.5">
                            {entry.tags.map((tg) => (
                              <span
                                key={tg}
                                className="pill bg-black/50 text-[0.45rem] text-gold"
                                title={TAG_LABELS[tg]}
                              >
                                {TAG_LABELS[tg]}
                              </span>
                            ))}
                          </span>
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
