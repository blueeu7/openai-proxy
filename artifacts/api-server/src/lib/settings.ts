import fs from "fs";
import path from "path";

export interface Settings {
  maxConsecutiveFailures: number;
  healthIntervalMs: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  rateLimitEnabled: boolean;
  rateLimitPerMinute: number;
  retryOnError: boolean;
  requestTimeoutMs: number;
}

export const DEFAULTS: Settings = {
  maxConsecutiveFailures: 3,
  healthIntervalMs: 60_000,
  cacheEnabled: true,
  cacheTtlMs: 3_600_000,
  rateLimitEnabled: true,
  rateLimitPerMinute: 20,
  retryOnError: true,
  requestTimeoutMs: 120_000,
};

const DATA_FILE = path.join(process.cwd(), "data", "settings.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

export function loadSettings(): Settings {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Partial<Settings>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const current = loadSettings();
  const updated = { ...current, ...patch };
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}
