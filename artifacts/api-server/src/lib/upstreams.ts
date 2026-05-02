import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type NodeStatus = "online" | "offline" | "quota_exceeded" | "monthly_limit" | "banned";

export interface Upstream {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  status: NodeStatus;
  createdAt: number;
  lastSeenAt: number | null;
  lastErrorAt: number | null;
  lastErrorMsg: string | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalErrors: number;
}

const DATA_FILE = path.join(process.cwd(), "data", "upstreams.json");

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function migrate(raw: Partial<Upstream>): Upstream {
  return {
    id: raw.id ?? randomUUID(),
    name: raw.name ?? "unnamed",
    url: (raw.url ?? "").replace(/\/$/, ""),
    apiKey: raw.apiKey ?? "",
    enabled: raw.enabled ?? true,
    status: raw.status ?? "online",
    createdAt: raw.createdAt ?? Date.now(),
    lastSeenAt: raw.lastSeenAt ?? null,
    lastErrorAt: raw.lastErrorAt ?? null,
    lastErrorMsg: raw.lastErrorMsg ?? null,
    consecutiveFailures: raw.consecutiveFailures ?? 0,
    totalRequests: raw.totalRequests ?? 0,
    totalErrors: raw.totalErrors ?? 0,
  };
}

export function loadUpstreams(): Upstream[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Partial<Upstream>[];
    return raw.map(migrate);
  } catch {
    return [];
  }
}

export function saveUpstreams(list: Upstream[]): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

function patchOne(id: string, fn: (u: Upstream) => void): Upstream | null {
  const list = loadUpstreams();
  const idx = list.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  fn(list[idx]);
  saveUpstreams(list);
  return list[idx];
}

export function addUpstream(name: string, url: string, apiKey: string, enabled = true): Upstream {
  const list = loadUpstreams();
  const upstream = migrate({ id: randomUUID(), name, url, apiKey, enabled, createdAt: Date.now() });
  list.push(upstream);
  saveUpstreams(list);
  return upstream;
}

export function updateUpstream(
  id: string,
  patch: Partial<Pick<Upstream, "name" | "url" | "apiKey" | "enabled">>,
): Upstream | null {
  return patchOne(id, (u) => {
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.url !== undefined) u.url = patch.url.replace(/\/$/, "");
    if (patch.apiKey !== undefined && patch.apiKey !== "") u.apiKey = patch.apiKey;
    if (patch.enabled !== undefined) u.enabled = patch.enabled;
  });
}

export function removeUpstream(id: string): boolean {
  const list = loadUpstreams();
  const filtered = list.filter((u) => u.id !== id);
  if (filtered.length === list.length) return false;
  saveUpstreams(filtered);
  return true;
}

export function wakeUpstream(id: string): Upstream | null {
  return patchOne(id, (u) => {
    u.status = "online";
    u.consecutiveFailures = 0;
    u.lastErrorMsg = null;
    u.enabled = true;
  });
}

export function markUpstreamOnline(id: string): void {
  patchOne(id, (u) => {
    u.status = "online";
    u.lastSeenAt = Date.now();
    u.consecutiveFailures = 0;
    u.totalRequests++;
  });
}

export function markUpstreamError(id: string, status: NodeStatus, msg: string): void {
  patchOne(id, (u) => {
    u.status = status;
    u.lastErrorAt = Date.now();
    u.lastErrorMsg = msg;
    u.totalErrors++;
  });
}

export function markUpstreamFailure(id: string, msg: string): void {
  patchOne(id, (u) => {
    u.consecutiveFailures++;
    u.lastErrorAt = Date.now();
    u.lastErrorMsg = msg;
    u.totalErrors++;
    if (u.consecutiveFailures >= 3) u.status = "offline";
  });
}

export function wakeAllUpstreams(): number {
  const list = loadUpstreams();
  let count = 0;
  for (const u of list) {
    if (u.enabled && u.status !== "online" && u.status !== "banned") {
      u.status = "online";
      u.consecutiveFailures = 0;
      u.lastErrorMsg = null;
      count++;
    }
  }
  saveUpstreams(list);
  return count;
}

export function clusterSummary() {
  const all = loadUpstreams();
  return {
    total: all.length,
    online: all.filter((u) => u.enabled && u.status === "online").length,
    offline: all.filter((u) => u.enabled && u.status === "offline").length,
    quota: all.filter((u) => u.status === "quota_exceeded").length,
    monthly: all.filter((u) => u.status === "monthly_limit").length,
    banned: all.filter((u) => !u.enabled || u.status === "banned").length,
  };
}
