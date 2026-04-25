import { useEffect, useState, useCallback } from "react";

const MODELS = [
  { id: "gpt-5.2", provider: "openai" as const },
  { id: "gpt-5-mini", provider: "openai" as const },
  { id: "gpt-5-nano", provider: "openai" as const },
  { id: "o4-mini", provider: "openai" as const },
  { id: "o3", provider: "openai" as const },
  { id: "claude-opus-4-6", provider: "anthropic" as const },
  { id: "claude-sonnet-4-6", provider: "anthropic" as const },
  { id: "claude-opus-4-5", provider: "anthropic" as const },
];

// Approximate pricing per 1M tokens (USD) — based on standard public pricing
// Replit may differ slightly; this is an estimate only
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.2":         { input: 10.0,  output: 30.0  },
  "gpt-5-mini":      { input: 0.40,  output: 1.60  },
  "gpt-5-nano":      { input: 0.10,  output: 0.40  },
  "o4-mini":         { input: 1.10,  output: 4.40  },
  "o3":              { input: 10.0,  output: 40.0  },
  "claude-opus-4-6": { input: 15.0,  output: 75.0  },
  "claude-sonnet-4-6":{ input: 3.0,  output: 15.0  },
  "claude-opus-4-5": { input: 15.0,  output: 75.0  },
};

interface ModelStats {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
  lastUsedAt: number | null;
}

interface UsageData {
  startedAt: number;
  uptimeMs: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalErrors: number;
  byModel: Record<string, ModelStats>;
}

interface ProviderStatus {
  available: boolean;
  error: string | null;
  code: string | null;
}

interface QuotaStatus {
  openai: ProviderStatus;
  anthropic: ProviderStatus;
  checkedAt: number;
}

function calcCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[modelId];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

