import { useEffect, useState, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   Design tokens
───────────────────────────────────────────────────────────────────────────── */
const C = {
  blue:        "#2563eb",
  blueHover:   "#1d4ed8",
  blueLight:   "#dbeafe",
  bluePale:    "#eff6ff",
  bg:          "#f1f5f9",
  card:        "#ffffff",
  border:      "#e2e8f0",
  borderStrong:"#cbd5e1",
  text:        "#1e293b",
  text2:       "#475569",
  text3:       "#94a3b8",
  shadow:      "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
  shadowSm:    "0 1px 2px rgba(0,0,0,0.06)",
};

/* ─────────────────────────────────────────────────────────────────────────────
   Model data
───────────────────────────────────────────────────────────────────────────── */
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
  "o3":                   { input: 10.0,  output: 40.0  },
  "o3-mini":              { input: 1.10,  output: 4.40  },
  "o4-mini":              { input: 1.10,  output: 4.40  },
  "claude-opus-4-7":          { input: 15.0,  output: 75.0  },
  "claude-opus-4-5":          { input: 15.0,  output: 75.0  },
  "claude-sonnet-4-6":        { input: 3.0,   output: 15.0  },
  "claude-haiku-4-5":         { input: 0.80,  output: 4.0   },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Interfaces
───────────────────────────────────────────────────────────────────────────── */
interface ModelStats {
  requests: number; inputTokens: number; outputTokens: number;
  errors: number; lastUsedAt: number | null;
}
interface UsageData {
  startedAt: number; uptimeMs: number; totalRequests: number;
  totalInputTokens: number; totalOutputTokens: number; totalTokens: number;
  totalErrors: number; byModel: Record<string, ModelStats>;
}
interface ProviderStatus { available: boolean; error: string | null; code: string | null; }
interface QuotaStatus { openai: ProviderStatus; anthropic: ProviderStatus; checkedAt: number; }
type NodeStatus = "online" | "offline" | "quota_exceeded" | "monthly_limit" | "banned";

interface UpstreamInfo {
  id: string; name: string; url: string; apiKey: string; enabled: boolean;
  status: NodeStatus; weight: number; createdAt: number; lastSeenAt: number | null;
  lastErrorAt: number | null; lastErrorMsg: string | null;
  consecutiveFailures: number; totalRequests: number; totalErrors: number;
}
interface UpstreamTestResult { ok: boolean; ms?: number; error?: string; testing?: boolean; }
interface DeletionRecord {
  id: string; nodeId: string; name: string; url: string;
  reason: "manual" | "quota_exceeded" | "monthly_limit" | "consecutive_errors" | "auth_failure";
  deletedAt: number; errorMsg?: string;
}
interface AppSettings {
  maxConsecutiveFailures: number; healthIntervalMs: number;
  cacheEnabled: boolean; cacheTtlMs: number;
  rateLimitEnabled: boolean; rateLimitPerMinute: number;
  retryOnError: boolean; requestTimeoutMs: number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────────────── */
const DEFAULT_SETTINGS: AppSettings = {
  maxConsecutiveFailures: 3, healthIntervalMs: 60_000,
  cacheEnabled: true, cacheTtlMs: 3_600_000,
  rateLimitEnabled: true, rateLimitPerMinute: 20,
  retryOnError: true, requestTimeoutMs: 120_000,
};

const DELETION_REASON_LABELS: Record<DeletionRecord["reason"], string> = {
  manual: "手动删除", quota_exceeded: "429 配额超限",
  monthly_limit: "403 月度限制", consecutive_errors: "连续错误下线", auth_failure: "认证失败",
};

const STATUS_CFG: Record<NodeStatus, { label: string; dot: string; bg: string; border: string; color: string }> = {
  online:         { label: "在线",    dot: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
  offline:        { label: "离线",    dot: "#ef4444", bg: "#fef2f2", border: "#fecaca", color: "#dc2626" },
  quota_exceeded: { label: "429超限", dot: "#f59e0b", bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
  monthly_limit:  { label: "403月限", dot: "#f97316", bg: "#fff7ed", border: "#fed7aa", color: "#ea580c" },
  banned:         { label: "已封禁",  dot: "#94a3b8", bg: "#f8fafc", border: "#cbd5e1", color: "#64748b" },
};

const TABS: Array<["nodes" | "cluster" | "deletions" | "deploy" | "settings", string, string]> = [
  ["nodes",     "🖥",  "节点管理"],
  ["cluster",   "🌐",  "集群"],
  ["deletions", "🗑",  "删除记录"],
  ["deploy",    "🚀",  "部署代码"],
  ["settings",  "⚙",  "设置"],
];

/* ─────────────────────────────────────────────────────────────────────────────
   Helper functions
───────────────────────────────────────────────────────────────────────────── */
function calcCost(modelId: string, inp: number, out: number) {
  const p = MODEL_PRICING[modelId]; if (!p) return 0;
  return (inp / 1_000_000) * p.input + (out / 1_000_000) * p.output;
}
function calcTotalCost(byModel: Record<string, ModelStats>) {
  return Object.entries(byModel).reduce((s, [id, m]) => s + calcCost(id, m.inputTokens, m.outputTokens), 0);
}
function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`; if (m > 0) return `${m}m ${s % 60}s`; return `${s}s`;
}
function timeAgo(ts: number | null) {
  if (!ts) return "从未";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  return `${Math.floor(m / 60)}小时前`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Reusable UI components (light-theme)
───────────────────────────────────────────────────────────────────────────── */
function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      style={{ background: copied ? "#dcfce7" : C.bluePale, border: `1px solid ${copied ? "#bbf7d0" : C.blueLight}`, borderRadius: "6px", color: copied ? "#16a34a" : C.blue, cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "4px 12px", transition: "all 0.15s", whiteSpace: "nowrap" }}>
      {copied ? "✓ 已复制" : label}
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "38px", height: "22px", borderRadius: "11px", background: value ? C.blue : "#cbd5e1", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", left: value ? "19px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
      </div>
      <span style={{ color: value ? C.blue : C.text3, fontSize: "12px", fontWeight: 500 }}>{value ? "已启用" : "已禁用"}</span>
    </button>
  );
}

function LightCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", boxShadow: C.shadow, ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
      <div style={{ width: "4px", height: "18px", background: C.blue, borderRadius: "2px", flexShrink: 0 }} />
      <span style={{ color: C.text, fontSize: "14px", fontWeight: 700 }}>{children}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px", color: C.text2, display: "inline-flex", alignItems: "center", fontSize: "12px", padding: "4px 14px", boxShadow: C.shadowSm }}>
      {children}
    </span>
  );
}

function NumberInput({ label, value, min, max, note, onChange }: { label: string; value: number; min: number; max: number; note?: string; onChange: (n: number) => void }) {
  return (
    <div>
      <p style={{ color: C.text2, fontSize: "12px", margin: "0 0 5px", fontWeight: 500 }}>{label}</p>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "7px 10px", outline: "none", boxSizing: "border-box" }} />
      {note && <p style={{ color: C.text3, fontSize: "11px", margin: "4px 0 0" }}>{note}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main App
───────────────────────────────────────────────────────────────────────────── */
export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
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
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [bulkFormOpen, setBulkFormOpen] = useState(false);
  const baseUrl = window.location.origin;

  /* ── Fetchers ─────────────────────────────────────────────────────────── */
  const fetchUsage = useCallback(() => {
    fetch(`${baseUrl}/v1/usage`).then(r => r.json()).then((d: UsageData) => setUsageData(d)).catch(() => {});
  }, [baseUrl]);

  const fetchQuotaStatus = useCallback(() => {
    setQuotaChecking(true);
    fetch(`${baseUrl}/v1/quota-status`).then(r => r.json()).then((d: QuotaStatus) => { setQuotaStatus(d); setQuotaChecking(false); }).catch(() => setQuotaChecking(false));
  }, [baseUrl]);

  const fetchUpstreams = useCallback(() => {
    fetch(`${baseUrl}/api/upstreams`).then(r => r.json()).then((d: UpstreamInfo[]) => setUpstreams(d)).catch(() => {});
  }, [baseUrl]);

  const fetchCacheStats = useCallback(() => {
    fetch(`${baseUrl}/v1/cache-stats`).then(r => r.json()).then((d: { size: number }) => setCacheSize(d.size)).catch(() => {});
  }, [baseUrl]);

  const fetchDeletionLog = useCallback(() => {
    fetch(`${baseUrl}/api/deletion-log`).then(r => r.json()).then((d: DeletionRecord[]) => setDeletionLog(d)).catch(() => {});
  }, [baseUrl]);

  const fetchSettings = useCallback(() => {
    fetch(`${baseUrl}/api/settings`).then(r => r.json()).then((d: AppSettings) => { setSettings(d); setSettingsForm(d); }).catch(() => {});
  }, [baseUrl]);

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const addUpstream = async () => {
    if (!upstreamForm.name || !upstreamForm.url || !upstreamForm.apiKey) return;
    setUpstreamAdding(true);
    try {
      await fetch(`${baseUrl}/api/upstreams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upstreamForm) });
      setUpstreamForm({ name: "", url: "", apiKey: "", weight: 1 });
      setUpstreamFormOpen(false);
      fetchUpstreams();
    } finally { setUpstreamAdding(false); }
  };

  const toggleUpstream = async (id: string, enabled: boolean) => {
    await fetch(`${baseUrl}/api/upstreams/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    fetchUpstreams();
  };

  const deleteUpstream = async (id: string) => {
    await fetch(`${baseUrl}/api/upstreams/${id}`, { method: "DELETE" });
    setTestResults(p => { const n = { ...p }; delete n[id]; return n; });
    fetchUpstreams();
    fetchDeletionLog();
  };

  const testUpstream = async (id: string) => {
    setTestResults(p => ({ ...p, [id]: { ok: false, testing: true } }));
    const r = await fetch(`${baseUrl}/api/upstreams/${id}/test`, { method: "POST" });
    const d = (await r.json()) as UpstreamTestResult;
    setTestResults(p => ({ ...p, [id]: { ...d, testing: false } }));
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
      const r = await fetch(`${baseUrl}/api/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settingsForm) });
      const d = (await r.json()) as AppSettings;
      setSettings(d); setSettingsForm(d);
    } finally { setSettingsSaving(false); }
  };

  const startEditNode = (u: UpstreamInfo) => {
    setEditingNode(u.id);
    setEditForm({ name: u.name, url: u.url, apiKey: "", weight: u.weight ?? 1 });
  };

  const saveEditNode = async (id: string) => {
    await fetch(`${baseUrl}/api/upstreams/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
    setEditingNode(null);
    fetchUpstreams();
  };

  const bulkImport = async () => {
    const lines = bulkText.split("\n").filter(l => l.trim());
    if (lines.length === 0) return;
    setBulkImporting(true);
    setBulkResult(null);
    try {
      const r = await fetch(`${baseUrl}/api/upstreams/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const d = await r.json() as { imported: number; skipped: number; errors: string[] };
      setBulkResult(d);
      if (d.imported > 0) { setBulkText(""); fetchUpstreams(); }
    } finally { setBulkImporting(false); }
  };

  useEffect(() => {
    fetch(`${baseUrl}/api/healthz`).then(r => setOnline(r.ok)).catch(() => setOnline(false));
    fetchUsage(); fetchQuotaStatus(); fetchUpstreams(); fetchCacheStats(); fetchDeletionLog(); fetchSettings();
    const iv = setInterval(() => { fetchUsage(); fetchCacheStats(); fetchUpstreams(); }, 15000);
    const qv = setInterval(fetchQuotaStatus, 60000);
    return () => { clearInterval(iv); clearInterval(qv); };
  }, [baseUrl, fetchUsage, fetchQuotaStatus, fetchUpstreams, fetchCacheStats, fetchDeletionLog, fetchSettings]);

  /* ── Derived ──────────────────────────────────────────────────────────── */
  const activeModels = usageData
    ? Object.entries(usageData.byModel).filter(([, s]) => s.requests > 0).sort((a, b) => b[1].requests - a[1].requests)
    : [];
  const totalRequests = upstreams.reduce((s, u) => s + u.totalRequests, 0);
  const totalTokens = usageData?.totalTokens ?? 0;
  const enabledCount = upstreams.filter(u => u.enabled).length;
  const onlineCount  = upstreams.filter(u => u.status === "online").length;
  const expandedUpstream = upstreams.find(u => u.id === expandedNode) ?? null;
  const hasOffline = upstreams.some(u => u.status !== "online" && u.enabled);
  const autoDisabledNodes = upstreams.filter(u => u.enabled && u.status === "offline" && u.consecutiveFailures > 0);
  const warningNodes = upstreams.filter(u => u.status === "online" && u.consecutiveFailures > 0);

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif", color: C.text }}>

      {/* ══════════════ TOP NAVIGATION ══════════════ */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, boxShadow: C.shadowSm, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", height: "58px", gap: "16px" }}>

            {/* Logo + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <div style={{ background: C.blue, borderRadius: "10px", color: "white", fontSize: "18px", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚡</div>
              <div>
                <p style={{ color: C.text, fontSize: "14px", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>中心代理调度系统</p>
                <p style={{ color: C.text3, fontSize: "11px", margin: 0 }}>OpenAI 兼容 API 网关</p>
              </div>
            </div>

            {/* Breadcrumb */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: C.text3, overflow: "hidden" }}>
              <span style={{ flexShrink: 0 }}>→</span>
              <span style={{ color: C.blue, fontWeight: 500, flexShrink: 0 }}>Dashboard</span>
              <span style={{ flexShrink: 0 }}>→</span>
              <span style={{ flexShrink: 0 }}>节点自动注册</span>
              <span style={{ flexShrink: 0 }}>→</span>
              <span style={{ flexShrink: 0 }}>自动保护机制</span>
              <span style={{ flexShrink: 0 }}>→</span>
              <span style={{ flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>集群调度</span>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", background: online ? "#f0fdf4" : "#fef2f2", border: `1px solid ${online ? "#bbf7d0" : "#fecaca"}`, borderRadius: "20px", padding: "4px 12px", fontSize: "12px", color: online ? "#16a34a" : "#dc2626" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: online ? "#22c55e" : "#ef4444", display: "inline-block" }} />
                {online === null ? "检测中" : online ? "运行中" : "离线"}
              </div>
              <span style={{ background: C.bluePale, border: `1px solid ${C.blueLight}`, borderRadius: "6px", color: C.blue, fontSize: "11px", fontWeight: 600, padding: "3px 10px" }}>管理员</span>
              <button style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text2, cursor: "pointer", fontSize: "12px", padding: "5px 14px" }}>退出登录</button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px 48px" }}>

        {/* ── Quota banner ──────────────────────────────────────────────── */}
        {quotaStatus && (
          <LightCard style={{ padding: "12px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px" }}>
              {quotaStatus.openai.available && quotaStatus.anthropic.available ? "✅" : "⚠️"}
            </span>
            <span style={{ color: C.text, fontSize: "13px", fontWeight: 600 }}>
              {quotaStatus.openai.available && quotaStatus.anthropic.available ? "配额正常 — API 可用" : "部分 API 不可用"}
            </span>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {([["OpenAI", quotaStatus.openai], ["Anthropic", quotaStatus.anthropic]] as const).map(([name, s]) => (
                <span key={name} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: s.available ? "#16a34a" : "#dc2626" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.available ? "#22c55e" : "#ef4444", display: "inline-block" }} />
                  {name} {s.available ? "可用" : "不可用"}
                </span>
              ))}
            </div>
            <span style={{ color: C.text3, fontSize: "11px", marginLeft: "auto" }}>
              {new Date(quotaStatus.checkedAt).toLocaleTimeString("zh-CN")} 检测
            </span>
            <button onClick={() => { setQuotaChecking(true); fetchQuotaStatus(); }}
              disabled={quotaChecking}
              style={{ background: C.bluePale, border: `1px solid ${C.blueLight}`, borderRadius: "6px", color: C.blue, cursor: quotaChecking ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, padding: "4px 12px", opacity: quotaChecking ? 0.6 : 1 }}>
              {quotaChecking ? "检测中…" : "重新检测"}
            </button>
            <a href="https://replit.com/account" target="_blank" rel="noreferrer"
              style={{ background: C.blueLight, border: `1px solid ${C.blueLight}`, borderRadius: "6px", color: C.blue, fontSize: "12px", fontWeight: 600, padding: "4px 12px", textDecoration: "none" }}>
              🔗 Replit 积分 / 升级
            </a>
          </LightCard>
        )}

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <LightCard style={{ padding: "6px", display: "flex", gap: "4px", marginBottom: "20px" }}>
          {TABS.map(([id, icon, label]) => (
            <button key={id} onClick={() => setNodeTab(id)} style={{
              flex: 1, background: nodeTab === id ? C.blue : "transparent",
              border: "none", borderRadius: "8px",
              color: nodeTab === id ? "white" : C.text2,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              gap: "6px", fontSize: "13px", fontWeight: nodeTab === id ? 600 : 400,
              padding: "8px 6px", transition: "all 0.15s", position: "relative",
              whiteSpace: "nowrap",
            }}>
              <span style={{ fontSize: "15px" }}>{icon}</span>
              <span>{label}</span>
              {id === "deletions" && deletionLog.length > 0 && (
                <span style={{ background: "#ef4444", borderRadius: "10px", color: "white", fontSize: "10px", fontWeight: 700, lineHeight: 1, padding: "2px 6px", position: "absolute", top: "4px", right: "4px" }}>{deletionLog.length}</span>
              )}
            </button>
          ))}
        </LightCard>

        {/* ════════════════ 节点管理 TAB ════════════════ */}
        {nodeTab === "nodes" && <>

          {/* Top row: 接入端点 + 注册密钥 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

            {/* 接入端点 */}
            <LightCard style={{ padding: "16px 20px", borderTop: `3px solid ${C.blue}` }}>
              <p style={{ color: C.text2, fontSize: "11px", fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>🔗 接入端点 (BASE URL)</p>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px" }}>
                <code style={{ flex: 1, color: C.blue, fontSize: "13px", fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all" }}>{baseUrl}/v1</code>
                <CopyButton text={`${baseUrl}/v1`} />
              </div>
              <p style={{ color: C.text3, fontSize: "11px", margin: "8px 0 0" }}>将此 URL 设为客户端的 base_url</p>
            </LightCard>

            {/* 注册密钥 */}
            <LightCard style={{ padding: "16px 20px", borderTop: `3px solid ${C.blue}` }}>
              <p style={{ color: C.text2, fontSize: "11px", fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>🔑 注册密钥 (API KEY)</p>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px" }}>
                <code style={{ flex: 1, color: C.text2, fontSize: "13px", fontFamily: "monospace", letterSpacing: "0.1em" }}>••••••••••••••••</code>
                <CopyButton text="请在 Secrets 中查看 PROXY_API_KEY" label="已设置" />
              </div>
              <p style={{ color: C.text3, fontSize: "11px", margin: "8px 0 0" }}>在 Replit Secrets 中设置 PROXY_API_KEY</p>
            </LightCard>
          </div>

          {/* 自动保护机制 */}
          <LightCard style={{ padding: "18px 22px", marginBottom: "20px" }}>
            <SectionHeader>🛡 自动保护机制</SectionHeader>
            <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
              <ul style={{ margin: 0, padding: "0 0 0 18px", flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 24px" }}>
                {[
                  "额度耗尽 → 自动**删除**节点",
                  "认证失败 → 自动**禁用**节点（保留数据）",
                  "速率限制(429) → 按临时错误计算（不删除）",
                  `连续 ${settings?.maxConsecutiveFailures ?? 3} 次通用错误 → 自动**禁用**`,
                  "心跳超时 → 自动**禁用**",
                  "HTML/非JSON响应 → 自动**禁用**（临时重启）",
                  "请求失败自动切换下一个节点",
                  "恢复在线后自动解除离线状态",
                ].map((rule, i) => {
                  const parts = rule.split(/\*\*(.*?)\*\*/g);
                  return (
                    <li key={i} style={{ color: C.text2, fontSize: "13px", lineHeight: 1.6 }}>
                      {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: C.blue, fontWeight: 700 }}>{p}</strong> : p)}
                    </li>
                  );
                })}
              </ul>
              {/* Decorative panel */}
              <div style={{ background: C.bluePale, border: `1px solid ${C.blueLight}`, borderRadius: "10px", padding: "14px 16px", minWidth: "140px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "32px", marginBottom: "6px" }}>🛡️</div>
                <p style={{ color: C.blue, fontSize: "12px", fontWeight: 700, margin: "0 0 4px" }}>自动防护</p>
                <p style={{ color: C.text3, fontSize: "11px", margin: 0 }}>7×24 监控<br />智能调度</p>
              </div>
            </div>
          </LightCard>

          {/* Auto-rotation alert banners */}
          {autoDisabledNodes.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>🔄</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#dc2626", fontSize: "13px", fontWeight: 700, margin: "0 0 4px" }}>自动轮换已触发 — {autoDisabledNodes.length} 个节点因连续错误被自动下线</p>
                <p style={{ color: "#b91c1c", fontSize: "12px", margin: "0 0 8px" }}>以下节点连续失败次数已达上限（{settings?.maxConsecutiveFailures ?? 3} 次），已被系统自动停用，流量已无缝切换至健康节点。</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {autoDisabledNodes.map(n => (
                    <span key={n.id} style={{ background: "white", border: "1px solid #fecaca", borderRadius: "5px", color: "#dc2626", fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>
                      {n.name} ({n.consecutiveFailures} 次)
                    </span>
                  ))}
                </div>
                <button onClick={() => void wakeAll()} style={{ background: "white", border: "1px solid #fecaca", borderRadius: "6px", color: "#dc2626", cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "4px 12px" }}>⚡ 一键恢复全部</button>
              </div>
            </div>
          )}
          {warningNodes.length > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px 16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <p style={{ color: "#92400e", fontSize: "12px", margin: 0, flex: 1 }}>
                <strong>{warningNodes.length}</strong> 个在线节点存在连续失败记录，尚未触发自动停用阈值（{settings?.maxConsecutiveFailures ?? 3} 次）。调度器将持续监控。
              </p>
            </div>
          )}

          {/* 节点列表 header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <SectionHeader>📋 节点列表</SectionHeader>
            <div style={{ display: "flex", gap: "8px" }}>
              {hasOffline && (
                <button onClick={() => void wakeAll()}
                  style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", color: "#d97706", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: "7px 16px" }}>
                  ⚡ 唤醒全部
                </button>
              )}
              <button
                onClick={() => { setBulkFormOpen(v => !v); if (bulkFormOpen) { setBulkResult(null); } setUpstreamFormOpen(false); }}
                style={{ background: bulkFormOpen ? "#0f766e" : "#0d9488", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: "7px 16px" }}>
                {bulkFormOpen ? "✕ 关闭" : "📥 批量导入"}
              </button>
              <button onClick={() => { setUpstreamFormOpen(v => !v); if (upstreamFormOpen) setExpandedNode(null); setBulkFormOpen(false); }}
                style={{ background: upstreamFormOpen ? C.blueHover : C.blue, border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: "7px 18px" }}>
                {upstreamFormOpen ? "✕ 取消" : "+ 手动添加"}
              </button>
            </div>
          </div>

          {/* Stats chips */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
            <Chip>共 <strong style={{ color: C.text, marginLeft: "4px" }}>{upstreams.length}</strong>&nbsp;个节点，<strong style={{ color: C.text }}>{enabledCount}</strong>&nbsp;启用</Chip>
            <Chip>总请求 <strong style={{ color: C.blue, marginLeft: "4px" }}>{totalRequests.toLocaleString()}</strong></Chip>
            <Chip>总 Token <strong style={{ color: C.blue, marginLeft: "4px" }}>{formatTokens(totalTokens)}</strong></Chip>
            {cacheSize !== null && <Chip>缓存 <strong style={{ color: C.blue, marginLeft: "4px" }}>{cacheSize}</strong>&nbsp;条</Chip>}
          </div>

          {/* Node grid card */}
          <LightCard style={{ overflow: "hidden" }}>

            {/* Bulk import panel */}
            {bulkFormOpen && (
              <div style={{ background: "#f0fdfa", borderBottom: `1px solid #99f6e4`, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ color: "#0f766e", fontSize: "14px", fontWeight: 700 }}>📥 批量节点导入</span>
                  <span style={{ background: "#ccfbf1", border: "1px solid #99f6e4", borderRadius: "5px", color: "#0f766e", fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>每行一个</span>
                </div>
                <p style={{ color: "#134e4a", fontSize: "12px", margin: "0 0 10px", lineHeight: 1.6 }}>
                  每行粘贴一个节点，支持两种格式：<br />
                  <code style={{ background: "white", border: "1px solid #99f6e4", borderRadius: "4px", padding: "1px 6px", fontFamily: "monospace", fontSize: "12px" }}>https://xxx.replit.app----your-api-key</code>
                  　或　
                  <code style={{ background: "white", border: "1px solid #99f6e4", borderRadius: "4px", padding: "1px 6px", fontFamily: "monospace", fontSize: "12px" }}>https://xxx.replit.app----your-api-key----节点名称</code>
                </p>
                <textarea
                  value={bulkText}
                  onChange={e => { setBulkText(e.target.value); setBulkResult(null); }}
                  placeholder={"https://proxy-01.replit.app----sk-abc123\nhttps://proxy-02.replit.app----sk-def456----我的节点02\nhttps://proxy-03.replit.app----sk-ghi789"}
                  rows={6}
                  style={{ width: "100%", background: "white", border: "1px solid #99f6e4", borderRadius: "8px", boxSizing: "border-box", color: "#134e4a", fontFamily: "monospace", fontSize: "12px", lineHeight: 1.7, outline: "none", padding: "10px 12px", resize: "vertical" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => void bulkImport()}
                    disabled={bulkImporting || !bulkText.trim()}
                    style={{ background: bulkImporting || !bulkText.trim() ? "#99f6e4" : "#0d9488", border: "none", borderRadius: "7px", color: "white", cursor: bulkImporting || !bulkText.trim() ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, padding: "9px 22px" }}>
                    {bulkImporting ? "导入中…" : `🚀 导入节点`}
                  </button>
                  {bulkText.trim() && (
                    <span style={{ color: "#0f766e", fontSize: "12px" }}>
                      已输入 {bulkText.split("\n").filter(l => l.trim()).length} 行
                    </span>
                  )}
                  {bulkResult && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ background: bulkResult.imported > 0 ? "#dcfce7" : "#f1f5f9", border: `1px solid ${bulkResult.imported > 0 ? "#bbf7d0" : C.border}`, borderRadius: "5px", color: bulkResult.imported > 0 ? "#16a34a" : C.text2, fontSize: "12px", fontWeight: 600, padding: "3px 10px" }}>
                        ✓ 成功导入 {bulkResult.imported} 个
                      </span>
                      {bulkResult.skipped > 0 && (
                        <span style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "5px", color: "#92400e", fontSize: "12px", fontWeight: 600, padding: "3px 10px" }}>
                          ⊘ 跳过 {bulkResult.skipped} 个重复
                        </span>
                      )}
                      {bulkResult.errors.length > 0 && (
                        <span style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "5px", color: "#dc2626", fontSize: "12px", fontWeight: 600, padding: "3px 10px" }}>
                          ✗ {bulkResult.errors.length} 行错误
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {bulkResult && bulkResult.errors.length > 0 && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", marginTop: "10px", padding: "10px 14px" }}>
                    <p style={{ color: "#dc2626", fontSize: "12px", fontWeight: 700, margin: "0 0 6px" }}>错误详情：</p>
                    {bulkResult.errors.map((e, i) => (
                      <p key={i} style={{ color: "#b91c1c", fontSize: "11px", fontFamily: "monospace", margin: "2px 0" }}>• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add form */}
            {upstreamFormOpen && (
              <div style={{ background: C.bluePale, borderBottom: `1px solid ${C.blueLight}`, padding: "18px 20px" }}>
                <p style={{ color: C.blue, fontSize: "13px", fontWeight: 700, margin: "0 0 12px" }}>+ 添加新节点</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input placeholder="节点名称（如 proxy-node-01）" value={upstreamForm.name}
                      onChange={e => setUpstreamForm(f => ({ ...f, name: e.target.value }))}
                      style={{ flex: "1 1 160px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "8px 12px", outline: "none" }} />
                    <input placeholder="部署地址（如 https://xxx.replit.app）" value={upstreamForm.url}
                      onChange={e => setUpstreamForm(f => ({ ...f, url: e.target.value }))}
                      style={{ flex: "2 1 260px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "8px 12px", outline: "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                    <input placeholder="API Key（PROXY_API_KEY）" value={upstreamForm.apiKey}
                      onChange={e => setUpstreamForm(f => ({ ...f, apiKey: e.target.value }))}
                      style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "8px 12px", outline: "none", fontFamily: "monospace" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ color: C.text3, fontSize: "11px", textAlign: "center" }}>权重</span>
                      <input type="number" min={1} max={10} value={upstreamForm.weight}
                        onChange={e => setUpstreamForm(f => ({ ...f, weight: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                        style={{ width: "60px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "8px 10px", outline: "none", textAlign: "center" }} />
                    </div>
                    <button onClick={() => void addUpstream()} disabled={upstreamAdding || !upstreamForm.name || !upstreamForm.url || !upstreamForm.apiKey}
                      style={{ background: upstreamAdding ? "#93c5fd" : C.blue, border: "none", borderRadius: "7px", color: "white", cursor: upstreamAdding ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, padding: "8px 22px", whiteSpace: "nowrap" }}>
                      {upstreamAdding ? "添加中…" : "确认添加"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Grid */}
            <div style={{ padding: "18px 20px" }}>
              {upstreams.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔗</div>
                  <p style={{ color: C.text2, fontSize: "14px", fontWeight: 600, margin: "0 0 6px" }}>暂无节点</p>
                  <p style={{ color: C.text3, fontSize: "12px", margin: 0 }}>注册其他 Replit 账号部署的代理地址后，请求将优先路由至节点池，全部失败时回退至本账号。</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                  {upstreams.map(u => {
                    const sc = STATUS_CFG[u.status];
                    const isSelected = expandedNode === u.id;
                    return (
                      <button key={u.id} onClick={() => { setExpandedNode(n => n === u.id ? null : u.id); setEditingNode(null); }}
                        style={{ background: isSelected ? C.bluePale : C.card, border: `1px solid ${isSelected ? C.blue : u.consecutiveFailures > 0 && u.status !== "offline" ? "#fde68a" : C.border}`, borderRadius: "9px", cursor: "pointer", padding: "10px 12px", textAlign: "left", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: "5px", boxShadow: isSelected ? `0 0 0 2px ${C.blueLight}` : C.shadowSm, position: "relative" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: sc.dot, flexShrink: 0, boxShadow: `0 0 0 2px ${sc.bg}` }} />
                          <span style={{ color: C.text, fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{u.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                          <span style={{ color: sc.color, fontSize: "10px" }}>{sc.label}</span>
                          {u.weight > 1 && <span style={{ background: C.blueLight, borderRadius: "4px", color: C.blue, fontSize: "9px", fontWeight: 700, padding: "1px 5px" }}>W{u.weight}</span>}
                          {!u.enabled && <span style={{ color: C.text3, fontSize: "10px" }}>禁用</span>}
                          {u.consecutiveFailures > 0 && u.status === "offline" && (
                            <span style={{ background: "#fef2f2", borderRadius: "4px", color: "#dc2626", fontSize: "9px", fontWeight: 700, padding: "1px 5px" }}>🔄 自动停用</span>
                          )}
                          {u.consecutiveFailures > 0 && u.status !== "offline" && (
                            <span style={{ background: "#fffbeb", borderRadius: "4px", color: "#d97706", fontSize: "9px", fontWeight: 700, padding: "1px 5px" }}>⚠ {u.consecutiveFailures}次</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {expandedUpstream ? (() => {
              const u = expandedUpstream;
              const tr = testResults[u.id];
              const sc = STATUS_CFG[u.status];
              const canWake = u.status !== "online" || !u.enabled;
              return (
                <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "18px 20px" }}>
                  {/* Node title row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", gap: "12px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                        <span style={{ color: C.text, fontSize: "15px", fontWeight: 700 }}>{u.name}</span>
                        <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: "5px", color: sc.color, fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>{sc.label}</span>
                        {!u.enabled && <span style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "5px", color: C.text3, fontSize: "11px", padding: "2px 8px" }}>已禁用</span>}
                        <span style={{ background: C.blueLight, border: `1px solid ${C.blueLight}`, borderRadius: "5px", color: C.blue, fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>权重 {u.weight ?? 1}</span>
                      </div>
                      <code style={{ color: C.text2, fontSize: "12px", fontFamily: "monospace" }}>{u.url}</code>
                    </div>
                    <button onClick={() => setExpandedNode(null)}
                      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "6px", color: C.text3, cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "2px 10px" }}>×</button>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                    {[
                      { label: "总请求",     val: u.totalRequests.toLocaleString() },
                      { label: "总错误",     val: u.totalErrors.toLocaleString(), accent: u.totalErrors > 0 },
                      { label: "连续失败",   val: u.consecutiveFailures.toLocaleString(), accent: u.consecutiveFailures > 0 },
                      { label: "最后在线",   val: timeAgo(u.lastSeenAt) },
                      { label: "最后错误",   val: timeAgo(u.lastErrorAt) },
                      { label: "添加时间",   val: new Date(u.createdAt).toLocaleDateString("zh-CN") },
                    ].map(({ label, val, accent }) => (
                      <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 14px" }}>
                        <p style={{ color: C.text3, fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                        <p style={{ color: accent ? "#dc2626" : C.text, fontSize: "15px", fontWeight: 700, margin: 0 }}>{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Test result */}
                  {tr && !tr.testing && (
                    <div style={{ background: tr.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${tr.ok ? "#bbf7d0" : "#fecaca"}`, borderRadius: "7px", padding: "8px 14px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: tr.ok ? "#16a34a" : "#dc2626", fontSize: "13px", fontWeight: 600 }}>
                        {tr.ok ? `✓ 连通性正常 ${tr.ms}ms` : `✗ 连通性失败`}
                      </span>
                      {tr.error && <span style={{ color: "#dc2626", fontSize: "12px" }}>{tr.error}</span>}
                    </div>
                  )}
                  {u.lastErrorMsg && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", padding: "8px 14px", marginBottom: "12px" }}>
                      <span style={{ color: "#dc2626", fontSize: "12px" }}>最后错误: {u.lastErrorMsg}</span>
                    </div>
                  )}

                  {/* Edit form */}
                  {editingNode === u.id && (
                    <div style={{ background: C.bluePale, border: `1px solid ${C.blueLight}`, borderRadius: "8px", padding: "14px 16px", marginBottom: "12px" }}>
                      <p style={{ color: C.blue, fontSize: "12px", fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>编辑节点</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input placeholder="节点名称" value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "7px 10px", outline: "none" }} />
                        <input placeholder="部署地址" value={editForm.url}
                          onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "7px 10px", outline: "none" }} />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input placeholder="新 API Key（留空保持不变）" value={editForm.apiKey}
                            onChange={e => setEditForm(f => ({ ...f, apiKey: e.target.value }))}
                            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "7px 10px", outline: "none", fontFamily: "monospace" }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{ color: C.text3, fontSize: "11px", textAlign: "center" }}>权重</span>
                            <input type="number" min={1} max={10} value={editForm.weight}
                              onChange={e => setEditForm(f => ({ ...f, weight: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                              style={{ width: "60px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text, fontSize: "13px", padding: "7px 10px", outline: "none", textAlign: "center" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => void saveEditNode(u.id)}
                            style={{ background: C.blue, border: "none", borderRadius: "7px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: "7px 18px" }}>保存</button>
                          <button onClick={() => setEditingNode(null)}
                            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "7px", color: C.text2, cursor: "pointer", fontSize: "13px", padding: "7px 18px" }}>取消</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={() => void testUpstream(u.id)} disabled={tr?.testing}
                      style={{ background: C.bluePale, border: `1px solid ${C.blueLight}`, borderRadius: "7px", color: C.blue, cursor: tr?.testing ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, padding: "6px 14px", opacity: tr?.testing ? 0.6 : 1 }}>
                      {tr?.testing ? "检测中…" : "🔍 测试连通"}
                    </button>
                    <button onClick={() => editingNode === u.id ? setEditingNode(null) : startEditNode(u)}
                      style={{ background: "#eff0fe", border: "1px solid #c7d2fe", borderRadius: "7px", color: "#4f46e5", cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "6px 14px" }}>
                      ✏️ {editingNode === u.id ? "收起编辑" : "编辑"}
                    </button>
                    {canWake && (
                      <button onClick={() => { void wakeUpstreamNode(u.id); setExpandedNode(null); }}
                        style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "7px", color: "#d97706", cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "6px 14px" }}>
                        ⚡ 唤醒节点
                      </button>
                    )}
                    <button onClick={() => toggleUpstream(u.id, !u.enabled)}
                      style={{ background: u.enabled ? "#f0fdf4" : C.bg, border: `1px solid ${u.enabled ? "#bbf7d0" : C.border}`, borderRadius: "7px", color: u.enabled ? "#16a34a" : C.text2, cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "6px 14px" }}>
                      {u.enabled ? "⏸ 禁用" : "▶ 启用"}
                    </button>
                    <button onClick={() => { void deleteUpstream(u.id); setExpandedNode(null); }}
                      style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", color: "#dc2626", cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "6px 14px", marginLeft: "auto" }}>
                      🗑 删除节点
                    </button>
                  </div>
                </div>
              );
            })() : (
              upstreams.length > 0 && (
                <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "14px 20px" }}>
                  <p style={{ color: C.text3, fontSize: "13px", margin: 0, textAlign: "center" }}>点击上面的节点小格查看详情和操作。</p>
                </div>
              )
            )}
          </LightCard>
        </>}

        {/* ════════════════ 集群 TAB ════════════════ */}
        {nodeTab === "cluster" && (() => {
          const groups = [
            { label: "🟢 在线节点", status: "online" as NodeStatus, nodes: upstreams.filter(u => u.status === "online") },
            { label: "🟡 限额超限", status: "quota_exceeded" as NodeStatus, nodes: upstreams.filter(u => u.status === "quota_exceeded") },
            { label: "🟠 月度限制", status: "monthly_limit" as NodeStatus, nodes: upstreams.filter(u => u.status === "monthly_limit") },
            { label: "🔴 离线节点", status: "offline" as NodeStatus, nodes: upstreams.filter(u => u.status === "offline") },
            { label: "⚫ 已封禁",   status: "banned" as NodeStatus,  nodes: upstreams.filter(u => u.status === "banned") },
          ].filter(g => g.nodes.length > 0);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                {[
                  { label: "总节点", val: upstreams.length, color: C.text },
                  { label: "在线",   val: onlineCount,      color: "#16a34a" },
                  { label: "已启用", val: enabledCount,     color: C.blue },
                  { label: "离线",   val: upstreams.length - onlineCount, color: "#dc2626" },
                ].map(({ label, val, color }) => (
                  <LightCard key={label} style={{ padding: "14px 18px", textAlign: "center" }}>
                    <p style={{ color: C.text3, fontSize: "11px", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                    <p style={{ color, fontSize: "28px", fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>{val}</p>
                  </LightCard>
                ))}
              </div>

              {/* Status groups */}
              {groups.length === 0 ? (
                <LightCard style={{ padding: "40px", textAlign: "center" }}>
                  <p style={{ fontSize: "32px", margin: "0 0 8px" }}>📭</p>
                  <p style={{ color: C.text2, fontSize: "14px", margin: 0 }}>暂无节点数据</p>
                </LightCard>
              ) : groups.map(g => {
                const sc = STATUS_CFG[g.status];
                return (
                  <LightCard key={g.label} style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <span style={{ color: sc.color, fontSize: "14px", fontWeight: 700 }}>{g.label}</span>
                      <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: "6px", color: sc.color, fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>{g.nodes.length} 节点</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {g.nodes.map(n => (
                        <div key={n.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "7px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: C.text, fontSize: "13px", fontWeight: 500 }}>{n.name}</span>
                          <span style={{ background: C.blueLight, borderRadius: "4px", color: C.blue, fontSize: "10px", fontWeight: 700, padding: "1px 5px" }}>W{n.weight ?? 1}</span>
                          <span style={{ color: C.text3, fontSize: "11px" }}>{n.totalRequests} 次</span>
                        </div>
                      ))}
                    </div>
                  </LightCard>
                );
              })}

              {/* Rules panel */}
              <LightCard style={{ padding: "16px 20px" }}>
                <SectionHeader>⚖️ 规则管理</SectionHeader>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "8px" }}>
                  {[
                    { icon: "⚖️", label: "路由策略",     value: "加权轮询" },
                    { icon: "💓", label: "心跳检测",     value: `每 ${settings ? Math.round(settings.healthIntervalMs / 1000) : 60}s` },
                    { icon: "🔄", label: "故障自动转移", value: "已启用" },
                    { icon: "❌", label: "最大连续失败", value: `${settings?.maxConsecutiveFailures ?? 3} 次` },
                    { icon: "💾", label: "响应缓存",     value: settings?.cacheEnabled ? `${Math.round((settings.cacheTtlMs ?? 3_600_000) / 60_000)}min TTL` : "已禁用" },
                    { icon: "🚦", label: "IP 限流",      value: settings?.rateLimitEnabled ? `${settings.rateLimitPerMinute ?? 20} 次/分钟` : "已禁用" },
                    { icon: "🔁", label: "失败重试",     value: settings?.retryOnError !== false ? "已启用" : "已禁用" },
                    { icon: "⏱️", label: "请求超时",     value: `${Math.round((settings?.requestTimeoutMs ?? 120_000) / 1000)}s` },
                  ].map(({ icon, label, value }) => (
                    <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "7px", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: C.text2, fontSize: "12px" }}>{icon} {label}</span>
                      <span style={{ color: C.blue, fontSize: "12px", fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </LightCard>
            </div>
          );
        })()}

        {/* ════════════════ 删除记录 TAB ════════════════ */}
        {nodeTab === "deletions" && (
          <LightCard style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <SectionHeader>🗑 删除记录（共 {deletionLog.length} 条）</SectionHeader>
              {deletionLog.length > 0 && (
                <button onClick={() => void clearDeletionLogFn()}
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", color: "#dc2626", cursor: "pointer", fontSize: "12px", fontWeight: 600, padding: "5px 14px" }}>
                  清空记录
                </button>
              )}
            </div>
            {deletionLog.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>🗑️</div>
                <p style={{ color: C.text2, fontSize: "14px", fontWeight: 600, margin: "0 0 6px" }}>暂无删除记录</p>
                <p style={{ color: C.text3, fontSize: "12px", margin: 0 }}>删除节点后记录将在这里保存</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {deletionLog.map(r => (
                  <div key={r.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "9px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ color: C.text, fontSize: "13px", fontWeight: 700 }}>{r.name}</span>
                      <span style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "5px", color: "#dc2626", fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>
                        {DELETION_REASON_LABELS[r.reason]}
                      </span>
                      <span style={{ marginLeft: "auto", color: C.text3, fontSize: "11px" }}>
                        {new Date(r.deletedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <code style={{ color: C.blue, fontSize: "11px", fontFamily: "monospace", display: "block", wordBreak: "break-all" }}>{r.url}</code>
                    {r.errorMsg && <p style={{ color: C.text3, fontSize: "11px", margin: "4px 0 0" }}>{r.errorMsg}</p>}
                  </div>
                ))}
              </div>
            )}
          </LightCard>
        )}

        {/* ════════════════ 部署代码 TAB ════════════════ */}
        {nodeTab === "deploy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <LightCard style={{ padding: "20px 24px" }}>
              <SectionHeader>🚀 快速接入指南</SectionHeader>
              <p style={{ color: C.text2, fontSize: "13px", margin: "0 0 16px" }}>
                将你的 OpenAI SDK 的 <code style={{ background: C.bg, borderRadius: "4px", color: C.blue, fontSize: "12px", padding: "1px 6px" }}>base_url</code> 改为本代理地址，即可透明接入本集群。
              </p>

              {[
                {
                  lang: "Python (openai SDK)",
                  code: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}/v1",\n    api_key="your-proxy-api-key",\n)\n\nresponse = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Hello!"}],\n)`,
                },
                {
                  lang: "Node.js (openai SDK)",
                  code: `import OpenAI from 'openai';\n\nconst client = new OpenAI({\n  baseURL: '${baseUrl}/v1',\n  apiKey: 'your-proxy-api-key',\n});\n\nconst response = await client.chat.completions.create({\n  model: 'gpt-4o',\n  messages: [{ role: 'user', content: 'Hello!' }],\n});`,
                },
                {
                  lang: "cURL",
                  code: `curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer your-proxy-api-key" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'`,
                },
              ].map(({ lang, code }) => (
                <div key={lang} style={{ marginBottom: "14px" }}>
                  <p style={{ color: C.text2, fontSize: "12px", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{lang}</p>
                  <div style={{ position: "relative" }}>
                    <pre style={{ background: "#0f172a", border: `1px solid #1e293b`, borderRadius: "8px", color: "#e2e8f0", fontSize: "12px", fontFamily: "monospace", margin: 0, overflowX: "auto", padding: "14px 16px", paddingRight: "80px", lineHeight: 1.7 }}>{code}</pre>
                    <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                      <CopyButton text={code} />
                    </div>
                  </div>
                </div>
              ))}
            </LightCard>

            <LightCard style={{ padding: "18px 22px" }}>
              <SectionHeader>🔗 API 端点列表</SectionHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { method: "POST", path: "/v1/chat/completions", desc: "聊天补全（主代理入口）" },
                  { method: "GET",  path: "/v1/models",           desc: "可用模型列表" },
                  { method: "GET",  path: "/api/upstreams",       desc: "节点列表 API" },
                  { method: "GET",  path: "/api/healthz",         desc: "健康检查" },
                  { method: "GET",  path: "/v1/usage",            desc: "请求用量统计" },
                ].map(({ method, path, desc }) => (
                  <div key={path} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ background: method === "GET" ? C.bluePale : "#eff0fe", border: `1px solid ${method === "GET" ? C.blueLight : "#c7d2fe"}`, borderRadius: "5px", color: method === "GET" ? C.blue : "#4f46e5", fontSize: "11px", fontWeight: 700, padding: "2px 8px", flexShrink: 0 }}>{method}</span>
                    <code style={{ color: C.text, fontSize: "12px", fontFamily: "monospace", flex: 1 }}>{path}</code>
                    <span style={{ color: C.text3, fontSize: "12px" }}>{desc}</span>
                    <CopyButton text={`${baseUrl}${path}`} />
                  </div>
                ))}
              </div>
            </LightCard>
          </div>
        )}

        {/* ════════════════ 设置 TAB ════════════════ */}
        {nodeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            <LightCard style={{ padding: "20px 24px" }}>
              <SectionHeader>🏥 节点健康检测</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                <NumberInput label="心跳检测间隔（秒）" value={Math.round(settingsForm.healthIntervalMs / 1000)} min={10} max={3600} note="重启后生效"
                  onChange={v => setSettingsForm(f => ({ ...f, healthIntervalMs: v * 1000 }))} />
                <NumberInput label="最大连续失败次数" value={settingsForm.maxConsecutiveFailures} min={1} max={20}
                  onChange={v => setSettingsForm(f => ({ ...f, maxConsecutiveFailures: v }))} />
                <NumberInput label="请求超时（秒）" value={Math.round(settingsForm.requestTimeoutMs / 1000)} min={5} max={600}
                  onChange={v => setSettingsForm(f => ({ ...f, requestTimeoutMs: v * 1000 }))} />
                <div>
                  <p style={{ color: C.text2, fontSize: "12px", margin: "0 0 10px", fontWeight: 500 }}>失败自动重试</p>
                  <Toggle value={settingsForm.retryOnError} onChange={v => setSettingsForm(f => ({ ...f, retryOnError: v }))} />
                </div>
              </div>
            </LightCard>

            <LightCard style={{ padding: "20px 24px" }}>
              <SectionHeader>💾 响应缓存</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                <div>
                  <p style={{ color: C.text2, fontSize: "12px", margin: "0 0 10px", fontWeight: 500 }}>缓存功能</p>
                  <Toggle value={settingsForm.cacheEnabled} onChange={v => setSettingsForm(f => ({ ...f, cacheEnabled: v }))} />
                </div>
                <NumberInput label="缓存有效期（分钟）" value={Math.round(settingsForm.cacheTtlMs / 60_000)} min={1} max={10080}
                  onChange={v => setSettingsForm(f => ({ ...f, cacheTtlMs: v * 60_000 }))} />
                {cacheSize !== null && (
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ color: C.text3, fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>当前缓存条数</p>
                    <p style={{ color: C.blue, fontSize: "22px", fontWeight: 700, margin: 0 }}>{cacheSize}</p>
                  </div>
                )}
              </div>
            </LightCard>

            <LightCard style={{ padding: "20px 24px" }}>
              <SectionHeader>🚦 请求限流</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                <div>
                  <p style={{ color: C.text2, fontSize: "12px", margin: "0 0 10px", fontWeight: 500 }}>限流功能</p>
                  <Toggle value={settingsForm.rateLimitEnabled} onChange={v => setSettingsForm(f => ({ ...f, rateLimitEnabled: v }))} />
                </div>
                <NumberInput label="每 IP 每分钟请求上限" value={settingsForm.rateLimitPerMinute} min={1} max={1000}
                  onChange={v => setSettingsForm(f => ({ ...f, rateLimitPerMinute: v }))} />
              </div>
            </LightCard>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <p style={{ color: C.text3, fontSize: "12px", margin: 0 }}>心跳间隔等部分设置需重启服务后生效</p>
              <button onClick={() => void saveSettingsFn()} disabled={settingsSaving}
                style={{ background: settingsSaving ? "#93c5fd" : C.blue, border: "none", borderRadius: "8px", color: "white", cursor: settingsSaving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, padding: "9px 24px" }}>
                {settingsSaving ? "保存中…" : "💾 保存设置"}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ USAGE STATS (always visible) ════════════════ */}
        {usageData && activeModels.length > 0 && (
          <LightCard style={{ marginTop: "20px", padding: "20px 24px" }}>
            <SectionHeader>📊 用量统计</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              {[
                { label: "总请求", val: usageData.totalRequests.toLocaleString() },
                { label: "总 Token", val: formatTokens(usageData.totalTokens) },
                { label: "总错误",  val: usageData.totalErrors.toLocaleString() },
                { label: "运行时间", val: formatUptime(usageData.uptimeMs) },
                { label: "估算费用", val: `$${calcTotalCost(usageData.byModel).toFixed(4)}` },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px 14px" }}>
                  <p style={{ color: C.text3, fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                  <p style={{ color: C.text, fontSize: "18px", fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>{val}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {activeModels.slice(0, 6).map(([modelId, stat]) => (
                <div key={modelId} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ color: C.text2, fontSize: "12px", minWidth: "160px", fontFamily: "monospace" }}>{modelId}</span>
                  <div style={{ flex: 1, background: C.bg, borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (stat.requests / (usageData.totalRequests || 1)) * 100)}%`, background: C.blue, borderRadius: "4px" }} />
                  </div>
                  <span style={{ color: C.blue, fontSize: "12px", fontWeight: 600, minWidth: "40px", textAlign: "right" }}>{stat.requests}</span>
                  <span style={{ color: C.text3, fontSize: "11px", minWidth: "80px", textAlign: "right" }}>{formatTokens(stat.inputTokens + stat.outputTokens)} tok</span>
                </div>
              ))}
            </div>
          </LightCard>
        )}

      </div>
    </div>
  );
}
