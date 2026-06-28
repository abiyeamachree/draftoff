"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  countPoolRules,
  DEFAULT_LOBBY_SETTINGS,
  describePool,
  DRAFT_TYPE_LABELS,
  type DraftType,
  emptyPoolFilter,
  emptyPoolRules,
  type LobbySettings,
  maxTeamsForFormat,
  MIN_TEAMS,
  MAX_REROLLS_PER_PICK,
  MIN_REROLLS_PER_PICK,
  PICK_CYCLE_LABELS,
  type PickCycleMode,
  type PoolRules,
  type TeamSize,
  TOURNAMENT_LABELS,
  type TournamentType,
} from "@draftoff/shared";
import { useSocket } from "@/hooks/useSocket";
import { getName, setName, setUserId } from "@/lib/identity";
import { sanitiseName } from "@/lib/name";
import {
  BUILT_IN_PRESETS,
  type Preset,
  type PresetEmblem,
} from "@/lib/draftPresets";
import { PoolPicker } from "@/components/PoolPicker";
import { TeamPicker } from "@/components/TeamPicker";

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

type BoolKey =
  | "peakCardsEnabled"
  | "hideRatings"
  | "chatEnabled"
  | "draftBoardEnabled"
  | "fillWithBots";

const ADVANCED_TOGGLES: { key: BoolKey; label: string; hint: string }[] = [
  { key: "peakCardsEnabled", label: "Peak cards", hint: "Use each player's best-ever edition" },
  { key: "hideRatings", label: "Hide ratings", hint: "Show only names, no overall" },
  { key: "chatEnabled", label: "Chat", hint: "Preset messages and emoji reacts" },
  { key: "draftBoardEnabled", label: "Live draft board", hint: "Show the board during the draft" },
  { key: "fillWithBots", label: "Fill with bots", hint: "Add bots for any empty slots" },
];

type CapKey = "maxPerClub" | "maxPerNation" | "maxPerLeague";

const CAPS: { key: CapKey; label: string }[] = [
  { key: "maxPerClub", label: "Max from same club" },
  { key: "maxPerNation", label: "Max from same nation" },
  { key: "maxPerLeague", label: "Max from same league" },
];

const PRESET_BG: Record<PresetEmblem, string> = {
  prem38: "linear-gradient(180deg,#e6c200,#a07c00)",
  england: "linear-gradient(180deg,#e23b3b,#a81717)",
  star: "linear-gradient(180deg,#3f5bd0,#1c2a86)",
  globe: "linear-gradient(180deg,#2bb6a4,#10796d)",
  world: "linear-gradient(180deg,#8a4bd0,#4a1c86)",
};

function PresetBadge({ emblem }: { emblem?: PresetEmblem }) {
  if (emblem === "england") {
    return (
      <span
        className="absolute right-1.5 top-1.5 h-5 w-5 border-2 border-black"
        style={{
          background:
            "linear-gradient(#d40000,#d40000) center/100% 34% no-repeat," +
            "linear-gradient(#d40000,#d40000) center/34% 100% no-repeat,#fff",
        }}
      />
    );
  }
  if (emblem === "star") {
    return (
      <span className="absolute right-1 top-0.5 text-2xl leading-none text-gold drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]">
        ★
      </span>
    );
  }
  if (emblem === "prem38") {
    return (
      <span className="absolute right-1 top-0.5 text-xl font-extrabold leading-none text-black drop-shadow-[1px_1px_0_rgba(255,255,255,0.4)]">
        38
      </span>
    );
  }
  if (emblem === "world") {
    return <span className="absolute right-1 top-1 text-xl leading-none">🌍</span>;
  }
  return <span className="absolute right-1 top-1 text-xl leading-none">🌐</span>;
}

function fieldLabel(text: string) {
  return (
    <span className="text-sm font-bold uppercase tracking-wide text-white/60">
      {text}
    </span>
  );
}

