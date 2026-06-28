"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogNation, CatalogTeam, TeamTag } from "@/lib/catalog";
import {
  fetchLeagues,
  fetchNations,
  fetchSeasons,
  fetchTeams,
  TAG_LABELS,
} from "@/lib/catalog";
import {
  WC_2026_BY_CONFED,
  WC_2026_NATIONS,
  WC_2026_SEASON,
} from "@/lib/competitionTeams";
import { nationFillLabel } from "@draftoff/shared";

type FillTab = "clubs" | "nations";

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
  const [tab, setTab] = useState<FillTab>("clubs");
  const [catalogNations, setCatalogNations] = useState<CatalogNation[]>([]);
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
    if (!season || tab !== "clubs") return;
    setLoading(true);
    fetchLeagues(season)
      .then(setLeagues)
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, [season, tab]);

  useEffect(() => {
    if (!season || tab !== "clubs") return;
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
  }, [season, league, tag, tab]);

  useEffect(() => {
    if (!season || tab !== "nations") return;
    setLoading(true);
    fetchNations(season)
      .then(setCatalogNations)
      .catch(() => {
        setCatalogNations([]);
        setError("Could not load nations");
      })
      .finally(() => setLoading(false));
  }, [season, tab]);

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

  function toggleMany(labels: string[], allOn: boolean) {
    setTeams((prev) =>
      allOn
        ? prev.filter((c) => !labels.includes(c))
        : Array.from(new Set([...prev, ...labels]))
    );
  }

  const wcLabels = useMemo(
    () => WC_2026_NATIONS.map((n) => nationFillLabel(n, WC_2026_SEASON)),
    []
  );

  const filteredCatalogNations = useMemo(() => {
    if (!q) return catalogNations;
    return catalogNations.filter((n) => n.nation.toLowerCase().includes(q));
  }, [catalogNations, q]);

  const wcAllOn = wcLabels.every((l) => teams.includes(l));

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
          <h2 className="title text-sm">Fill teams</h2>
          <button
            type="button"
            onClick={onClose}
            className="pill bg-black/40 text-white/70 hover:text-gold"
          >
            Done
          </button>
        </div>

        <div className="flex gap-1">
          {(["clubs", "nations"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pill flex-1 ${tab === t ? "bg-gold text-black" : "bg-black/40 text-white/70 hover:text-gold"}`}
            >
              {t === "clubs" ? "Clubs" : "National teams"}
            </button>
          ))}
        </div>

        <p
          className="inset px-3 py-2 normal-case leading-snug text-gold"
          style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
        >
          {teams.length === 0
            ? `Pick clubs or national teams to fill up to ${spots} league spots.`
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

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "clubs" ? `Search ${season} clubs…` : `Search nations…`}
          className="field"
        />

        <div className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2">
          {loading && <p className="text-white/50">Loading…</p>}

          {tab === "clubs" && (
            <>
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

              {Array.from(byLeague.entries()).map(([lg, entries]) => {
                const allOn = entries.every((e) => teams.includes(e.label));
                return (
                  <div key={lg} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="title text-[0.6rem] text-gold">{lg}</span>
                      <button
                        type="button"
                        onClick={() => toggleMany(entries.map((e) => e.label), allOn)}
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
            </>
          )}

          {tab === "nations" && (
            <>
              {season === WC_2026_SEASON && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="title text-[0.65rem] text-gold">
                      World Cup 2026 ({WC_2026_NATIONS.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleMany(wcLabels, wcAllOn)}
                      className="pill bg-black/40 text-white/70 hover:text-gold"
                    >
                      {wcAllOn ? "Clear all" : "Add all 48"}
                    </button>
                  </div>
                  {Object.entries(WC_2026_BY_CONFED).map(([confed, nations]) => {
                    const labels = nations.map((n) => nationFillLabel(n, WC_2026_SEASON));
                    const allOn = labels.every((l) => teams.includes(l));
                    return (
                      <div key={confed} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-white/50">
                            {confed} ({nations.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleMany(labels, allOn)}
                            className="pill bg-black/40 text-[0.45rem] text-white/70 hover:text-gold"
                          >
                            {allOn ? "Clear" : "Add all"}
                          </button>
                        </div>
                        <ul>
                          {nations.map((nation) => {
                            const label = nationFillLabel(nation, WC_2026_SEASON);
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
                                  <span className="flex-1">{nation}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1 border-t border-white/10 pt-3">
                <span className="title text-[0.6rem] text-gold">
                  All nations · {season}
                </span>
                <ul>
                  {filteredCatalogNations.map(({ nation }) => {
                    const label = nationFillLabel(nation, season);
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
                          <span className="flex-1">{nation}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
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
