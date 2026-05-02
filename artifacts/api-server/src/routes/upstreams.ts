import { Router, type Request, type Response } from "express";
import {
  loadUpstreams,
  addUpstream,
  updateUpstream,
  removeUpstream,
  wakeUpstream,
  wakeAllUpstreams,
  markUpstreamOnline,
  markUpstreamError,
  markUpstreamFailure,
  clusterSummary,
  type Upstream,
} from "../lib/upstreams";
import { addDeletionRecord } from "../lib/deletionLog";

const router = Router();

function maskKey(u: Upstream) {
  return { ...u, apiKey: u.apiKey.length > 4 ? u.apiKey.slice(0, 4) + "****" : "****" };
}

router.get("/", (_req: Request, res: Response) => {
  res.json(loadUpstreams().map(maskKey));
});

router.get("/cluster-summary", (_req: Request, res: Response) => {
  res.json(clusterSummary());
});

router.post("/", (req: Request, res: Response) => {
  const { name, url, apiKey, enabled, weight } = req.body as {
    name?: string;
    url?: string;
    apiKey?: string;
    enabled?: boolean;
    weight?: number;
  };
  if (!name || !url || !apiKey) {
    res.status(400).json({ error: "name, url, apiKey are required" });
    return;
  }
  const upstream = addUpstream(name, url, apiKey, enabled ?? true, weight ?? 1);
  res.status(201).json(maskKey(upstream));
});

router.post("/wake-all", (_req: Request, res: Response) => {
  const woken = wakeAllUpstreams();
  res.json({ ok: true, woken });
});

router.post("/bulk", (req: Request, res: Response) => {
  const { lines } = req.body as { lines?: string[] };
  if (!Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: "lines 数组不能为空" });
    return;
  }
  const existing = loadUpstreams();
  const existingUrls = new Set(existing.map((u) => u.url.toLowerCase()));
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split("----");
    if (parts.length < 2) {
      errors.push(`第 ${idx + 1} 行格式错误（需要 URL----API_KEY）`);
      return;
    }
    const url = parts[0].trim().replace(/\/$/, "");
    const apiKey = parts[1].trim();
    const name = parts[2]?.trim() || `bulk-node-${String(imported + skipped + 1).padStart(3, "0")}`;
    if (!url.startsWith("http")) {
      errors.push(`第 ${idx + 1} 行 URL 无效: ${url.slice(0, 50)}`);
      return;
    }
    if (!apiKey) {
      errors.push(`第 ${idx + 1} 行缺少 API Key`);
      return;
    }
    if (existingUrls.has(url.toLowerCase())) {
      skipped++;
      return;
    }
    addUpstream(name, url, apiKey, true, 1);
    existingUrls.add(url.toLowerCase());
    imported++;
  });
  res.json({ ok: true, imported, skipped, errors });
});

router.patch("/:id", (req: Request, res: Response) => {
  const updated = updateUpstream(req.params.id, req.body as Partial<Upstream>);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(maskKey(updated));
});

router.delete("/:id", (req: Request, res: Response) => {
  const all = loadUpstreams();
  const upstream = all.find((u) => u.id === req.params.id);
  const ok = removeUpstream(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (upstream) {
    addDeletionRecord({
      nodeId: upstream.id,
      name: upstream.name,
      url: upstream.url,
      reason: "manual",
    });
  }
  res.json({ ok: true });
});

router.post("/:id/wake", (req: Request, res: Response) => {
  const woken = wakeUpstream(req.params.id);
  if (!woken) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(maskKey(woken));
});

router.post("/:id/test", async (req: Request, res: Response) => {
  const all = loadUpstreams();
  const upstream = all.find((u) => u.id === req.params.id);
  if (!upstream) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const start = Date.now();
  try {
    const r = await fetch(`${upstream.url}/v1/models`, {
      headers: { Authorization: `Bearer ${upstream.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - start;
    if (r.ok) {
      markUpstreamOnline(upstream.id);
      res.json({ ok: true, ms });
    } else if (r.status === 429) {
      markUpstreamError(upstream.id, "quota_exceeded", "429 配额超限");
      res.json({ ok: false, ms, status: r.status, error: "配额超限 (429)" });
    } else if (r.status === 403) {
      markUpstreamError(upstream.id, "monthly_limit", "403 月度限制");
      res.json({ ok: false, ms, status: r.status, error: "月度限制 (403)" });
    } else {
      const body = await r.text().catch(() => "");
      markUpstreamFailure(upstream.id, `HTTP ${r.status}`);
      res.json({ ok: false, ms, status: r.status, error: body.slice(0, 300) });
    }
  } catch (e: unknown) {
    const msg = (e as Error).message;
    markUpstreamFailure(upstream.id, msg);
    res.json({ ok: false, ms: Date.now() - start, error: msg });
  }
});

export default router;
