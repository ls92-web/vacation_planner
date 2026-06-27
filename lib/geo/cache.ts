// ===== TTL cache for geo lookups: memory + localStorage + in-flight de-dup. =====
// Repeated country/city searches are served from memory (instant), then from
// localStorage (survives reloads), and only then hit the network. Concurrent
// identical lookups share one request.

interface Entry<T> {
  value: T;
  expires: number;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const LS_PREFIX = "itinera:geo:";

export const GEO_TTL = {
  countries: 7 * 24 * 60 * 60 * 1000, // a week — country data is stable
  cities: 24 * 60 * 60 * 1000, // a day
} as const;

function readLS<T>(key: string): Entry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch {
    return null;
  }
}

function writeLS<T>(key: string, entry: Entry<T>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / private mode — caching is best-effort */
  }
}

export async function cachedGeo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();

  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && mem.expires > now) return mem.value;

  const ls = readLS<T>(key);
  if (ls && ls.expires > now) {
    memory.set(key, ls);
    return ls.value;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await fn();
      const entry: Entry<T> = { value, expires: Date.now() + ttlMs };
      memory.set(key, entry);
      writeLS(key, entry);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
