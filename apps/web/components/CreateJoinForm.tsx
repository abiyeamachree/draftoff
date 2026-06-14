"use client";

import { useState } from "react";

/**
 * Create a new lobby or join an existing one by code.
 * Boilerplate UI only. TODO(web): on submit, connect the socket and emit
 */
export function CreateJoinForm() {
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl bg-black/20 p-6">
      <label className="block">
        <span className="text-sm text-white/70">Display name</span>
        <input
          className="mt-1 w-full rounded-lg bg-black/30 px-3 py-2 outline-none"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Gaffer"
        />
      </label>

      <button
        type="button"
        className="w-full rounded-lg bg-pitch px-4 py-2 font-semibold hover:bg-pitch/80 disabled:opacity-40"
        disabled={!displayName}
        // TODO(web): emit "lobby:create"
      >
        Create lobby
      </button>

      <div className="flex items-center gap-3 text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex gap-2">
        <input
          className="w-full rounded-lg bg-black/30 px-3 py-2 uppercase tracking-widest outline-none"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          maxLength={6}
        />
        <button
          type="button"
          className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-40"
          disabled={!displayName || code.length < 6}
          // TODO(web): emit "lobby:join"
        >
          Join
        </button>
      </div>
    </div>
  );
}
