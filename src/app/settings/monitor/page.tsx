"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Square, RefreshCw, HeartPulse } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";

// ---------------------------------------------------------------------------
// Types (mirrors ComfyProcessStatus from the API)
// ---------------------------------------------------------------------------

type ComfyProcessState =
  | "stopped"
  | "starting"
  | "running"
  | "unhealthy"
  | "waiting_for_gpu"
  | "restarting"
  | "error";

type ComfyStatus = {
  state: ComfyProcessState;
  pid: number | null;
  uptime: number | null;
  lastHealthCheck: string | null;
  lastHealthOk: boolean;
  restartCount: number;
  restartsInWindow: number;
  maxRestartsReached: boolean;
  autoRestartEnabled: boolean;
  gpuAwareRestartEnabled: boolean;
  gpuAvailability: { state: "available" | "unavailable" | "unknown"; message: string } | null;
  managedMode: boolean;
  logs: string[];
  comfyApiUrl: string;
  errorMessage: string | null;
};

type ComfyActionResponse =
  | { ok: true; data?: { message?: string } }
  | { ok: false; error?: { message?: string } };

// ---------------------------------------------------------------------------
// State badge
// ---------------------------------------------------------------------------

const STATE_CONFIG: Record<ComfyProcessState, { label: string; color: string; bg: string }> = {
  stopped: { label: "已停止", color: "text-zinc-400", bg: "bg-zinc-500/20" },
  starting: { label: "启动中", color: "text-amber-300", bg: "bg-amber-500/20" },
  running: { label: "运行中", color: "text-emerald-300", bg: "bg-emerald-500/20" },
  unhealthy: { label: "不健康", color: "text-red-300", bg: "bg-red-500/20" },
  waiting_for_gpu: { label: "等待 GPU", color: "text-sky-300", bg: "bg-sky-500/20" },
  restarting: { label: "重启中", color: "text-amber-300", bg: "bg-amber-500/20" },
  error: { label: "错误", color: "text-red-300", bg: "bg-red-500/20" },
};

