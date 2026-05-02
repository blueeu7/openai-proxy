import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type DeletionReason =
  | "manual"
  | "quota_exceeded"
  | "monthly_limit"
  | "consecutive_errors"
  | "auth_failure";

export interface DeletionRecord {
  id: string;
  nodeId: string;
  name: string;
  url: string;
  reason: DeletionReason;
  deletedAt: number;
  errorMsg?: string;
}

const DATA_FILE = path.join(process.cwd(), "data", "deletion-log.json");
const MAX_RECORDS = 200;

function ensureDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

export function loadDeletionLog(): DeletionRecord[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as DeletionRecord[];
  } catch {
    return [];
  }
}

export function addDeletionRecord(record: Omit<DeletionRecord, "id" | "deletedAt">): DeletionRecord {
  const log = loadDeletionLog();
  const entry: DeletionRecord = { ...record, id: randomUUID(), deletedAt: Date.now() };
  log.unshift(entry);
  if (log.length > MAX_RECORDS) log.splice(MAX_RECORDS);
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(log, null, 2), "utf8");
  return entry;
}

export function clearDeletionLog(): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}
