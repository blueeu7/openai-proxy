import { useEffect, useState, useCallback } from "react";

const MODELS = [
  { id: "gpt-4.1",              provider: "openai" as const },
  { id: "gpt-4.1-mini",         provider: "openai" as const },
  { id: "gpt-4.1-nano",         provider: "openai" as const },
  { id: "gpt-4o",               provider: "openai" as const },
  { id: "gpt-4o-mini",          provider: "openai" as const },
  { id: "gpt-5",                provider: "openai" as const },
  { id: "gpt-5-mini",           provider: "openai" as const },
  { id: "gpt-5-nano",           provider: "openai" as const },
  { id: "gpt-5-pro",            provider: "openai" as const },
  { id: "gpt-5.1",              provider: "openai" as const },
  { id: "gpt-5.1-codex",        provider: "openai" as const },
  { id: "gpt-5.1-codex-mini",   provider: "openai" as const },
  { id: "gpt-5.2",              provider: "openai" as const },
  { id: "gpt-5.2-codex",        provider: "openai" as const },
  { id: "gpt-5.2-pro",          provider: "openai" as const },
  { id: "gpt-5.3-chat-latest",  provider: "openai" as const },
  { id: "gpt-5.3-codex",        provider: "openai" as const },
  { id: "gpt-5.4",              provider: "openai" as const },
  { id: "gpt-5.4-mini",         provider: "openai" as const },
  { id: "gpt-5.4-nano",         provider: "openai" as const },
  { id: "gpt-5.4-pro",          provider: "openai" as const },
  { id: "gpt-5.5",              provider: "openai" as const },
  { id: "gpt-5.5-pro",          provider: "openai" as const },
  { id: "o3",                   provider: "openai" as const },
  { id: "o3-mini",              provider: "openai" as const },
  { id: "o4-mini",              provider: "openai" as const },
  { id: "claude-opus-4-7",          provider: "anthropic" as const },
  { id: "claude-opus-4-6",          provider: "anthropic" as const },
  { id: "claude-opus-4-5",          provider: "anthropic" as const },
  { id: "claude-sonnet-4-6",        provider: "anthropic" as const },
  { id: "claude-haiku-4-5",         provider: "anthropic" as const },
  { id: "claude-opus-4-7-thinking", provider: "anthropic" as const },
  { id: "claude-opus-4-6-thinking", provider: "anthropic" as const },
  { id: "claude-opus-4-5-thinking", provider: "anthropic" as const },
];

// Approximate pricing per 1M tokens (USD) — based on standard public pricing
// Replit may differ slightly; this is an estimate only
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1":              { input: 2.0,   output: 8.0   },
  "gpt-4.1-mini":         { input: 0.40,  output: 1.60  },
  "gpt-4.1-nano":         { input: 0.10,  output: 0.40  },
  "gpt-4o":               { input: 2.50,  output: 10.0  },
  "gpt-4o-mini":          { input: 0.15,  output: 0.60  },
  "gpt-5":                { input: 10.0,  output: 30.0  },
  "gpt-5-mini":           { input: 0.40,  output: 1.60  },
  "gpt-5-nano":           { input: 0.10,  output: 0.40  },
  "gpt-5-pro":            { input: 20.0,  output: 60.0  },
  "gpt-5.1":              { input: 10.0,  output: 30.0  },
  "gpt-5.1-codex":        { input: 10.0,  output: 30.0  },
  "gpt-5.1-codex-mini":   { input: 0.40,  output: 1.60  },
  "gpt-5.2":              { input: 10.0,  output: 30.0  },
  "gpt-5.2-codex":        { input: 10.0,  output: 30.0  },
  "gpt-5.2-pro":          { input: 20.0,  output: 60.0  },
  "gpt-5.3-chat-latest":  { input: 10.0,  output: 30.0  },
  "gpt-5.3-codex":        { input: 10.0,  output: 30.0  },
  "gpt-5.4":              { input: 10.0,  output: 30.0  },
  "gpt-5.4-mini":         { input: 0.40,  output: 1.60  },
  "gpt-5.4-nano":         { input: 0.10,  output: 0.40  },
  "gpt-5.4-pro":          { input: 20.0,  output: 60.0  },
  "gpt-5.5":              { input: 10.0,  output: 30.0  },
  "gpt-5.5-pro":          { input: 20.0,  output: 60.0  },
  "o3":                   { input: 10.0,  output: 40.0  },
  "o3-mini":              { input: 1.10,  output: 4.40  },
  "o4-mini":              { input: 1.10,  output: 4.40  },
  "claude-opus-4-7":          { input: 15.0,  output: 75.0  },
  "claude-opus-4-6":          { input: 15.0,  output: 75.0  },
  "claude-opus-4-5":          { input: 15.0,  output: 75.0  },
  "claude-sonnet-4-6":        { input: 3.0,   output: 15.0  },
  "claude-haiku-4-5":         { input: 0.80,  output: 4.0   },
  "claude-opus-4-7-thinking": { input: 15.0,  output: 75.0  },
  "claude-opus-4-6-thinking": { input: 15.0,  output: 75.0  },
  "claude-opus-4-5-thinking": { input: 15.0,  output: 75.0  },
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

