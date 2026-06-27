// Lightweight signal so the sidebar / top bar can open the account panel.
const subs = new Set<() => void>();
export function openAccount(): void {
  subs.forEach((f) => f());
}
export function subscribeAccount(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}
