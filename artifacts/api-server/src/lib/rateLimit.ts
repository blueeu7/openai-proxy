interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  if (!windows.has(ip)) windows.set(ip, { timestamps: [] });
  const entry = windows.get(ip)!;

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  const remaining = MAX_REQUESTS - entry.timestamps.length;
  if (remaining <= 0) {
    const resetMs = entry.timestamps[0] + WINDOW_MS - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: remaining - 1, resetMs: 0 };
}

setInterval(() => {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  for (const [ip, entry] of windows.entries()) {
    if (entry.timestamps.every((t) => t <= cutoff)) windows.delete(ip);
  }
}, 5 * 60 * 1000);