type NodeStatus = "online" | "offline" | "quota_exceeded" | "monthly_limit" | "banned";

interface UpstreamInfo {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  status: NodeStatus;
  weight: number;
  createdAt: number;
  lastSeenAt: number | null;
  lastErrorAt: number | null;
  lastErrorMsg: string | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalErrors: number;
}

interface UpstreamTestResult {
  ok: boolean;
  ms?: number;
  error?: string;
  testing?: boolean;
}

interface DeletionRecord {
  id: string;
  nodeId: string;
  name: string;
  url: string;
  reason: "manual" | "quota_exceeded" | "monthly_limit" | "consecutive_errors" | "auth_failure";
  deletedAt: number;
  errorMsg?: string;
}

interface AppSettings {
  maxConsecutiveFailures: number;
  healthIntervalMs: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  rateLimitEnabled: boolean;
  rateLimitPerMinute: number;
  retryOnError: boolean;
  requestTimeoutMs: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  maxConsecutiveFailures: 3,
  healthIntervalMs: 60_000,
  cacheEnabled: true,
  cacheTtlMs: 3_600_000,
  rateLimitEnabled: true,
  rateLimitPerMinute: 20,
  retryOnError: true,
  requestTimeoutMs: 120_000,
};

const DELETION_REASON_LABELS: Record<DeletionRecord["reason"], string> = {
  manual: "手动删除",
  quota_exceeded: "429 配额超限",
  monthly_limit: "403 月度限制",
  consecutive_errors: "连续错误下线",
  auth_failure: "认证失败",
};

