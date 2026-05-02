import { createHash } from "crypto";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

export function makeCacheKey(model: string, messages: unknown): string {
  const raw = JSON.stringify({ model, messages });
  return createHash("sha256").update(raw).digest("hex");
}

export function cacheGet(key: string): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet(key: string, data: unknown): void {
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function cacheStats(): { size: number; ttlMinutes: number } {
  return { size: store.size, ttlMinutes: TTL_MS / 60_000 };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 10 * 60 * 1000);
