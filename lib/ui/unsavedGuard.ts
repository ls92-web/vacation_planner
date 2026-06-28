// ===== Global unsaved-changes guard =====
// An editable page registers its dirty state via setUnsaved(). All in-app
// navigation runs through requestNavigation(), which proceeds immediately when
// clean or opens a shared confirm dialog when there are unsaved edits.

type Listener = () => void;

let dirty = false;
let dialogOpen = false;
let pending: (() => void) | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeGuard(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isUnsaved(): boolean {
  return dirty;
}
export function isGuardDialogOpen(): boolean {
  return dialogOpen;
}

export function setUnsaved(v: boolean): void {
  if (dirty !== v) {
    dirty = v;
    emit();
  }
}

/** Run `proceed` now if there are no unsaved changes; otherwise prompt first. */
export function requestNavigation(proceed: () => void): void {
  if (!dirty) {
    proceed();
    return;
  }
  pending = proceed;
  dialogOpen = true;
  emit();
}

/** User chose "Discard Changes" — drop edits and continue navigating. */
export function resolveDiscard(): void {
  dirty = false;
  dialogOpen = false;
  const p = pending;
  pending = null;
  emit();
  p?.();
}

/** User chose "Stay Editing" — cancel the navigation. */
export function resolveStay(): void {
  dialogOpen = false;
  pending = null;
  emit();
}
