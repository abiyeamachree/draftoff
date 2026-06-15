"use client";

/**
 * Display names allow letters, numbers and ! . £ $ only.
 * No spaces, no other punctuation.
 */
const DISALLOWED = /[^A-Za-z0-9!.£$]/g;

export const NAME_MAX_LENGTH = 24;

export function sanitiseName(input: string): string {
  return input.replace(DISALLOWED, "").slice(0, NAME_MAX_LENGTH);
}