function StateBadge({ state }: { state: ComfyProcessState }) {
  const config = STATE_CONFIG[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.color} ${config.bg}`}>
      <span className={`size-1.5 rounded-full ${state === "running" ? "bg-emerald-400 animate-pulse" : state === "stopped" ? "bg-zinc-500" : "bg-current"}`} />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  label,
  variant = "default",
}: {
  onClick: () => void;
  disabled: boolean;
  icon: typeof Play;
  label: string;
  variant?: "default" | "danger" | "accent";
}) {
  const variantClass = {
    default: "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200",
    danger: "border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300",
    accent: "border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${variantClass}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Log line coloring
// ---------------------------------------------------------------------------

/** Patterns that indicate real errors vs harmless stderr info */
const STDERR_ERROR_PATTERNS = [
  /Traceback \(most recent/i,
  /Error:|Exception:|FAILED/i,
  /Cannot import .* module for custom nodes/i,
  /ModuleNotFoundError/i,
  /SyntaxError/i,
];

function getLogLineColor(line: string): string {
  // Manager internal messages
  if (line.includes("[manager]")) return "text-sky-400/70";
  // Health check success
  if (line.includes("\u2713")) return "text-emerald-400/70";
  // Health check failure
  if (line.includes("\u2717")) return "text-red-400/80";

  if (line.includes("[stderr]")) {
    const content = line.replace(/^.*?\[stderr\]\s*/, "");
    // Check if it matches a real error pattern
    if (STDERR_ERROR_PATTERNS.some((p) => p.test(content))) {
      return "text-amber-400/80";
    }
    // Harmless info that happens to be on stderr
    return "text-zinc-500";
  }

  // stdout
  return "";
}

const POLL_INTERVAL = 5000;

export default function MonitorPage() {
  const [status, setStatus] = useState<ComfyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [probePending, setProbePending] = useState(false);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; latencyMs: number; error?: string } | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/comfy/status");
      const json = await res.json();
      if (json.ok) setStatus(json.data);
    } catch {
      // Will retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling
  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status?.logs, autoScroll]);

  // Track scroll position for auto-scroll
  const handleLogScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  // Actions
  const performAction = useCallback(async (action: "start" | "stop") => {
    setActionPending(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/comfy/${action}`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as ComfyActionResponse | null;
      if (!res.ok || json?.ok !== true) {
        const message = json?.ok === false ? json.error?.message : null;
        throw new Error(message ?? `Request failed (${res.status})`);
      }
      setActionResult({ ok: true, message: json.data?.message ?? "Action completed" });
      // Small delay then refresh
      await new Promise((r) => setTimeout(r, 500));
      await fetchStatus();
    } catch (error) {
      setActionResult({ ok: false, message: error instanceof Error ? error.message : "Request failed" });
      await fetchStatus();
    } finally {
      setActionPending(false);
    }
  }, [fetchStatus]);

  // Health probe
  const probeHealth = useCallback(async () => {
    setProbePending(true);
    setProbeResult(null);
    try {
      const res = await fetch("/api/comfy/health-probe", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setProbeResult(json.data);
        // Refresh status since probe may have updated state
        await fetchStatus();
      }
    } catch {
      setProbeResult({ ok: false, latencyMs: 0, error: "Request failed" });
    } finally {
      setProbePending(false);
    }
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition">
          <ArrowLeft className="size-3" />
          返回设置
        </Link>
        <SectionCard title="ComfyUI 监控" subtitle="加载中...">
          <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
            <RefreshCw className="size-4 animate-spin mr-2" />
            正在获取状态...
          </div>
        </SectionCard>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="space-y-4">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition">
          <ArrowLeft className="size-3" />
          返回设置
        </Link>
        <SectionCard title="ComfyUI 监控" subtitle="无法获取状态">
          <p className="text-sm text-zinc-500">
            无法连接到状态 API，请检查服务是否正常运行。
          </p>
        </SectionCard>
      </div>
    );
  }

  const canStart =
    status.state === "stopped" ||
    status.state === "error" ||
    status.state === "unhealthy" ||
    status.state === "waiting_for_gpu";
  const canStop =
    status.state === "running" ||
    status.state === "starting" ||
    status.state === "unhealthy" ||
    status.state === "waiting_for_gpu";

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition">
        <ArrowLeft className="size-3" />
        返回设置
      </Link>

      {/* Status overview */}
      <SectionCard
        title="ComfyUI 监控"
        subtitle={status.managedMode ? "进程管理模式" : "外部管理模式（仅健康检查）"}
        actions={<StateBadge state={status.state} />}
      >
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip
            label="状态"
            value={STATE_CONFIG[status.state].label}
            tone={status.state === "running" ? "accent" : status.state === "error" || status.state === "unhealthy" ? "warn" : "default"}
          />
          <StatChip label="运行时长" value={formatUptime(status.uptime)} />
          <StatChip label="PID" value={status.pid ?? "—"} />
          <StatChip
            label="GPU Watchdog"
            value={status.gpuAwareRestartEnabled ? (status.gpuAvailability?.state ?? "待检查") : "关闭"}
            tone={status.gpuAvailability?.state === "unavailable" ? "warn" : status.gpuAvailability?.state === "available" ? "accent" : "default"}
          />
        </div>

        {/* Additional info */}
        <div className="mt-3 space-y-1 text-xs text-zinc-500">
          <div>API 地址：<span className="text-zinc-300">{status.comfyApiUrl}</span></div>
          <div>上次健康检查：<span className="text-zinc-300">{formatTime(status.lastHealthCheck)}</span> {status.lastHealthOk ? "✓" : "✗"}</div>
          {status.gpuAvailability && (
            <div>GPU 检查：<span className="text-zinc-300">{status.gpuAvailability.state}</span> · {status.gpuAvailability.message}</div>
          )}
          {status.errorMessage && (
            <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-red-300">
              {status.errorMessage}
            </div>
          )}
        </div>

        {/* Actions */}
        {status.managedMode && (
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              onClick={() => performAction("start")}
              disabled={actionPending || !canStart}
              icon={Play}
              label="启动"
              variant="accent"
            />
            <ActionButton
              onClick={() => performAction("stop")}
              disabled={actionPending || !canStop}
              icon={Square}
              label="停止"
              variant="danger"
            />
            <ActionButton
              onClick={probeHealth}
              disabled={probePending}
              icon={HeartPulse}
              label={probePending ? "探测中..." : "健康探测"}
            />
          </div>
        )}
        {actionResult && (
          <div className={`mt-2 rounded-lg border p-2 text-xs ${actionResult.ok ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-red-500/20 bg-red-500/5 text-red-300"}`}>
            {actionResult.message}
          </div>
        )}
        {!status.managedMode && (
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              onClick={probeHealth}
              disabled={probePending}
              icon={HeartPulse}
              label={probePending ? "探测中..." : "健康探测"}
            />
          </div>
        )}
        {probeResult && (
          <div className={`mt-2 rounded-lg border p-2 text-xs ${probeResult.ok ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-red-500/20 bg-red-500/5 text-red-300"}`}>
            {probeResult.ok
              ? `ComfyUI 响应正常 (${probeResult.latencyMs}ms)`
              : `ComfyUI 不可达: ${probeResult.error} (${probeResult.latencyMs}ms)`}
          </div>
        )}
      </SectionCard>

      {/* Logs */}
      <SectionCard title="进程日志" subtitle={`最近 ${status.logs.length} 条`}>
        {status.logs.length === 0 ? (
          <p className="text-xs text-zinc-600 py-4 text-center">暂无日志</p>
        ) : (
          <div
            ref={logContainerRef}
            onScroll={handleLogScroll}
            className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3 font-mono text-[11px] leading-5 text-zinc-400"
          >
            {status.logs.map((line, i) => (
              <div
                key={i}
                className={getLogLineColor(line)}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
