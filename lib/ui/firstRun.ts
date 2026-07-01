"use client";

// One-time, non-intrusive first-run hints. Per-device (localStorage) — these are
// gentle nudges, not settings, so they never need to sync across devices.

const KEY = (id: string) => `itinera:firstrun:${id}`;

export function seenFirstRun(id: string): boolean {
  try {
    return typeof window === "undefined" || localStorage.getItem(KEY(id)) === "1";
  } catch {
    return true; // if storage is unavailable, don't nag
  }
}

export function markFirstRun(id: string): void {
  try {
    localStorage.setItem(KEY(id), "1");
  } catch {
    /* ignore */
  }
}
