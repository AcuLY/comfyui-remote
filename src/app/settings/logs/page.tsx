"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/section-card";

const POLL_INTERVAL_MS = 5_000;

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
  duration?: number;
};

const MODULES = [
  { value: "", label: "全部模块" },
  { value: "run-executor", label: "run-executor" },
  { value: "comfyui-service", label: "comfyui-service" },
  { value: "image-result-service", label: "image-result-service" },
];

const LEVELS = [
  { value: "", label: "全部级别" },
  { value: "info", label: "INFO+" },
  { value: "warn", label: "WARN+" },
  { value: "error", label: "ERROR" },
];

function levelColor(level: string) {
  switch (level) {
    case "error":
      return "text-red-400/80";
    case "warn":
      return "text-amber-400/80";
    case "info":
      return "text-zinc-400";
    case "debug":
      return "text-zinc-600";
    default:
      return "text-zinc-400";
  }
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return ts;
  }
}

function formatContext(entry: LogEntry) {
  const parts: string[] = [];
  if (entry.context) {
    for (const [k, v] of Object.entries(entry.context)) {
      if (k === "module" || k === "operation") continue;
      parts.push(`${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }
  if (entry.duration != null) {
    parts.push(`(${entry.duration.toFixed(0)}ms)`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ lines: "300" });
      if (moduleFilter) params.set("module", moduleFilter);
      if (levelFilter) params.set("level", levelFilter);
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && Array.isArray(json.data?.entries)) {
        setLogs(json.data.entries);
      }
    } catch {
      // Will retry on next poll
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, levelFilter]);

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(fetchLogs, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  function handleLogScroll() {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
      >
        <ArrowLeft className="size-3" />
        返回设置
      </Link>

      <SectionCard
        title="后端日志"
        subtitle={loading ? "加载中..." : `${logs.length} 条日志`}
        actions={
          <button
            onClick={fetchLogs}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
            title="刷新"
          >
            <RefreshCw className="size-3.5" />
          </button>
        }
      >
        {/* Filters */}
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
          >
            {MODULES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Log viewer */}
        {logs.length === 0 ? (
          <p className="text-xs text-zinc-600 py-4 text-center">
            {loading ? "加载中..." : "暂无日志 (需要启用 LOG_ENABLE_FILE=true)"}
          </p>
        ) : (
          <div
            ref={logContainerRef}
            onScroll={handleLogScroll}
            className="max-h-[70vh] overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3 font-mono text-[11px] leading-5"
          >
            {logs.map((entry, i) => (
              <div key={i} className={levelColor(entry.level)}>
                <span className="text-zinc-600">{formatTimestamp(entry.timestamp)}</span>
                {" "}
                <span className={`font-semibold ${levelColor(entry.level)}`}>
                  {entry.level.toUpperCase().padEnd(5)}
                </span>
                {" "}
                {entry.context?.module ? (
                  <span className="text-sky-400/70">[{String(entry.context.module)}]</span>
                ) : null}
                {" "}
                <span>{entry.message}</span>
                <span className="text-zinc-600">{formatContext(entry)}</span>
                {entry.error && (
                  <div className="ml-4 text-red-400/60">
                    {entry.error.name}: {entry.error.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
