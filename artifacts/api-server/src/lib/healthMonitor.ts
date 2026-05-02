import { loadUpstreams, markUpstreamOnline, markUpstreamError, markUpstreamFailure, type Upstream } from "./upstreams";
import { logger } from "./logger";

async function pingUpstream(upstream: Upstream): Promise<void> {
  try {
    const r = await fetch(`${upstream.url}/v1/models`, {
      headers: { Authorization: `Bearer ${upstream.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (r.ok) {
      markUpstreamOnline(upstream.id);
      logger.info({ upstream: upstream.name }, "health: online");
    } else if (r.status === 429) {
      markUpstreamError(upstream.id, "quota_exceeded", "429 配额超限");
      logger.warn({ upstream: upstream.name }, "health: quota_exceeded");
    } else if (r.status === 403) {
      markUpstreamError(upstream.id, "monthly_limit", "403 月度限制");
      logger.warn({ upstream: upstream.name }, "health: monthly_limit");
    } else {
      markUpstreamFailure(upstream.id, `HTTP ${r.status}`);
      logger.warn({ upstream: upstream.name, status: r.status }, "health: error");
    }
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "network error";
    markUpstreamFailure(upstream.id, msg);
    logger.warn({ upstream: upstream.name, err: msg }, "health: unreachable");
  }
}

export function startHealthMonitor(intervalMs = 60_000): void {
  logger.info({ intervalMs }, "health monitor started");
  setInterval(() => {
    const candidates = loadUpstreams().filter((u) => u.enabled && u.status !== "banned");
    for (const upstream of candidates) {
      void pingUpstream(upstream);
    }
  }, intervalMs);
}
