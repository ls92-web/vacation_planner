// ===== Tiny TTL cache + in-flight de-duplication for map/place/route requests. =====
// Keeps Places/Routes usage (and billing) down: repeated lookups hit memory, and
// concurrent identical lookups share a single request.

interface Entry<T> {
  value: T;
  expires: number;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  places: 15 * 60 * 1000,
  routes: 10 * 60 * 1000,
  geocode: 24 * 60 * 60 * 1000,
} as const;

/**
 * Returns a cached value if fresh; otherwise runs `fn` once (sharing the promise
 * with any concurrent callers) and caches the result for `ttlMs`.
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await fn();
      memory.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function clearMapCache(): void {
  memory.clear();
  inflight.clear();
}
