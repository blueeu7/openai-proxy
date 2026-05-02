import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface Upstream {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  createdAt: number;
}

const DATA_FILE = path.join(process.cwd(), "data", "upstreams.json");

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadUpstreams(): Upstream[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Upstream[];
  } catch {
    return [];
  }
}

export function saveUpstreams(list: Upstream[]): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

export function addUpstream(name: string, url: string, apiKey: string, enabled = true): Upstream {
  const list = loadUpstreams();
  const upstream: Upstream = {
    id: randomUUID(),
    name,
    url: url.replace(/\/$/, ""),
    apiKey,
    enabled,
    createdAt: Date.now(),
  };
  list.push(upstream);
  saveUpstreams(list);
  return upstream;
}

export function updateUpstream(
  id: string,
  patch: Partial<Pick<Upstream, "name" | "url" | "apiKey" | "enabled">>,
): Upstream | null {
  const list = loadUpstreams();
  const idx = list.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  if (patch.name !== undefined) list[idx].name = patch.name;
  if (patch.url !== undefined) list[idx].url = patch.url.replace(/\/$/, "");
  if (patch.apiKey !== undefined && patch.apiKey !== "") list[idx].apiKey = patch.apiKey;
  if (patch.enabled !== undefined) list[idx].enabled = patch.enabled;
  saveUpstreams(list);
  return list[idx];
}

export function removeUpstream(id: string): boolean {
  const list = loadUpstreams();
  const filtered = list.filter((u) => u.id !== id);
  if (filtered.length === list.length) return false;
  saveUpstreams(filtered);
  return true;
}
