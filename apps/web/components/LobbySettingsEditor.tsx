"use client";

import { useState, useEffect } from "react";
import {
  DRAFT_TYPE_LABELS,
  type DraftType,
  type LobbySettings,
  maxTeamsForFormat,
  MIN_TEAMS,
  MAX_REROLLS_PER_PICK,
  MIN_REROLLS_PER_PICK,
  PICK_CYCLE_LABELS,
  type PickCycleMode,
  type TeamSize,
  TOURNAMENT_LABELS,
  type TournamentType,
} from "@draftoff/shared";
import { useSocket } from "@/hooks/useSocket";
import { getUserId } from "@/lib/identity";

const TEAM_SIZES: TeamSize[] = [11, 8, 5];
const FORMATS: TournamentType[] = [
  "knockout",
  "round_robin",
  "double_round_robin",
  "groups_knockout",
  "best_of",
];
const DRAFT_TYPES: DraftType[] = ["snake", "linear", "pack"];
const PICK_CYCLES: PickCycleMode[] = ["team", "league", "nation", "position"];

function fieldLabel(text: string) {
  return (
    <span className="text-sm font-bold uppercase tracking-wide text-white/60">{text}</span>
  );
}

export function LobbySettingsEditor({
  code,
  settings,
}: {
  code: string;
  settings: LobbySettings;
}) {
  const { socket } = useSocket();
  const [draft, setDraft] = useState<LobbySettings>(settings);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const teamCap = maxTeamsForFormat(draft.tournamentType);

  function update(patch: Partial<LobbySettings>) {
    setDraft((s) => ({ ...s, ...patch }));
    setSaved(false);
  }

  function setFormat(format: TournamentType) {
    setDraft((s) => ({
      ...s,
      tournamentType: format,
      numTeams: Math.min(s.numTeams, maxTeamsForFormat(format)),
    }));
    setSaved(false);
  }

  function save() {
    setBusy(true);
    setError(null);
    socket.emit(
      "lobby:updateSettings",
      { code, userId: getUserId(code), settings: draft },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    );
  }

  return (
    <div className="panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <h2 className="title text-sm">Lobby settings</h2>
        <span className="flex items-center gap-2 text-xs font-bold text-white/50">
          {saved && <span className="text-emerald-400">Saved</span>}
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
      <label className="block">
        {fieldLabel("Draft name")}
        <input
          className="field mt-1"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value.slice(0, 40) })}
        />
      </label>

      <label className="block">
        {fieldLabel("Format")}
        <select
          value={draft.tournamentType}
          onChange={(e) => setFormat(e.target.value as TournamentType)}
          className="field mt-1"
        >
          {FORMATS.map((f) => (
            <option key={f} value={f} className="bg-pitch-dark">
              {TOURNAMENT_LABELS[f]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        {fieldLabel("Number of teams")}{" "}
        <span className="font-mono text-gold">{draft.numTeams}</span>
        <input
          type="range"
          min={MIN_TEAMS}
          max={teamCap}
          step={1}
          value={draft.numTeams}
          onChange={(e) => update({ numTeams: Number(e.target.value) })}
          className="mt-2 w-full accent-gold"
        />
      </label>

      <div>
        {fieldLabel("Squad size")}
        <div className="mt-1 flex gap-2">
          {TEAM_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => update({ teamSize: size })}
              className={`btn flex-1 ${draft.teamSize === size ? "" : "btn-grey"}`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        {fieldLabel("Pick timer")}{" "}
        <span className="font-mono text-gold">{draft.draftTimerSeconds}s</span>
        <input
          type="range"
          min={5}
          max={30}
          value={draft.draftTimerSeconds}
          onChange={(e) => update({ draftTimerSeconds: Number(e.target.value) })}
          className="mt-2 w-full accent-gold"
        />
      </label>

      <label className="block">
        {fieldLabel("Re-rolls per pick")}{" "}
        <span className="font-mono text-gold">{draft.rerollsPerPick}</span>
        <input
          type="range"
          min={MIN_REROLLS_PER_PICK}
          max={MAX_REROLLS_PER_PICK}
          value={draft.rerollsPerPick}
          onChange={(e) => update({ rerollsPerPick: Number(e.target.value) })}
          className="mt-2 w-full accent-gold"
        />
      </label>

      <div>
        {fieldLabel("Draft type")}
        <div className="mt-1 flex flex-wrap gap-2">
          {DRAFT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ draftType: t })}
              className={`btn px-3 ${draft.draftType === t ? "" : "btn-grey"}`}
            >
              {DRAFT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        {fieldLabel("Pick cycle")}
        <div className="mt-1 flex flex-wrap gap-2">
          {PICK_CYCLES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ pickCycleMode: m })}
              className={`btn px-3 ${draft.pickCycleMode === m ? "" : "btn-grey"}`}
            >
              {PICK_CYCLE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["hideRatings", "Hide ratings"],
            ["chatEnabled", "Chat"],
            ["fillWithBots", "Fill with bots"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ [key]: !draft[key] })}
            className={`btn px-3 text-[0.55rem] ${draft[key] ? "" : "btn-grey"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" onClick={save} disabled={busy} className="btn w-full py-3">
        {busy ? "Saving…" : "Save settings"}
      </button>
      {error && <p className="text-center text-sm font-bold text-red-300">{error}</p>}
      <p className="text-center text-xs text-white/40">
        Changes are announced in chat for other players.
      </p>
        </div>
      )}
    </div>
  );
}