const STATUS_CFG: Record<NodeStatus, { label: string; color: string; bg: string; border: string }> = {
  online:         { label: "在线",    color: "#4ade80", bg: "rgba(74,222,128,0.1)",   border: "rgba(74,222,128,0.25)" },
  offline:        { label: "离线",    color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  quota_exceeded: { label: "429超限", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)" },
  monthly_limit:  { label: "403月限", color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.25)" },
  banned:         { label: "已封禁",  color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)" },
};

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
  const [upstreams, setUpstreams] = useState<UpstreamInfo[]>([]);
  const [upstreamForm, setUpstreamForm] = useState({ name: "", url: "", apiKey: "", weight: 1 });
  const [upstreamAdding, setUpstreamAdding] = useState(false);
  const [upstreamFormOpen, setUpstreamFormOpen] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, UpstreamTestResult>>({});
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [nodeTab, setNodeTab] = useState<"nodes" | "cluster" | "deletions" | "deploy" | "settings">("nodes");
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [deletionLog, setDeletionLog] = useState<DeletionRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", url: "", apiKey: "", weight: 1 });
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

  const fetchUpstreams = useCallback(() => {
    fetch(`${baseUrl}/api/upstreams`)
      .then((r) => r.json())
      .then((data: UpstreamInfo[]) => setUpstreams(data))
      .catch(() => {});
  }, [baseUrl]);

  const fetchCacheStats = useCallback(() => {
    fetch(`${baseUrl}/v1/cache-stats`)
      .then((r) => r.json())
      .then((d: { size: number }) => setCacheSize(d.size))
      .catch(() => {});
  }, [baseUrl]);

  const fetchDeletionLog = useCallback(() => {
    fetch(`${baseUrl}/api/deletion-log`)
      .then((r) => r.json())
      .then((data: DeletionRecord[]) => setDeletionLog(data))
      .catch(() => {});
  }, [baseUrl]);

  const fetchSettings = useCallback(() => {
    fetch(`${baseUrl}/api/settings`)
      .then((r) => r.json())
      .then((data: AppSettings) => { setSettings(data); setSettingsForm(data); })
      .catch(() => {});
  }, [baseUrl]);

  const addUpstream = async () => {
    if (!upstreamForm.name || !upstreamForm.url || !upstreamForm.apiKey) return;
    setUpstreamAdding(true);
    try {
      await fetch(`${baseUrl}/api/upstreams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upstreamForm),
      });
      setUpstreamForm({ name: "", url: "", apiKey: "", weight: 1 });
      setUpstreamFormOpen(false);
      fetchUpstreams();
    } finally {
      setUpstreamAdding(false);
    }
  };

  const toggleUpstream = async (id: string, enabled: boolean) => {
    await fetch(`${baseUrl}/api/upstreams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    fetchUpstreams();
  };

  const deleteUpstream = async (id: string) => {
    await fetch(`${baseUrl}/api/upstreams/${id}`, { method: "DELETE" });
    setTestResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
    fetchUpstreams();
  };

  const testUpstream = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: { ok: false, testing: true } }));
    const r = await fetch(`${baseUrl}/api/upstreams/${id}/test`, { method: "POST" });
    const data = (await r.json()) as UpstreamTestResult;
    setTestResults((prev) => ({ ...prev, [id]: { ...data, testing: false } }));
    fetchUpstreams();
  };

  const wakeUpstreamNode = async (id: string) => {
    await fetch(`${baseUrl}/api/upstreams/${id}/wake`, { method: "POST" });
    fetchUpstreams();
  };

  const wakeAll = async () => {
    await fetch(`${baseUrl}/api/upstreams/wake-all`, { method: "POST" });
    fetchUpstreams();
  };

  const clearDeletionLogFn = async () => {
    await fetch(`${baseUrl}/api/deletion-log`, { method: "DELETE" });
    fetchDeletionLog();
  };

  const saveSettingsFn = async () => {
    setSettingsSaving(true);
    try {
      const r = await fetch(`${baseUrl}/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      const data = (await r.json()) as AppSettings;
      setSettings(data);
      setSettingsForm(data);
    } finally {
      setSettingsSaving(false);
    }
  };

  const startEditNode = (u: UpstreamInfo) => {
    setEditingNode(u.id);
    setEditForm({ name: u.name, url: u.url, apiKey: "", weight: u.weight ?? 1 });
  };

  const saveEditNode = async (id: string) => {
    await fetch(`${baseUrl}/api/upstreams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingNode(null);
    fetchUpstreams();
  };

  useEffect(() => {
    fetch(`${baseUrl}/api/healthz`).then((r) => setOnline(r.ok)).catch(() => setOnline(false));
    fetchUsage();
    fetchQuotaStatus();
    fetchUpstreams();
    fetchCacheStats();
    fetchDeletionLog();
    fetchSettings();
    const interval = setInterval(() => { fetchUsage(); fetchCacheStats(); fetchUpstreams(); }, 15000);
    const quotaInterval = setInterval(fetchQuotaStatus, 60000);
    return () => { clearInterval(interval); clearInterval(quotaInterval); };
  }, [baseUrl, fetchUsage, fetchQuotaStatus, fetchUpstreams, fetchCacheStats, fetchDeletionLog, fetchSettings]);

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

        {/* Node Management Panel */}
        <Card style={{ padding: 0 }}>
          {/* ── Tab Bar ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 20px", overflowX: "auto" }}>
            {(["nodes", "cluster", "deletions", "deploy", "settings"] as const).map((tab) => {
              const labels: Record<string, string> = { nodes: "节点管理", cluster: "集群", deletions: "删除记录", deploy: "部署代码", settings: "设置" };
              return (
                <button key={tab} onClick={() => setNodeTab(tab)} style={{
                  background: "transparent", border: "none", whiteSpace: "nowrap",
                  borderBottom: nodeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
                  color: nodeTab === tab ? "#60a5fa" : "#475569",
                  cursor: "pointer", fontSize: "12px",
                  fontWeight: nodeTab === tab ? 600 : 400,
                  padding: "11px 14px", transition: "color 0.15s",
                }}>
                  {labels[tab]}
                  {tab === "deletions" && deletionLog.length > 0 && (
                    <span style={{ background: "#ef4444", borderRadius: "8px", color: "white", fontSize: "9px", fontWeight: 700, marginLeft: "4px", padding: "1px 5px", verticalAlign: "middle" }}>{deletionLog.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ padding: "20px 24px" }}>

            {/* ══════════════ 节点管理 TAB ══════════════ */}
            {nodeTab === "nodes" && <>
              {/* Endpoint row */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 180px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "9px 13px" }}>
                  <p style={{ color: "#475569", fontSize: "10px", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>接入端点 (Base URL)</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <code style={{ color: "#7dd3fc", fontSize: "12px", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{baseUrl}/v1</code>
                    <CopyButton text={`${baseUrl}/v1`} />
                  </div>
                </div>
                <div style={{ flex: "1 1 120px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "9px 13px" }}>
                  <p style={{ color: "#475569", fontSize: "10px", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>节点总数</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ color: "#e2e8f0", fontSize: "18px", fontWeight: 700 }}>{upstreams.length}</span>
                    <span style={{ color: "#4ade80", fontSize: "12px" }}>{upstreams.filter(u => u.enabled && u.status === "online").length} 在线</span>
                  </div>
                </div>
              </div>

              {/* Auto-protection mechanism */}
              <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: "9px", padding: "12px 14px", marginBottom: "14px" }}>
                <p style={{ color: "#fca5a5", fontSize: "12px", fontWeight: 600, margin: "0 0 9px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🛡️ 自动保护机制
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "3px 16px" }}>
                  {[
                    "429 配额超限 → 标记「超限」，停止路由，保留数据",
                    "403 月度限制 → 标记「月限」，停止路由，保留数据",
                    "3 次连续失败 → 标记「离线」，自动下线",
                    "5xx 服务错误 → 计入失败次数，累计触发下线",
                    "请求失败 → 自动切换下一个可用节点",
                    "心跳检测 60s → 恢复在线时自动解除离线状态",
                  ].map((rule) => (
                    <div key={rule} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                      <span style={{ color: "#ef4444", fontSize: "10px", marginTop: "2px", flexShrink: 0 }}>•</span>
                      <span style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.55 }}>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats bar + action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                <span style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "5px", color: "#64748b", fontSize: "11px", padding: "4px 10px" }}>
                  共 <strong style={{ color: "#94a3b8" }}>{upstreams.length}</strong> 节点，<strong style={{ color: "#94a3b8" }}>{upstreams.filter(u => u.enabled).length}</strong> 启用
                </span>
                <span style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "5px", color: "#64748b", fontSize: "11px", padding: "4px 10px" }}>
                  总请求 <strong style={{ color: "#94a3b8" }}>{upstreams.reduce((s, u) => s + u.totalRequests, 0)}</strong>
                </span>
                {usageData && (
                  <span style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "5px", color: "#64748b", fontSize: "11px", padding: "4px 10px" }}>
                    总Token <strong style={{ color: "#a78bfa" }}>{formatTokens(usageData.totalInputTokens + usageData.totalOutputTokens)}</strong>
                  </span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                  {upstreams.some(u => u.enabled && u.status !== "online") && (
                    <button onClick={wakeAll} style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "6px", color: "#fbbf24", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: "5px 12px" }}>
                      ⚡ 唤醒全部
                    </button>
                  )}
                  <button onClick={() => { setUpstreamFormOpen(v => !v); }} style={{ background: upstreamFormOpen ? "rgba(99,102,241,0.15)" : "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: "5px 12px" }}>
                    {upstreamFormOpen ? "取消" : "+ 手动添加"}
                  </button>
                </div>
              </div>

              {/* Add form */}
              {upstreamFormOpen && (
                <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "9px", padding: "14px 16px", marginBottom: "14px" }}>
                  <p style={{ color: "#93c5fd", fontSize: "11px", fontWeight: 600, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>注册新节点</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <input placeholder="节点名称（如 账号2）" value={upstreamForm.name}
                        onChange={(e) => setUpstreamForm((f) => ({ ...f, name: e.target.value }))}
                        style={{ flex: "1 1 130px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "7px", color: "#e2e8f0", fontSize: "12px", padding: "7px 11px", outline: "none" }} />
                      <input placeholder="部署地址（如 https://xxx.replit.app）" value={upstreamForm.url}
                        onChange={(e) => setUpstreamForm((f) => ({ ...f, url: e.target.value }))}
                        style={{ flex: "2 1 240px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "7px", color: "#e2e8f0", fontSize: "12px", padding: "7px 11px", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input placeholder="API Key（PROXY_API_KEY，默认 123）" value={upstreamForm.apiKey}
                        onChange={(e) => setUpstreamForm((f) => ({ ...f, apiKey: e.target.value }))}
                        style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "7px", color: "#e2e8f0", fontSize: "12px", padding: "7px 11px", outline: "none", fontFamily: "monospace" }} />
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px" }}>
                        <span style={{ color: "#475569", fontSize: "10px", textAlign: "center" }}>权重</span>
                        <input type="number" min={1} max={10} value={upstreamForm.weight}
                          onChange={(e) => setUpstreamForm((f) => ({ ...f, weight: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                          style={{ width: "52px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "7px", color: "#e2e8f0", fontSize: "12px", padding: "7px 8px", outline: "none", textAlign: "center" }} />
                      </div>
                      <button onClick={addUpstream}
                        disabled={upstreamAdding || !upstreamForm.name || !upstreamForm.url || !upstreamForm.apiKey}
                        style={{ background: upstreamAdding ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.85)", border: "none", borderRadius: "7px", color: "white", cursor: upstreamAdding ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, padding: "7px 16px", flexShrink: 0 }}>
                        {upstreamAdding ? "添加中…" : "确认"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact node grid */}
              {upstreams.length === 0 ? (
                <div style={{ background: "rgba(0,0,0,0.15)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "8px", padding: "32px", textAlign: "center" }}>
                  <p style={{ color: "#475569", fontSize: "28px", margin: "0 0 8px" }}>🔗</p>
                  <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 4px", fontWeight: 600 }}>暂无节点</p>
                  <p style={{ color: "#475569", fontSize: "12px", margin: 0 }}>注册其他 Replit 账号部署的代理地址后，请求将优先路由至节点池，全部失败时回退至本账号。</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "10px" }}>
                    {upstreams.map((u) => {
                      const eff: NodeStatus = !u.enabled ? "banned" : u.status;
                      const cfg = STATUS_CFG[eff];
                      const isSelected = expandedNode === u.id;
                      return (
                        <div key={u.id} onClick={() => setExpandedNode(isSelected ? null : u.id)}
                          style={{
                            width: "128px", flexShrink: 0,
                            background: isSelected ? cfg.bg : "rgba(0,0,0,0.22)",
                            border: `1px solid ${isSelected ? cfg.color : cfg.border}`,
                            borderRadius: "8px", padding: "8px 10px", cursor: "pointer",
                            transition: "border-color 0.15s, background 0.15s",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                            <span style={{ color: "#e2e8f0", fontSize: "11px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                          </div>
                          <span style={{ color: cfg.color, fontSize: "10px" }}>{cfg.label}</span>
                          {u.totalRequests > 0 && <span style={{ color: "#334155", fontSize: "10px", marginLeft: "6px" }}>{u.totalRequests}次</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded detail panel */}
                  {expandedNode ? (() => {
                    const u = upstreams.find(x => x.id === expandedNode);
                    if (!u) return null;
                    const eff: NodeStatus = !u.enabled ? "banned" : u.status;
                    const cfg = STATUS_CFG[eff];
                    const tr = testResults[u.id];
                    const canWake = u.enabled && eff !== "online";
                    return (
                      <div style={{ background: "rgba(0,0,0,0.28)", border: `1px solid ${cfg.border}`, borderRadius: "10px", padding: "14px 16px" }}>
                        {/* Detail header */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                          <span style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}>{u.name}</span>
                          <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "5px", color: cfg.color, fontSize: "10px", fontWeight: 700, padding: "2px 7px" }}>{cfg.label}</span>
                          <button onClick={() => setExpandedNode(null)}
                            style={{ marginLeft: "auto", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "0 4px" }}>×</button>
                        </div>

                        {/* URL */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                          <code style={{ color: "#7dd3fc", fontSize: "11px", fontFamily: "monospace", background: "rgba(0,0,0,0.3)", padding: "4px 9px", borderRadius: "4px", flex: 1, wordBreak: "break-all" }}>{u.url}</code>
                          <CopyButton text={u.url} />
                        </div>

                        {/* Stats grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                          {[
                            { label: "总请求", value: u.totalRequests, color: "#94a3b8" },
                            { label: "总错误", value: u.totalErrors, color: u.totalErrors > 0 ? "#f87171" : "#475569" },
                            { label: "连续失败", value: u.consecutiveFailures, color: u.consecutiveFailures > 0 ? "#fbbf24" : "#475569" },
                          ].map(({ label, value, color }) => (
                            <div key={label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "8px 10px", textAlign: "center" }}>
                              <p style={{ color, fontSize: "20px", fontWeight: 700, margin: "0 0 2px", fontVariantNumeric: "tabular-nums" }}>{value}</p>
                              <p style={{ color: "#475569", fontSize: "10px", margin: 0 }}>{label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Time info */}
                        {(u.lastSeenAt || u.lastErrorAt) && (
                          <div style={{ display: "flex", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
                            {u.lastSeenAt && <span style={{ color: "#475569", fontSize: "11px" }}>最近在线 <span style={{ color: "#64748b" }}>{timeAgo(u.lastSeenAt)}</span></span>}
                            {u.lastErrorAt && <span style={{ color: "#475569", fontSize: "11px" }}>最近错误 <span style={{ color: "#64748b" }}>{timeAgo(u.lastErrorAt)}</span></span>}
                          </div>
                        )}

                        {/* Error message */}
                        {u.lastErrorMsg && eff !== "online" && (
                          <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "5px", padding: "5px 10px", marginBottom: "10px" }}>
                            <span style={{ color: "#f87171", fontSize: "11px" }}>{u.lastErrorMsg}</span>
                          </div>
                        )}

                        {/* Test result */}
                        {tr && !tr.testing && (
                          <div style={{ background: tr.ok ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)", border: `1px solid ${tr.ok ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`, borderRadius: "5px", padding: "5px 10px", marginBottom: "10px" }}>
                            <span style={{ color: tr.ok ? "#4ade80" : "#f87171", fontSize: "11px" }}>
                              {tr.ok ? `✓ 连通 ${tr.ms}ms` : `✗ ${tr.error?.slice(0, 100) ?? "失败"}`}
                            </span>
                          </div>
                        )}

                        {/* Edit form */}
                        {editingNode === u.id && (
                          <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "7px", padding: "10px 12px", marginBottom: "8px" }}>
                            <p style={{ color: "#93c5fd", fontSize: "11px", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>编辑节点</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <input placeholder="节点名称" value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none" }} />
                              <input placeholder="部署地址" value={editForm.url}
                                onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none" }} />
                              <div style={{ display: "flex", gap: "6px" }}>
                                <input placeholder="新 API Key（留空保持不变）" value={editForm.apiKey}
                                  onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                                  style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", fontFamily: "monospace" }} />
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", justifyContent: "center" }}>
                                  <span style={{ color: "#475569", fontSize: "10px", textAlign: "center" }}>权重</span>
                                  <input type="number" min={1} max={10} value={editForm.weight}
                                    onChange={(e) => setEditForm((f) => ({ ...f, weight: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                                    style={{ width: "52px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 8px", outline: "none", textAlign: "center" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => void saveEditNode(u.id)}
                                  style={{ background: "rgba(59,130,246,0.7)", border: "none", borderRadius: "5px", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: "5px 14px" }}>
                                  保存
                                </button>
                                <button onClick={() => setEditingNode(null)}
                                  style={{ background: "rgba(100,116,139,0.2)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: "5px", color: "#94a3b8", cursor: "pointer", fontSize: "11px", padding: "5px 14px" }}>
                                  取消
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button onClick={() => testUpstream(u.id)} disabled={tr?.testing}
                            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "5px", color: "#60a5fa", cursor: tr?.testing ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 12px", opacity: tr?.testing ? 0.5 : 1 }}>
                            {tr?.testing ? "检测中…" : "测试连通性"}
                          </button>
                          <button onClick={() => { editingNode === u.id ? setEditingNode(null) : startEditNode(u); }}
                            style={{ background: editingNode === u.id ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "5px", color: "#a78bfa", cursor: "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 12px" }}>
                            {editingNode === u.id ? "收起" : "编辑"}
                          </button>
                          {canWake && (
                            <button onClick={() => { void wakeUpstreamNode(u.id); setExpandedNode(null); }}
                              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "5px", color: "#fbbf24", cursor: "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 12px" }}>
                              唤醒节点
                            </button>
                          )}
                          <button onClick={() => toggleUpstream(u.id, !u.enabled)}
                            style={{ background: u.enabled ? "rgba(74,222,128,0.1)" : "rgba(100,116,139,0.12)", border: `1px solid ${u.enabled ? "rgba(74,222,128,0.2)" : "rgba(100,116,139,0.2)"}`, borderRadius: "5px", color: u.enabled ? "#4ade80" : "#64748b", cursor: "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 12px" }}>
                            {u.enabled ? "禁用" : "启用"}
                          </button>
                          <button onClick={() => { void deleteUpstream(u.id); setExpandedNode(null); fetchDeletionLog(); }}
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "5px", color: "#f87171", cursor: "pointer", fontSize: "11px", fontWeight: 500, padding: "4px 12px", marginLeft: "auto" }}>
                            删除节点
                          </button>
                        </div>
                      </div>
                    );
                  })() : (
                    <p style={{ color: "#334155", fontSize: "11px", textAlign: "center", padding: "10px 0 0" }}>
                      点击上面的节点小格查看详情和操作
                    </p>
                  )}
                </>
              )}
            </>}

            {/* ══════════════ 集群 TAB ══════════════ */}
            {nodeTab === "cluster" && (() => {
              const total = upstreams.length;
              if (total === 0) return <p style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>暂无节点数据</p>;
              const groups: { label: string; status: NodeStatus | "disabled"; color: string; bg: string; border: string; nodes: UpstreamInfo[] }[] = [
                { label: "在线", status: "online",         color: "#4ade80", bg: "rgba(74,222,128,0.08)",   border: "rgba(74,222,128,0.2)",   nodes: upstreams.filter(u => u.enabled && u.status === "online") },
                { label: "离线", status: "offline",        color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", nodes: upstreams.filter(u => u.enabled && u.status === "offline") },
                { label: "429超限", status: "quota_exceeded", color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  nodes: upstreams.filter(u => u.status === "quota_exceeded") },
                { label: "403月限", status: "monthly_limit",  color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)",  nodes: upstreams.filter(u => u.status === "monthly_limit") },
                { label: "已停用", status: "disabled",     color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", nodes: upstreams.filter(u => !u.enabled) },
              ].filter(g => g.nodes.length > 0);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "6px" }}>
                    {[
                      { label: "节点总数", value: total, color: "#e2e8f0" },
                      { label: "在线可用", value: upstreams.filter(u => u.enabled && u.status === "online").length, color: "#4ade80" },
                      { label: "累计请求", value: upstreams.reduce((s, u) => s + u.totalRequests, 0), color: "#60a5fa" },
                      { label: "累计错误", value: upstreams.reduce((s, u) => s + u.totalErrors, 0), color: "#f87171" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "12px 14px", textAlign: "center" }}>
                        <p style={{ color, fontSize: "22px", fontWeight: 700, margin: "0 0 3px", fontVariantNumeric: "tabular-nums" }}>{value}</p>
                        <p style={{ color: "#475569", fontSize: "11px", margin: 0 }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {groups.map(g => (
                    <div key={g.label} style={{ background: g.bg, border: `1px solid ${g.border}`, borderRadius: "8px", padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ color: g.color, fontSize: "12px", fontWeight: 600 }}>{g.label}</span>
                        <span style={{ color: g.color, fontSize: "11px", background: `${g.border}`, borderRadius: "4px", padding: "1px 6px" }}>{g.nodes.length} 节点</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {g.nodes.map(n => (
                          <div key={n.id} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "5px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>{n.name}</span>
                            <span style={{ color: "#475569", fontSize: "10px" }}>W{n.weight ?? 1}</span>
                            <span style={{ color: "#334155", fontSize: "10px" }}>{n.totalRequests}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* ── 规则管理 ─────────────────────────────────────────── */}
                  <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "14px 16px" }}>
                    <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>⚖️ 规则管理</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "7px" }}>
                      {[
                        { icon: "⚖️", label: "路由策略",     value: "加权轮询" },
                        { icon: "💓", label: "心跳检测",     value: `每 ${settings ? Math.round(settings.healthIntervalMs / 1000) : 60}s` },
                        { icon: "🔄", label: "故障自动转移", value: "已启用" },
                        { icon: "❌", label: "最大连续失败", value: `${settings?.maxConsecutiveFailures ?? 3} 次` },
                        { icon: "💾", label: "响应缓存",     value: settings?.cacheEnabled ? `${Math.round((settings.cacheTtlMs ?? 3_600_000) / 60_000)}min` : "已禁用" },
                        { icon: "🚦", label: "IP 限流",      value: settings?.rateLimitEnabled ? `${settings.rateLimitPerMinute ?? 20} 次/分钟` : "已禁用" },
                        { icon: "🔁", label: "失败重试",     value: settings?.retryOnError !== false ? "已启用" : "已禁用" },
                        { icon: "⏱️", label: "请求超时",     value: `${Math.round((settings?.requestTimeoutMs ?? 120_000) / 1000)}s` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} style={{ background: "rgba(0,0,0,0.18)", borderRadius: "6px", padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#64748b", fontSize: "11px" }}>{icon} {label}</span>
                          <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ══════════════ 部署代码 TAB ══════════════ */}
            {nodeTab === "deploy" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "9px", padding: "14px 16px" }}>
                  <p style={{ color: "#93c5fd", fontSize: "12px", fontWeight: 600, margin: "0 0 8px" }}>📋 如何添加新的 Replit 节点</p>
                  <ol style={{ color: "#94a3b8", fontSize: "12px", lineHeight: 2, margin: 0, paddingLeft: "18px" }}>
                    <li>在新 Replit 账号中 Fork 本项目</li>
                    <li>在 Secrets 中设置 <code style={{ color: "#7dd3fc", background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "3px" }}>PROXY_API_KEY</code> 为任意密钥</li>
                    <li>点击 Deploy 部署，获得节点 URL</li>
                    <li>回到本页「节点管理」→「+ 手动添加」注册节点</li>
                  </ol>
                </div>

                <div>
                  <p style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>注册节点 API</p>
                  <div style={{ position: "relative" }}>
                    <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px", fontFamily: "monospace", padding: "14px 16px", margin: 0, overflowX: "auto", lineHeight: 1.6 }}>{`POST ${baseUrl}/api/upstreams
Content-Type: application/json

{
  "name": "账号2",
  "url": "https://your-node.replit.app",
  "apiKey": "your-proxy-api-key"
}`}</pre>
                    <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                      <CopyButton text={`POST ${baseUrl}/api/upstreams\nContent-Type: application/json\n\n{\n  "name": "账号2",\n  "url": "https://your-node.replit.app",\n  "apiKey": "your-proxy-api-key"\n}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <p style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>客户端接入示例（Python）</p>
                  <div style={{ position: "relative" }}>
                    <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px", fontFamily: "monospace", padding: "14px 16px", margin: 0, overflowX: "auto", lineHeight: 1.6 }}>{`from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)`}</pre>
                    <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                      <CopyButton text={`from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}/v1",\n    api_key="your-proxy-api-key",\n)\n\nresponse = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Hello!"}],\n)`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ 删除记录 TAB ══════════════ */}
            {nodeTab === "deletions" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <p style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 600, margin: 0 }}>
                    删除记录（共 {deletionLog.length} 条）
                  </p>
                  {deletionLog.length > 0 && (
                    <button onClick={() => void clearDeletionLogFn()}
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "5px", color: "#f87171", cursor: "pointer", fontSize: "11px", padding: "4px 12px" }}>
                      清空记录
                    </button>
                  )}
                </div>
                {deletionLog.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: "28px", margin: "0 0 8px" }}>🗑️</p>
                    <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>暂无删除记录</p>
                    <p style={{ color: "#334155", fontSize: "11px", margin: "6px 0 0" }}>删除节点后记录将在这里保存</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {deletionLog.map(r => (
                      <div key={r.id} style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>{r.name}</span>
                          <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "4px", color: "#f87171", fontSize: "10px", padding: "2px 6px" }}>
                            {DELETION_REASON_LABELS[r.reason]}
                          </span>
                          <span style={{ marginLeft: "auto", color: "#475569", fontSize: "11px" }}>
                            {new Date(r.deletedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <code style={{ color: "#7dd3fc", fontSize: "11px", display: "block", wordBreak: "break-all", marginBottom: r.errorMsg ? "4px" : 0 }}>{r.url}</code>
                        {r.errorMsg && <p style={{ color: "#94a3b8", fontSize: "11px", margin: "4px 0 0" }}>{r.errorMsg}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ 设置 TAB ══════════════ */}
            {nodeTab === "settings" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* ── 节点健康 ─────────────────────────────────────── */}
                <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px" }}>
                  <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>🏥 节点健康</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px" }}>心跳检测间隔（秒）</p>
                      <input type="number" min={10} max={3600} value={Math.round(settingsForm.healthIntervalMs / 1000)}
                        onChange={(e) => setSettingsForm(f => ({ ...f, healthIntervalMs: Number(e.target.value) * 1000 }))}
                        style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", boxSizing: "border-box" }} />
                      <p style={{ color: "#334155", fontSize: "10px", margin: "3px 0 0" }}>重启后生效</p>
                    </div>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px" }}>最大连续失败次数</p>
                      <input type="number" min={1} max={20} value={settingsForm.maxConsecutiveFailures}
                        onChange={(e) => setSettingsForm(f => ({ ...f, maxConsecutiveFailures: Number(e.target.value) }))}
                        style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px" }}>请求超时（秒）</p>
                      <input type="number" min={5} max={600} value={Math.round(settingsForm.requestTimeoutMs / 1000)}
                        onChange={(e) => setSettingsForm(f => ({ ...f, requestTimeoutMs: Number(e.target.value) * 1000 }))}
                        style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 8px" }}>失败自动重试</p>
                      <button onClick={() => setSettingsForm(f => ({ ...f, retryOnError: !f.retryOnError }))}
                        style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                        <div style={{ width: "36px", height: "20px", borderRadius: "10px", background: settingsForm.retryOnError ? "#3b82f6" : "#334155", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", left: settingsForm.retryOnError ? "19px" : "3px", transition: "left 0.2s" }} />
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>{settingsForm.retryOnError ? "已启用" : "已禁用"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── 响应缓存 ─────────────────────────────────────── */}
                <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px" }}>
                  <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>💾 响应缓存</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 8px" }}>缓存功能</p>
                      <button onClick={() => setSettingsForm(f => ({ ...f, cacheEnabled: !f.cacheEnabled }))}
                        style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                        <div style={{ width: "36px", height: "20px", borderRadius: "10px", background: settingsForm.cacheEnabled ? "#3b82f6" : "#334155", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", left: settingsForm.cacheEnabled ? "19px" : "3px", transition: "left 0.2s" }} />
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>{settingsForm.cacheEnabled ? "已启用" : "已禁用"}</span>
                      </button>
                    </div>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px" }}>缓存有效期（分钟）</p>
                      <input type="number" min={1} max={10080} value={Math.round(settingsForm.cacheTtlMs / 60_000)}
                        onChange={(e) => setSettingsForm(f => ({ ...f, cacheTtlMs: Number(e.target.value) * 60_000 }))}
                        style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>
                </div>

                {/* ── 请求限流 ─────────────────────────────────────── */}
                <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px" }}>
                  <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>🚦 请求限流</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 8px" }}>限流功能</p>
                      <button onClick={() => setSettingsForm(f => ({ ...f, rateLimitEnabled: !f.rateLimitEnabled }))}
                        style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                        <div style={{ width: "36px", height: "20px", borderRadius: "10px", background: settingsForm.rateLimitEnabled ? "#3b82f6" : "#334155", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", left: settingsForm.rateLimitEnabled ? "19px" : "3px", transition: "left 0.2s" }} />
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>{settingsForm.rateLimitEnabled ? "已启用" : "已禁用"}</span>
                      </button>
                    </div>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: "0 0 4px" }}>每 IP 每分钟请求限制</p>
                      <input type="number" min={1} max={1000} value={settingsForm.rateLimitPerMinute}
                        onChange={(e) => setSettingsForm(f => ({ ...f, rateLimitPerMinute: Number(e.target.value) }))}
                        style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>
                </div>

                {/* ── 保存 ─────────────────────────────────────── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <p style={{ color: "#334155", fontSize: "11px", margin: 0 }}>心跳间隔变更需要重启服务后生效</p>
                  <button onClick={() => void saveSettingsFn()} disabled={settingsSaving}
                    style={{ background: settingsSaving ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.85)", border: "none", borderRadius: "7px", color: "white", cursor: settingsSaving ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, padding: "8px 20px", flexShrink: 0 }}>
                    {settingsSaving ? "保存中…" : "保存设置"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </Card>

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

              <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <p style={{ color: "#334155", fontSize: "11px", margin: 0 }}>
                  ⚠️ 统计数据为本次进程内追踪，服务重启后归零。每 15 秒自动刷新。
                </p>
                {cacheSize !== null && (
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px", background: cacheSize > 0 ? "rgba(99,102,241,0.12)" : "rgba(0,0,0,0.15)", border: `1px solid ${cacheSize > 0 ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: "6px", padding: "3px 10px" }}>
                    <span style={{ fontSize: "13px" }}>💾</span>
                    <span style={{ color: cacheSize > 0 ? "#a5b4fc" : "#475569", fontSize: "11px", fontWeight: 600 }}>
                      响应缓存 {cacheSize} 条
                    </span>
                    <span style={{ color: "#334155", fontSize: "11px" }}>· TTL 60min · 最多 20 req/min/IP</span>
                  </span>
                )}
              </div>
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
