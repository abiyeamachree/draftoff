"use client";

/**
 * Lightweight client identity. The server issues a `userId` on create/join;
 * we stash it per-lobby so navigation/refresh can re-attach via `*:sync`.
 * Display name is remembered globally for convenience.
 */

const NAME_KEY = "draftoff:name";

export function getName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}

export function getUserId(code: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(`draftoff:user:${code}`) ?? undefined;
}

export function setUserId(code: string, userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`draftoff:user:${code}`, userId);
}
