"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Square, RotateCw, RefreshCw } from "lucide-react";
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
  managedMode: boolean;
  logs: string[];
  comfyApiUrl: string;
  errorMessage: string | null;
};

// ---------------------------------------------------------------------------
// State badge
// ---------------------------------------------------------------------------

const STATE_CONFIG: Record<ComfyProcessState, { label: string; color: string; bg: string }> = {
  stopped: { label: "已停止", color: "text-zinc-400", bg: "bg-zinc-500/20" },
  starting: { label: "启动中", color: "text-amber-300", bg: "bg-amber-500/20" },
  running: { label: "运行中", color: "text-emerald-300", bg: "bg-emerald-500/20" },
  unhealthy: { label: "不健康", color: "text-red-300", bg: "bg-red-500/20" },
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

const POLL_INTERVAL = 5000;

export default function MonitorPage() {
  const [status, setStatus] = useState<ComfyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
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
  const performAction = useCallback(async (action: "start" | "stop" | "restart") => {
    setActionPending(true);
    try {
      await fetch(`/api/comfy/${action}`, { method: "POST" });
      // Small delay then refresh
      await new Promise((r) => setTimeout(r, 500));
      await fetchStatus();
    } catch {
      // Silently fail, next poll will show state
    } finally {
      setActionPending(false);
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

  const canStart = status.state === "stopped" || status.state === "error";
  const canStop = status.state === "running" || status.state === "starting" || status.state === "unhealthy";
  const canRestart = status.managedMode && status.state !== "stopped";

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
            label="重启次数"
            value={`${status.restartCount}${status.maxRestartsReached ? " (上限)" : ""}`}
            tone={status.maxRestartsReached ? "warn" : "default"}
          />
        </div>

        {/* Additional info */}
        <div className="mt-3 space-y-1 text-xs text-zinc-500">
          <div>API 地址：<span className="text-zinc-300">{status.comfyApiUrl}</span></div>
          <div>上次健康检查：<span className="text-zinc-300">{formatTime(status.lastHealthCheck)}</span> {status.lastHealthOk ? "✓" : "✗"}</div>
          <div>自动重启：<span className="text-zinc-300">{status.autoRestartEnabled ? "启用" : "禁用"}</span></div>
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
              onClick={() => performAction("restart")}
              disabled={actionPending || !canRestart}
              icon={RotateCw}
              label="重启"
            />
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
                className={
                  line.includes("[stderr]") || line.includes("error")
                    ? "text-red-400/80"
                    : line.includes("[manager]")
                      ? "text-sky-400/70"
                      : line.includes("✓")
                        ? "text-emerald-400/70"
                        : ""
                }
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
