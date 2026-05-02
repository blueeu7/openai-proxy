import { Router, type Request, type Response } from "express";
import { loadUpstreams, addUpstream, updateUpstream, removeUpstream, type Upstream } from "../lib/upstreams";

const router = Router();

function maskKey(u: Upstream) {
  return { ...u, apiKey: u.apiKey.length > 4 ? u.apiKey.slice(0, 4) + "****" : "****" };
}

router.get("/", (_req: Request, res: Response) => {
  res.json(loadUpstreams().map(maskKey));
});

router.post("/", (req: Request, res: Response) => {
  const { name, url, apiKey, enabled } = req.body as {
    name?: string;
    url?: string;
    apiKey?: string;
    enabled?: boolean;
  };
  if (!name || !url || !apiKey) {
    res.status(400).json({ error: "name, url, apiKey are required" });
    return;
  }
  const upstream = addUpstream(name, url, apiKey, enabled ?? true);
  res.status(201).json(maskKey(upstream));
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
  const ok = removeUpstream(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
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
      res.json({ ok: true, ms });
    } else {
      const body = await r.text().catch(() => "");
      res.json({ ok: false, ms, status: r.status, error: body.slice(0, 300) });
    }
  } catch (e: unknown) {
    res.json({ ok: false, ms: Date.now() - start, error: (e as Error).message });
  }
});

export default router;