function calcTotalCost(byModel: Record<string, ModelStats>): number {
  return Object.entries(byModel).reduce((sum, [id, s]) => sum + calcCost(id, s.inputTokens, s.outputTokens), 0);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      style={{
        background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px",
        color: copied ? "#4ade80" : "#94a3b8", cursor: "pointer",
        fontSize: "11px", fontWeight: 500, padding: "3px 10px",
        transition: "all 0.15s ease", whiteSpace: "nowrap",
      }}
    >{copied ? "已复制!" : "复制"}</button>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "16px 18px", flex: 1, minWidth: 0 }}>
      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</p>
      <p style={{ color: color ?? "#f1f5f9", fontSize: "22px", fontWeight: 700, margin: "0 0 2px", fontVariantNumeric: "tabular-nums" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p style={{ color: "#475569", fontSize: "11px", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: number | null) {
  if (!ts) return "从未";
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  return `${Math.floor(m / 60)}小时前`;
}

function EndpointCard({ method, path, description, note }: { method: string; path: string; description: string; note?: string }) {
  const baseUrl = window.location.origin;
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px", padding: "16px 20px", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <span style={{ background: method === "GET" ? "rgba(59,130,246,0.2)" : "rgba(168,85,247,0.2)", color: method === "GET" ? "#60a5fa" : "#c084fc", borderRadius: "5px", fontSize: "11px", fontWeight: 700, padding: "2px 8px" }}>{method}</span>
        <code style={{ color: "#e2e8f0", fontSize: "13px", fontFamily: "monospace" }}>{path}</code>
      </div>
      <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 10px 0" }}>{description}</p>
      <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "7px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <code style={{ color: "#7dd3fc", fontSize: "12px", fontFamily: "monospace", wordBreak: "break-all" }}>{baseUrl}{path}</code>
        <CopyButton text={`${baseUrl}${path}`} />
      </div>
      {note && <p style={{ color: "#64748b", fontSize: "12px", marginTop: "8px", marginBottom: 0 }}>{note}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</h2>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "12px", padding: "20px 24px", marginBottom: "20px", ...style }}>
      {children}
    </div>
  );
}

export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [quotaChecking, setQuotaChecking] = useState(false);
  const baseUrl = window.location.origin;

  const fetchUsage = useCallback(() => {
    fetch(`${baseUrl}/v1/usage`)
      .then((r) => r.json())
      .then((data: UsageData) => { setUsageData(data); setUsageError(false); setLastRefreshed(new Date()); })
      .catch(() => setUsageError(true));
  }, [baseUrl]);

  const fetchQuotaStatus = useCallback(() => {
    setQuotaChecking(true);
    fetch(`${baseUrl}/v1/quota-status`)
      .then((r) => r.json())
      .then((data: QuotaStatus) => { setQuotaStatus(data); setQuotaChecking(false); })
      .catch(() => setQuotaChecking(false));
  }, [baseUrl]);

  useEffect(() => {
    fetch(`${baseUrl}/api/healthz`).then((r) => setOnline(r.ok)).catch(() => setOnline(false));
    fetchUsage();
    fetchQuotaStatus();
    const interval = setInterval(fetchUsage, 15000);
    const quotaInterval = setInterval(fetchQuotaStatus, 60000);
    return () => { clearInterval(interval); clearInterval(quotaInterval); };
  }, [baseUrl, fetchUsage, fetchQuotaStatus]);

  const activeModels = usageData
    ? Object.entries(usageData.byModel).filter(([, s]) => s.requests > 0).sort((a, b) => b[1].requests - a[1].requests)
    : [];

  const totalEstimatedCost = usageData ? calcTotalCost(usageData.byModel) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "hsl(222, 47%, 11%)", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "12px", background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>🔀</div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#f1f5f9" }}>OpenAI 兼容反代 API</h1>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "2px 0 0" }}>统一网关 · OpenAI &amp; Anthropic 模型</p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: online === null ? "#64748b" : online ? "#4ade80" : "#f87171", boxShadow: online === true ? "0 0 0 3px rgba(74,222,128,0.25)" : undefined }} />
              <span style={{ fontSize: "12px", color: online === null ? "#64748b" : online ? "#4ade80" : "#f87171" }}>
                {online === null ? "检测中..." : online ? "运行中" : "离线"}
              </span>
            </div>
          </div>
        </div>

        {/* Quota Status Panel */}
        {(() => {
          const openaiOk = quotaStatus?.openai.available;
          const anthropicOk = quotaStatus?.anthropic.available;
          const allOk = openaiOk && anthropicOk;
          const anyExceeded =
            quotaStatus?.openai.code === "FREE_TIER_BUDGET_EXCEEDED" ||
            quotaStatus?.anthropic.code === "FREE_TIER_BUDGET_EXCEEDED";

          const borderColor = quotaChecking && !quotaStatus
            ? "rgba(100,116,139,0.3)"
            : anyExceeded
            ? "rgba(239,68,68,0.4)"
            : allOk
            ? "rgba(74,222,128,0.3)"
            : "rgba(251,191,36,0.3)";

          const bgColor = quotaChecking && !quotaStatus
            ? "rgba(100,116,139,0.05)"
            : anyExceeded
            ? "rgba(239,68,68,0.07)"
            : allOk
            ? "rgba(74,222,128,0.06)"
            : "rgba(251,191,36,0.07)";

          return (
            <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: "10px", padding: "14px 18px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "15px" }}>
                    {quotaChecking && !quotaStatus ? "⏳" : anyExceeded ? "🚫" : allOk ? "✅" : "⚠️"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: anyExceeded ? "#f87171" : allOk ? "#4ade80" : "#fbbf24" }}>
                    {quotaChecking && !quotaStatus
                      ? "正在检测配额状态…"
                      : anyExceeded
                      ? "免费配额已用尽 — API 暂时不可用"
                      : allOk
                      ? "配额正常 — API 可用"
                      : "部分服务不可用"}
                  </span>
                </div>
                <button
                  onClick={fetchQuotaStatus}
                  disabled={quotaChecking}
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#94a3b8", cursor: quotaChecking ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 10px", opacity: quotaChecking ? 0.5 : 1 }}
                >
                  {quotaChecking ? "检测中…" : "重新检测"}
                </button>
              </div>

              {quotaStatus && (
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                  {(["openai", "anthropic"] as const).map((p) => {
                    const s = quotaStatus[p];
                    return (
                      <div key={p} style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "5px 10px" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.available ? "#4ade80" : "#f87171", flexShrink: 0 }} />
                        <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 600 }}>{p === "openai" ? "OpenAI" : "Anthropic"}</span>
                        <span style={{ color: s.available ? "#4ade80" : "#f87171", fontSize: "11px" }}>
                          {s.available ? "可用" : s.code === "FREE_TIER_BUDGET_EXCEEDED" ? "额度耗尽" : s.error ?? "不可用"}
                        </span>
                      </div>
                    );
                  })}
                  <span style={{ color: "#475569", fontSize: "11px", alignSelf: "center", marginLeft: "4px" }}>
                    {new Date(quotaStatus.checkedAt).toLocaleTimeString("zh-CN")} 检测
                  </span>
                </div>
              )}

              {anyExceeded && (
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 8px", lineHeight: 1.6 }}>
                  本月 Replit 免费 AI 积分已全部消耗，所有请求将返回错误。
                  升级 Replit 套餐后配额将自动恢复。
                </p>
              )}

              <a href="https://replit.com/account/billing" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "6px", color: "#a5b4fc", fontSize: "12px", fontWeight: 600, padding: "5px 12px", textDecoration: "none" }}>
                🔗 前往 Replit 积分 / 升级页面
              </a>
            </div>
          );
        })()}

        {/* Usage Stats */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <SectionTitle>使用量统计</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {lastRefreshed && <span style={{ color: "#475569", fontSize: "11px" }}>{lastRefreshed.toLocaleTimeString("zh-CN")} 更新</span>}
              <button onClick={fetchUsage} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#94a3b8", cursor: "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 10px" }}>刷新</button>
            </div>
          </div>

          {usageError ? (
            <p style={{ color: "#f87171", fontSize: "13px" }}>获取用量数据失败</p>
          ) : usageData ? (
            <>
              {/* Summary stats */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                <StatCard label="总请求数" value={usageData.totalRequests} sub={`${usageData.totalErrors} 次错误`} />
                <StatCard label="输入 Token" value={formatTokens(usageData.totalInputTokens)} sub="累计提示词" color="#60a5fa" />
                <StatCard label="输出 Token" value={formatTokens(usageData.totalOutputTokens)} sub="累计补全" color="#a78bfa" />
                <StatCard label="运行时长" value={formatUptime(usageData.uptimeMs)} sub={`启动于 ${new Date(usageData.startedAt).toLocaleTimeString("zh-CN")}`} />
              </div>

              {/* Cost estimate */}
              <div style={{
                background: totalEstimatedCost > 0 ? "rgba(99,102,241,0.08)" : "rgba(0,0,0,0.15)",
                border: `1px solid ${totalEstimatedCost > 0 ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>本次进程费用估算</p>
                    <p style={{ color: totalEstimatedCost > 0 ? "#a5b4fc" : "#475569", fontSize: "24px", fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                      {totalEstimatedCost > 0 ? `≈ $${totalEstimatedCost.toFixed(6)}` : "— 暂无数据"}
                    </p>
                  </div>
                  {totalEstimatedCost > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", textAlign: "right" }}>
                      {Object.entries(usageData.byModel)
                        .filter(([, s]) => s.requests > 0)
                        .map(([id, s]) => {
                          const cost = calcCost(id, s.inputTokens, s.outputTokens);
                          if (cost === 0) return null;
                          return (
                            <div key={id} style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end" }}>
                              <code style={{ color: "#64748b", fontSize: "11px", fontFamily: "monospace" }}>{id}</code>
                              <span style={{ color: "#94a3b8", fontSize: "11px", fontVariantNumeric: "tabular-nums" }}>${cost.toFixed(6)}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                <p style={{ color: "#334155", fontSize: "11px", marginTop: "8px", marginBottom: 0 }}>
                  基于公开定价估算，Replit 实际计费可能不同。每次服务重启后归零。
                  <a href="https://replit.com/account/billing" target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1", marginLeft: "6px", textDecoration: "none" }}>查看 Replit 实际账单 →</a>
                </p>
              </div>

              {/* Per-model breakdown */}
              {activeModels.length > 0 ? (
                <div>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>按模型细分</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activeModels.map(([modelId, stats]) => {
                      const model = MODELS.find((m) => m.id === modelId);
                      const provider = model?.provider ?? (modelId.startsWith("claude") ? "anthropic" : "openai");
                      const totalTokens = stats.inputTokens + stats.outputTokens;
                      const maxReqs = Math.max(...activeModels.map(([, s]) => s.requests));
                      const pct = maxReqs > 0 ? (stats.requests / maxReqs) * 100 : 0;
                      const cost = calcCost(modelId, stats.inputTokens, stats.outputTokens);
                      const pricing = MODEL_PRICING[modelId];
                      return (
                        <div key={modelId} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ background: provider === "openai" ? "rgba(59,130,246,0.2)" : "rgba(251,146,60,0.2)", color: provider === "openai" ? "#60a5fa" : "#fb923c", borderRadius: "4px", fontSize: "10px", fontWeight: 700, padding: "1px 6px", textTransform: "uppercase" }}>
                              {provider === "openai" ? "OpenAI" : "Anthropic"}
                            </span>
                            <code style={{ color: "#e2e8f0", fontSize: "12px", fontFamily: "monospace", fontWeight: 600 }}>{modelId}</code>
                            {pricing && (
                              <span style={{ fontSize: "10px", color: "#475569", marginLeft: "2px" }}>
                                ${pricing.input}/M in · ${pricing.output}/M out
                              </span>
                            )}
                            <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "12px" }}>{stats.requests} 次请求</span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "4px", height: "3px", marginBottom: "8px" }}>
                            <div style={{ background: provider === "openai" ? "linear-gradient(90deg,#3b82f6,#6366f1)" : "linear-gradient(90deg,#f97316,#ec4899)", borderRadius: "4px", height: "100%", width: `${pct}%`, transition: "width 0.3s ease" }} />
                          </div>
                          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "11px" }}>输入 <span style={{ color: "#60a5fa" }}>{formatTokens(stats.inputTokens)}</span></span>
                            <span style={{ color: "#64748b", fontSize: "11px" }}>输出 <span style={{ color: "#a78bfa" }}>{formatTokens(stats.outputTokens)}</span></span>
                            <span style={{ color: "#64748b", fontSize: "11px" }}>合计 <span style={{ color: "#94a3b8" }}>{formatTokens(totalTokens)}</span></span>
                            {cost > 0 && <span style={{ color: "#64748b", fontSize: "11px" }}>估算 <span style={{ color: "#a5b4fc" }}>${cost.toFixed(6)}</span></span>}
                            {stats.errors > 0 && <span style={{ color: "#64748b", fontSize: "11px" }}>错误 <span style={{ color: "#f87171" }}>{stats.errors}</span></span>}
                            <span style={{ color: "#475569", fontSize: "11px", marginLeft: "auto" }}>最近：{timeAgo(stats.lastUsedAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "8px", padding: "20px", textAlign: "center" }}>
                  <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>暂无请求记录。通过 /v1/chat/completions 发送消息后，用量将显示在这里。</p>
                </div>
              )}

              <p style={{ color: "#334155", fontSize: "11px", marginTop: "12px", marginBottom: 0 }}>
                ⚠️ 统计数据为本次进程内追踪，服务重启后归零。每 15 秒自动刷新。
              </p>
            </>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              {[1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 76, borderRadius: "10px", background: "rgba(255,255,255,0.04)" }} />)}
            </div>
          )}
        </Card>

        {/* Base URL */}
        <Card>
          <SectionTitle>Base URL</SectionTitle>
          <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <code style={{ color: "#7dd3fc", fontSize: "14px", fontFamily: "monospace", wordBreak: "break-all" }}>{baseUrl}</code>
            <CopyButton text={baseUrl} />
          </div>
          <p style={{ color: "#64748b", fontSize: "12px", marginTop: "10px", marginBottom: 0 }}>配置任何 OpenAI 兼容客户端时，将此作为 <strong style={{ color: "#94a3b8" }}>Base URL</strong> 填写。</p>
        </Card>

        {/* API Key */}
        <Card>
          <SectionTitle>API Key</SectionTitle>
          <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: "8px", padding: "12px 16px" }}>
            <code style={{ color: "#94a3b8", fontSize: "13px", fontFamily: "monospace" }}>
              Authorization: Bearer <span style={{ color: "#fbbf24" }}>{"<your PROXY_API_KEY>"}</span>
            </code>
          </div>
          <p style={{ color: "#64748b", fontSize: "12px", marginTop: "10px", marginBottom: 0 }}>在 Replit Secrets 中设置 <code style={{ color: "#94a3b8" }}>PROXY_API_KEY</code>，默认值为 <code style={{ color: "#fbbf24" }}>123</code>。</p>
        </Card>

        {/* Endpoints */}
        <Card>
          <SectionTitle>接口</SectionTitle>
          <EndpointCard method="GET" path="/v1/models" description="列出所有可用模型及其提供商信息。" />
          <EndpointCard method="POST" path="/v1/chat/completions" description="创建聊天补全，支持流式（stream: true）和非流式响应。" note="按模型名前缀自动路由：gpt/o → OpenAI　claude → Anthropic" />
          <EndpointCard method="GET" path="/v1/usage" description="查询本次进程的请求数、Token 用量及按模型的详细统计（含费用估算）。" note="无需鉴权，可直接访问" />
        </Card>

        {/* Models */}
        <Card>
          <SectionTitle>可用模型</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {MODELS.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 12px" }}>
                <span style={{ background: m.provider === "openai" ? "rgba(59,130,246,0.2)" : "rgba(251,146,60,0.2)", color: m.provider === "openai" ? "#60a5fa" : "#fb923c", borderRadius: "4px", fontSize: "10px", fontWeight: 700, padding: "1px 6px", textTransform: "uppercase" }}>
                  {m.provider === "openai" ? "OpenAI" : "Anthropic"}
                </span>
                <code style={{ color: "#e2e8f0", fontSize: "13px", fontFamily: "monospace" }}>{m.id}</code>
                <CopyButton text={m.id} />
              </div>
            ))}
          </div>
        </Card>

        {/* CherryStudio guide */}
        <Card>
          <SectionTitle>CherryStudio 配置（4 步）</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { step: 1, title: "打开模型服务商设置", detail: "在 CherryStudio 中，进入 设置 → 模型服务商 → 点击「添加服务商」或选择「自定义」。" },
              { step: 2, title: "填写 Base URL", detail: <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>填入：<code style={{ color: "#7dd3fc", fontFamily: "monospace", fontSize: "12px", background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "4px" }}>{baseUrl}</code><CopyButton text={baseUrl} /></span> },
              { step: 3, title: "填写 API Key", detail: <span>填写 <code style={{ color: "#fbbf24", fontFamily: "monospace", fontSize: "12px", background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "4px" }}>PROXY_API_KEY</code> 的值（默认：<code style={{ color: "#fbbf24", fontFamily: "monospace" }}>123</code>）。</span> },
              { step: 4, title: "添加模型并测试", detail: "点击「管理模型」，手动添加任意模型 ID（如 gpt-5.2、claude-sonnet-4-6），然后发送一条测试消息。" },
            ].map(({ step, title, detail }) => (
              <div key={step} style={{ display: "flex", gap: "14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "14px 16px" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "white", flexShrink: 0 }}>{step}</div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 4px", color: "#e2e8f0" }}>{title}</p>
                  <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <p style={{ color: "#475569", fontSize: "12px", textAlign: "center", margin: 0 }}>
          由 Replit AI Integrations 提供 · OpenAI &amp; Anthropic · 无需自备 API Key
        </p>
      </div>
    </div>
  );
}
