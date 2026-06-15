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
  deletePreset,
  loadPresets,
  type Preset,
  type PresetEmblem,
  savePreset,
} from "@/lib/draftPresets";
import { PoolPicker } from "@/components/PoolPicker";

const TEAM_SIZES: TeamSize[] = [11, 8, 5];
const FORMATS: TournamentType[] = [
  "knockout",
  "round_robin",
  "double_round_robin",
  "groups_knockout",
  "best_of",
];
const DRAFT_TYPES: DraftType[] = ["snake", "linear", "pack"];

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

  const [displayName, setDisplayName] = useState(() => sanitiseName(getName()));
  const [settings, setSettings] = useState<LobbySettings>(() => ({
    ...DEFAULT_LOBBY_SETTINGS,
    pool: emptyPoolRules(),
  }));
  const [poolOpen, setPoolOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetQuery, setPresetQuery] = useState("");
  const [presetName, setPresetName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPresets(loadPresets()), []);

  const nameReady = displayName.trim().length > 0;

  function update(patch: Partial<LobbySettings>) {
    setSettings((s) => ({ ...s, ...patch }));
  }

  function setPool(updater: (prev: PoolRules) => PoolRules) {
    setSettings((s) => ({ ...s, pool: updater(s.pool) }));
  }

  function applyPreset(p: Preset) {
    setSettings((s) => ({
      ...s,
      ...p.config,
      pool: p.config.pool
        ? {
            logic: p.config.pool.logic ?? "OR",
            include: { ...emptyPoolFilter(), ...p.config.pool.include },
            exclude: { ...emptyPoolFilter(), ...p.config.pool.exclude },
          }
        : emptyPoolRules(),
    }));
  }

  const poolCount = countPoolRules(settings.pool);

  function saveCurrent() {
    const name = presetName.trim();
    if (!name) return;
    const { visibility: _visibility, ...config } = settings;
    setPresets(savePreset({ name, config }));
    setPresetName("");
  }

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

  const filteredPresets = presets.filter((p) =>
    p.name.toLowerCase().includes(presetQuery.trim().toLowerCase())
  );

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
          {fieldLabel("Display name")}
          <input
            className="field mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(sanitiseName(e.target.value))}
            placeholder="e.g. Gaffer"
          />
        </label>

        <label className="block">
          {fieldLabel("Number of players")}{" "}
          <span className="font-mono text-gold">{settings.numPlayers}</span>
          <input
            type="range"
            min={2}
            max={20}
            step={1}
            value={settings.numPlayers}
            onChange={(e) => update({ numPlayers: Number(e.target.value) })}
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

        <label className="block">
          {fieldLabel("Format")}
          <select
            value={settings.tournamentType}
            onChange={(e) =>
              update({ tournamentType: e.target.value as TournamentType })
            }
            className="field mt-1"
          >
            {FORMATS.map((f) => (
              <option key={f} value={f} className="bg-pitch-dark">
                {TOURNAMENT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>

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
              {fieldLabel("Draft type")}
              <div className="mt-1 flex gap-2">
                {DRAFT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ draftType: t })}
                    className={`btn flex-1 px-2 text-[0.55rem] ${
                      settings.draftType === t ? "" : "btn-grey"
                    }`}
                  >
                    {DRAFT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
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

      <div className="panel space-y-3">
        <span className="title text-sm">Saved presets</span>
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Name this preset"
            className="field"
          />
          <button
            type="button"
            onClick={saveCurrent}
            disabled={!presetName.trim()}
            className="btn btn-grey shrink-0"
          >
            Save
          </button>
        </div>

        {presets.length > 0 && (
          <>
            <input
              value={presetQuery}
              onChange={(e) => setPresetQuery(e.target.value)}
              placeholder="Search presets"
              className="field"
            />
            <ul className="space-y-1">
              {filteredPresets.map((p) => (
                <li key={p.name} className="inset flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="truncate text-left font-bold hover:text-gold"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresets(deletePreset(p.name))}
                    className="pill bg-black/40 text-white/60 hover:text-red-300"
                  >
                    Delete
                  </button>
                </li>
              ))}
              {filteredPresets.length === 0 && (
                <li className="text-xs text-white/40">No presets match.</li>
              )}
            </ul>
          </>
        )}
      </div>

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
