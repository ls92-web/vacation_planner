// ===== Global save-status signal (shown in the top bar). =====
// A tiny external store so any part of the app can report save progress without
// threading props through every provider.

export type SaveState = "idle" | "saving" | "saved" | "unsaved";

interface Snapshot {
  state: SaveState;
  lastSaved: number;
}

const SERVER_SNAPSHOT: Snapshot = { state: "idle", lastSaved: 0 };
let snapshot: Snapshot = { state: "idle", lastSaved: 0 };
const subscribers = new Set<() => void>();

export function getSaveSnapshot(): Snapshot {
  return snapshot;
}
export function getServerSaveSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}
export function subscribeSave(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
export function setSaveState(state: SaveState): void {
  snapshot = { state, lastSaved: state === "saved" ? Date.now() : snapshot.lastSaved };
  subscribers.forEach((f) => f());
}

/** Wrap an async persistence op so the top bar shows saving → saved/unsaved. */
export async function withSave<T>(op: Promise<T>): Promise<T> {
  setSaveState("saving");
  try {
    const result = await op;
    setSaveState("saved");
    return result;
  } catch (e) {
    setSaveState("unsaved");
    throw e;
  }
}