export function CreateDraftForm() {
  const router = useRouter();
  const { socket } = useSocket();

  const [displayName, setDisplayName] = useState("");
  const [settings, setSettings] = useState<LobbySettings>(() => ({
    ...DEFAULT_LOBBY_SETTINGS,
    pool: emptyPoolRules(),
  }));
  const [poolOpen, setPoolOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDisplayName(sanitiseName(getName())), []);

  const nameReady = displayName.trim().length > 0;

  function update(patch: Partial<LobbySettings>) {
    setSettings((s) => ({ ...s, ...patch }));
  }

  function setFormat(format: TournamentType) {
    setSettings((s) => ({
      ...s,
      tournamentType: format,
      numTeams: Math.min(s.numTeams, maxTeamsForFormat(format)),
    }));
  }

  function setDraftType(type: DraftType) {
    update({ draftType: type });
    if (type === "pack") setPackOpen(true);
  }

  function setPool(updater: (prev: PoolRules) => PoolRules) {
    setSettings((s) => ({ ...s, pool: updater(s.pool) }));
  }

  function applyPreset(p: Preset) {
    setSettings((s) => ({
      ...s,
      ...p.config,
      teams: p.config.teams ?? [],
      pool: p.config.pool
        ? {
            logic: p.config.pool.logic ?? "OR",
            include: { ...emptyPoolFilter(), ...p.config.pool.include },
            exclude: { ...emptyPoolFilter(), ...p.config.pool.exclude },
          }
        : emptyPoolRules(),
    }));
  }

  const teamCap = maxTeamsForFormat(settings.tournamentType);
  const poolCount = countPoolRules(settings.pool);
  const setTeams = (updater: (prev: string[]) => string[]) =>
    setSettings((s) => ({ ...s, teams: updater(s.teams) }));
  const fillerSpots = Math.max(0, settings.numTeams - 1);

  function create() {
    if (!nameReady || busy) return;
    setError(null);
    setBusy(true);
    setName(displayName.trim());

    socket.emit(
      "lobby:create",
      { displayName: displayName.trim(), settings },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setUserId(res.data.code, res.data.userId);
        router.push(`/lobby/${res.data.code}`);
      }
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm font-bold uppercase tracking-wide text-white/50 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="title mt-3 text-2xl text-gold">Create a draft</h1>
        <p className="mt-2 text-lg text-white/70">Set the rules, then share the link.</p>
      </header>

      <div className="space-y-1">
        {fieldLabel("Templates")}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {BUILT_IN_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              style={{
                background: PRESET_BG[p.emblem ?? "star"],
                flex: "0 0 calc((100% - 1rem) / 3)",
              }}
              className="btn relative flex min-h-[9rem] shrink-0 flex-col gap-2 overflow-hidden px-2 py-3 text-left text-[0.55rem] leading-tight"
            >
              <PresetBadge emblem={p.emblem} />
              <span className="relative pr-6">{p.name}</span>
              {p.description && (
                <span
                  className="relative normal-case leading-snug text-white/85"
                  style={{ fontFamily: "VT323, monospace", fontSize: "0.95rem" }}
                >
                  {p.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="panel space-y-5">
        <label className="block">
          {fieldLabel("Draft name")}
          <input
            className="field mt-1"
            value={settings.name}
            onChange={(e) => update({ name: e.target.value.slice(0, 40) })}
            placeholder="e.g. Sunday League Cup"
          />
        </label>

        <label className="block">
          {fieldLabel("Display name")}
          <input
            className="field mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(sanitiseName(e.target.value))}
            placeholder="e.g. Gaffer"
          />
        </label>

        <label className="block">
          {fieldLabel("Format")}
          <select
            value={settings.tournamentType}
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
          <span className="font-mono text-gold">{settings.numTeams}</span>
          <span className="ml-2 text-xs text-white/40">max {teamCap}</span>
          <input
            type="range"
            min={MIN_TEAMS}
            max={teamCap}
            step={1}
            value={settings.numTeams}
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
                className={`btn flex-1 ${settings.teamSize === size ? "" : "btn-grey"}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div>
          {fieldLabel("Visibility")}
          <div className="mt-1 flex gap-2">
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ visibility: v })}
                className={`btn flex-1 ${settings.visibility === v ? "" : "btn-grey"}`}
              >
                {v === "public" ? "Public" : "Private"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {fieldLabel("Draft pool")}
          <button
            type="button"
            onClick={() => setPoolOpen(true)}
            className="btn btn-grey w-full py-3 text-[0.6rem]"
          >
            {poolCount > 0 ? `Edit pool (${poolCount} rules)` : "Build your player pool…"}
          </button>
          <p
            className="text-white/60"
            style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
          >
            {describePool(settings.pool)}
          </p>
        </div>

        <div className="space-y-2">
          {fieldLabel("Fill teams")}
          <button
            type="button"
            onClick={() => setTeamsOpen(true)}
            className="btn btn-grey w-full py-3 text-[0.6rem]"
          >
            {settings.teams.length > 0
              ? `Edit fill teams (${settings.teams.length})`
              : "Pick clubs or nations to fill the league…"}
          </button>
          <p
            className="text-white/60"
            style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
          >
            {settings.teams.length === 0
              ? `Up to ${fillerSpots} non-human spots will be filled with bots.`
              : `${Math.min(settings.teams.length, fillerSpots)} of ${fillerSpots} non-human spots filled by your chosen clubs or national teams.`}
          </p>
        </div>
      </div>

      <div className="panel space-y-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="title text-sm">Advanced settings</span>
          <span className="text-gold">{advancedOpen ? "▾" : "▸"}</span>
        </button>

        {advancedOpen && (
          <div className="space-y-4">
            <div>
              {fieldLabel("Pick cycle")}
              <p className="mt-1 text-xs text-white/50">
                What the dice rolls each turn before you choose a player.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {PICK_CYCLES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update({ pickCycleMode: mode })}
                    className={`btn px-2 text-[0.5rem] ${
                      settings.pickCycleMode === mode ? "" : "btn-grey"
                    }`}
                  >
                    {PICK_CYCLE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {fieldLabel("Draft type")}
              <div className="mt-1 flex gap-2">
                {DRAFT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraftType(t)}
                    className={`btn flex-1 px-2 text-[0.55rem] ${
                      settings.draftType === t ? "" : "btn-grey"
                    }`}
                  >
                    {DRAFT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              {settings.draftType === "pack" && (
                <button
                  type="button"
                  onClick={() => setPackOpen(true)}
                  className="mt-2 w-full text-left text-white/60 hover:text-gold"
                  style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
                >
                  {settings.packSize} random players per pack — edit
                </button>
              )}
            </div>

            <label className="block">
              {fieldLabel("Pick timer")}{" "}
              <span className="font-mono text-gold">{settings.draftTimerSeconds}s</span>
              <input
                type="range"
                min={5}
                max={30}
                step={5}
                value={settings.draftTimerSeconds}
                onChange={(e) =>
                  update({ draftTimerSeconds: Number(e.target.value) })
                }
                className="mt-2 w-full accent-gold"
              />
            </label>

            <label className="block">
              {fieldLabel("Re-rolls per pick")}{" "}
              <span className="font-mono text-gold">{settings.rerollsPerPick}</span>
              <input
                type="range"
                min={MIN_REROLLS_PER_PICK}
                max={MAX_REROLLS_PER_PICK}
                step={1}
                value={settings.rerollsPerPick}
                onChange={(e) =>
                  update({ rerollsPerPick: Number(e.target.value) })
                }
                className="mt-2 w-full accent-gold"
              />
              <p className="mt-1 text-xs text-white/50">
                {settings.rerollsPerPick === 0
                  ? "Re-rolls disabled — no second chance on a bad roll."
                  : `${settings.rerollsPerPick} re-roll${settings.rerollsPerPick === 1 ? "" : "s"} allowed each pick.`}
              </p>
            </label>

            {CAPS.map((cap) => (
              <label key={cap.key} className="inset flex items-center justify-between px-3 py-2">
                <span>
                  <span className="block font-extrabold">{cap.label}</span>
                  <span className="text-xs text-white/50">0 means no limit</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={settings[cap.key]}
                  onChange={(e) =>
                    update({
                      [cap.key]: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                    } as Partial<LobbySettings>)
                  }
                  className="field w-20 text-center"
                />
              </label>
            ))}

            {ADVANCED_TOGGLES.map((t) => (
              <label key={t.key} className="inset flex items-center justify-between px-3 py-3">
                <span>
                  <span className="block font-extrabold">{t.label}</span>
                  <span className="text-xs text-white/50">{t.hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings[t.key]}
                  onChange={(e) =>
                    update({ [t.key]: e.target.checked } as Partial<LobbySettings>)
                  }
                  className="h-6 w-6 accent-gold"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {poolOpen && (
        <PoolPicker
          pool={settings.pool}
          setPool={setPool}
          onClose={() => setPoolOpen(false)}
        />
      )}

      {teamsOpen && (
        <TeamPicker
          teams={settings.teams}
          setTeams={setTeams}
          spots={fillerSpots}
          onClose={() => setTeamsOpen(false)}
        />
      )}

      {packOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPackOpen(false)}
        >
          <div
            className="panel w-full max-w-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="title text-sm">Pack size</h2>
            <p
              className="normal-case leading-snug text-white/70"
              style={{ fontFamily: "VT323, monospace", fontSize: "1.05rem" }}
            >
              How many random players in each pack?
            </p>
            <div className="text-center font-mono text-2xl text-gold">{settings.packSize}</div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={settings.packSize}
              onChange={(e) => update({ packSize: Number(e.target.value) })}
              className="w-full accent-gold"
            />
            <button
              type="button"
              onClick={() => setPackOpen(false)}
              className="btn w-full py-3 text-[0.6rem]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={create}
        disabled={!nameReady || busy}
        className="btn w-full py-4 text-sm"
      >
        {busy ? "Creating…" : "Create lobby"}
      </button>

      {error && <p className="text-sm font-bold text-red-300">{error}</p>}
    </div>
  );
}
