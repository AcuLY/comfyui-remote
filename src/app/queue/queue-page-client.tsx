"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RotateCw, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, AlertTriangle, XCircle, ImageIcon, Trash2, RotateCcw, Pause, Play, Shield } from "lucide-react";
import { toast } from "sonner";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { cancelRun, runSection, clearRuns, clearTrash, pauseRun, resumeRun } from "@/lib/actions";
import { showRunSubmissionToast } from "@/lib/run-submission-toast";
import type { QueueControlProgressEvent } from "@/lib/queue-control-progress";
import type { QueuePagination, QueueRun, RunningRun, FailedRun, TrashItem, CensoringProgressItem, CensoringHistoryItem } from "@/lib/types";

export type QueueTabKey = "pending" | "running" | "failed" | "censoring" | "trash";

type TabDef = { key: QueueTabKey; label: string };

const TABS: TabDef[] = [
  { key: "pending", label: "待审核" },
  { key: "running", label: "运行中" },
  { key: "censoring", label: "打码" },
  { key: "failed", label: "失败" },
  { key: "trash", label: "回收站" },
];

const POLL_INTERVAL_MS = 5_000;

type QueueControlStreamResult = {
  ok?: boolean;
  count?: number;
  runIds?: string[];
  batchId?: string;
  error?: string;
  data?: Record<string, unknown>;
};

function formatQueueControlProgress(event: QueueControlProgressEvent) {
  const processedRuns = event.processedRuns ?? 0;
  const totalRuns = event.totalRuns ?? 0;
  const batchSize = event.batchSize ?? 0;
  const elapsedMs = event.elapsedMs;
  const stageLabel: Record<QueueControlProgressEvent["stage"], string> = {
    reading_queue: "Reading queue",
    syncing_comfy: "Syncing ComfyUI",
    confirming_remote: "Confirming remote",
    updating_local: "Updating local rows",
    refreshing: "Refreshing",
    done: "Done",
    failed: "Failed",
  };
  const details = [
    totalRuns > 0 ? `${processedRuns}/${totalRuns} runs` : null,
    batchSize > 0 ? `batch ${event.batchIndex ?? 1}: ${batchSize}` : null,
    typeof elapsedMs === "number" ? `${elapsedMs}ms` : null,
    event.error ? `error: ${event.error}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    title: stageLabel[event.stage] ?? event.stage,
    description: details.join(" · ") || event.message,
  };
}

async function readQueueControlProgressStream(
  response: Response,
  onProgress: (event: QueueControlProgressEvent) => void,
) {
  if (!response.body) {
    return (await response.json()) as QueueControlStreamResult;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: QueueControlStreamResult | null = null;

  const processBlock = (block: string) => {
    const eventName = block.match(/^event: (.+)$/m)?.[1]?.trim() ?? "message";
    const dataText = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (!dataText) return;

    const payload = JSON.parse(dataText) as QueueControlProgressEvent | QueueControlStreamResult;
    if (eventName === "progress") {
      onProgress(payload as QueueControlProgressEvent);
    } else if (eventName === "result") {
      result = payload as QueueControlStreamResult;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      processBlock(block);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processBlock(buffer);
  }

  return result ?? {};
}

/** Format a time string: <1h shows "X 分钟前", >=1h shows absolute time */
function formatTimeAgo(isoString: string | null): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;

  // Absolute time: MM-DD HH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RunProgressView({ run }: { run: RunningRun }) {
  const progress = run.progress;
  const percent = progress ? Math.round(Math.max(0, Math.min(100, progress.percent))) : 0;
  const isQueued = run.status === "queued";
  const statusText = progress
    ? progress.percent >= 100
      ? "采样完成，正在收尾"
      : `采样 ${progress.currentStep}/${progress.totalSteps}`
    : isQueued
      ? "等待 ComfyUI 调度"
      : "等待采样日志";
  const metaItems = progress
    ? [
        progress.elapsed ? `已用 ${progress.elapsed}` : null,
        progress.remaining ? `剩余 ${progress.remaining}` : null,
        progress.rate,
        progress.stage > 1 ? `阶段 ${progress.stage}` : null,
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="min-w-0 truncate text-zinc-400">{statusText}</span>
        <span className={`shrink-0 font-mono ${progress ? "text-amber-200" : "text-zinc-500"}`}>
          {progress ? `${percent}%` : "--"}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={progress ? "ComfyUI 采样进度" : statusText}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress ? percent : undefined}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress
              ? "bg-amber-300"
              : isQueued
                ? "bg-zinc-700"
                : "animate-pulse bg-zinc-500"
          }`}
          style={{ width: progress ? `${percent}%` : isQueued ? "0%" : "12%" }}
        />
      </div>
      {metaItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-500">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  initialQueueRuns: QueueRun[];
  initialQueuePagination: QueuePagination;
  initialRunningRuns: RunningRun[];
  initialFailedRuns?: FailedRun[];
  initialTrashItems?: TrashItem[];
  initialCensoringProgress?: CensoringProgressItem[];
  initialCensoringHistory?: CensoringHistoryItem[];
};

function CensoringProgressCard({
  item,
  onCancel,
  onPause,
  onResume,
}: {
  item: CensoringProgressItem;
  onCancel: (projectId: string) => void;
  onPause: (projectId: string) => void;
  onResume: (projectId: string) => void;
}) {
  const percent = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
  const isPaused = item.paused > 0 && item.queued === 0 && item.running === 0;

  return (
    <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-200">{item.projectTitle}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            已完成 {item.done} · 运行中 {item.running} · 队列中 {item.queued}
            {item.paused > 0 && <span className="text-sky-400"> · 已暂停 {item.paused}</span>}
            {item.failed > 0 && <span className="text-rose-400"> · 失败 {item.failed}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isPaused ? (
            <button
              type="button"
              onClick={() => onResume(item.projectId)}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 transition hover:bg-emerald-500/20"
            >
              继续
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPause(item.projectId)}
              className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 transition hover:bg-sky-500/20"
            >
              暂停
            </button>
          )}
          <button
            type="button"
            onClick={() => onCancel(item.projectId)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"
          >
            取消
          </button>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-400">
            {isPaused ? "已暂停" : "打码进度"} {item.done}/{item.total}
          </span>
          <span className="font-mono text-amber-200">{percent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isPaused ? "bg-sky-400" : "bg-amber-400"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function QueuePageClient({ initialQueueRuns, initialQueuePagination, initialRunningRuns, initialFailedRuns, initialTrashItems, initialCensoringProgress, initialCensoringHistory }: Props) {
  const [activeTab, setActiveTab] = useState<QueueTabKey>("pending");
  const [queueRuns, setQueueRuns] = useState<QueueRun[]>(initialQueueRuns);
  const [queuePagination, setQueuePagination] = useState<QueuePagination>(initialQueuePagination);
  const [runningRuns, setRunningRuns] = useState<RunningRun[]>(initialRunningRuns);
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>(initialFailedRuns ?? []);
  const [trashItems, setTrashItems] = useState<TrashItem[]>(initialTrashItems ?? []);
  const [censoringProgress, setCensoringProgress] = useState<CensoringProgressItem[]>(initialCensoringProgress ?? []);
  const [censoringHistory, setCensoringHistory] = useState<CensoringHistoryItem[]>(initialCensoringHistory ?? []);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Track known failed run IDs for toast diff
  const knownFailedIdsRef = useRef<Set<string>>(new Set((initialFailedRuns ?? []).map((r) => r.id)));

  // Track known completed run IDs for success toast
  const knownDoneIdsRef = useRef<Set<string>>(new Set((initialQueueRuns ?? []).map((r) => r.id)));

  useEffect(() => {
    setQueueRuns(initialQueueRuns);
    setQueuePagination(initialQueuePagination);
  }, [initialQueueRuns, initialQueuePagination]);

  useEffect(() => {
    setTrashItems(initialTrashItems ?? []);
  }, [initialTrashItems]);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams({
        page: String(queuePagination.page),
        pageSize: String(queuePagination.pageSize),
      });
      if (activeTab === "trash") {
        params.set("includeTrash", "1");
      }
      const res = await fetch(`/api/queue-data?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();

      const newDone: QueueRun[] = data.queueRuns ?? [];
      // Show toast for newly completed runs
      for (const run of newDone) {
        if (!knownDoneIdsRef.current.has(run.id)) {
          toast.success(`${run.projectTitle} / ${run.sectionName} 完成`, {
            description: `生成了 ${run.totalCount} 张图片`,
          });
        }
      }
      knownDoneIdsRef.current = new Set(newDone.map((r) => r.id));
      setQueueRuns(newDone);
      if (data.queuePagination) {
        setQueuePagination(data.queuePagination);
      }

      setRunningRuns(data.runningRuns ?? []);

      const newFailed: FailedRun[] = data.failedRuns ?? [];
      // Show toast for newly appeared failures
      for (const run of newFailed) {
        if (!knownFailedIdsRef.current.has(run.id)) {
          toast.error(`${run.projectTitle} / ${run.sectionName} 失败`, {
            description: run.errorMessage ?? "未知错误",
            duration: 8000,
          });
        }
      }
      knownFailedIdsRef.current = new Set(newFailed.map((r) => r.id));
      setFailedRuns(newFailed);
      if (Array.isArray(data.trashItems)) {
        setTrashItems(data.trashItems);
      }
      setCensoringProgress(data.censoringProgress ?? []);
      setCensoringHistory(data.censoringHistory ?? []);
    });
  }, [activeTab, queuePagination.page, queuePagination.pageSize]);

  // Auto-poll
  useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Scroll to card when arriving via hash fragment (e.g. back navigation from /queue/:runId)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        const targetTop = window.scrollY + rect.top - Math.max(24, window.innerHeight * 0.2);
        window.scrollTo({ top: targetTop, behavior: "auto" });
      }
    }
  }, []);

  const pendingTotal = queuePagination.totalPendingImages;
  const runTotal = queuePagination.totalItems;
  const censoringActiveCount = censoringProgress.reduce((sum, item) => sum + item.running + item.queued, 0);
  const runningCount = runningRuns.length + censoringActiveCount;
  const censoringCount = censoringActiveCount;
  const failedCount = failedRuns.length;
  const trashCount = trashItems.length;
  const visiblePages = Array.from(
    new Set([
      1,
      queuePagination.page - 1,
      queuePagination.page,
      queuePagination.page + 1,
      queuePagination.totalPages,
    ]),
  ).filter((page) => page >= 1 && page <= queuePagination.totalPages);
  const pageHref = (page: number) => (page <= 1 ? "/queue" : `/queue?page=${page}`);

  function handleRestore(item: TrashItem) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/images/${encodeURIComponent(item.imageResultId)}/restore`, {
          method: "POST",
        });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: { message?: string };
        } | null;

        if (!response.ok || result?.ok === false) {
          throw new Error(result?.error?.message ?? "恢复失败");
        }

        setTrashItems((prev) => prev.filter((trashItem) => trashItem.id !== item.id));
        toast.success("图片已恢复");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "恢复失败");
      }
    });
  }

  function handleClearTrash() {
    if (trashItems.length === 0) return;
    if (
      !confirm(
        `确定要永久清空回收站中的 ${trashItems.length} 张图片吗？此操作不可恢复。`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await clearTrash();
      if (result.ok) {
        setTrashItems([]);
        const suffix =
          result.fileDeleteFailures > 0
            ? `，其中 ${result.fileDeleteFailures} 个文件未能删除`
            : "";
        toast.success(`已清空 ${result.count} 张图片${suffix}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "清空回收站失败");
      }
    });
  }

  async function runQueueControlProgressStream(
    url: string,
    options: {
      loading: string;
      success: (result: QueueControlStreamResult) => string;
      error: string;
      onSuccess?: (result: QueueControlStreamResult) => void;
    },
  ) {
    const toastId = toast.loading(options.loading);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? options.error);
      }

      const result = await readQueueControlProgressStream(response, (event) => {
        const next = formatQueueControlProgress(event);
        toast.loading(next.title, { id: toastId, description: next.description });
      });

      if (result.ok === false) {
        toast.error(result.error ?? options.error, { id: toastId });
        return;
      }

      toast.success(options.success(result), { id: toastId });
      options.onSuccess?.(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : options.error, { id: toastId });
    }
  }

  function handleClearActiveRuns() {
    startTransition(async () => {
      await runQueueControlProgressStream("/api/queue/clear-active?stream=1", {
        loading: "Clearing active queue",
        success: (result) => `Cleared ${result.count ?? 0} active run(s)`,
        error: "Failed to clear active queue",
        onSuccess: () => {
          setRunningRuns([]);
          router.refresh();
        },
      });
    });
  }

  const handleCancelCensoring = useCallback(async (projectId: string) => {
    try {
      const { cancelCensoringTasks } = await import("@/lib/actions");
      const result = await cancelCensoringTasks(projectId);
      if (result.success) {
        toast.success(result.message);
        refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("取消失败");
    }
  }, [refresh]);

  const handlePauseCensoring = useCallback(async (projectId: string) => {
    try {
      const { pauseCensoringTasks } = await import("@/lib/actions");
      const result = await pauseCensoringTasks(projectId);
      if (result.success) {
        toast.success(result.message);
        refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("暂停失败");
    }
  }, [refresh]);

  const handleResumeCensoring = useCallback(async (projectId: string) => {
    try {
      const { resumeCensoringTasks } = await import("@/lib/actions");
      const result = await resumeCensoringTasks(projectId);
      if (result.success) {
        toast.success(result.message);
        refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("恢复失败");
    }
  }, [refresh]);

  return (
    <div className="space-y-4">
      <PageHeader title="待审核队列" description="默认按最新 Section Run 倒序显示，先处理最新的一组。" />

      {/* Tab bar */}
      <div className="flex items-stretch gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge =
            tab.key === "pending" ? pendingTotal :
            tab.key === "running" ? runningCount :
            tab.key === "censoring" ? censoringCount :
            tab.key === "failed" ? failedCount :
            trashCount;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] leading-tight transition sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${
                isActive
                  ? tab.key === "failed"
                    ? "bg-red-500/20 text-red-300"
                    : tab.key === "trash"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-sky-500/20 text-sky-300"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
              }`}
            >
              {tab.label}
              {badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none sm:text-[11px] ${
                    isActive
                      ? tab.key === "failed"
                        ? "bg-red-500/30 text-red-200"
                        : tab.key === "trash"
                          ? "bg-amber-500/30 text-amber-200"
                          : "bg-sky-500/30 text-sky-200"
                      : "bg-white/10 text-zinc-500"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!confirm("确定要清空所有已完成、失败和已取消的运行记录吗？此操作不可撤销。")) return;
            startTransition(async () => {
              const result = await clearRuns();
              if (result.ok) {
                toast.success(`已清空 ${result.count} 条运行记录`);
                setQueueRuns([]);
                setQueuePagination((prev) => ({
                  ...prev,
                  page: 1,
                  totalItems: 0,
                  totalPages: 1,
                  startItem: 0,
                  endItem: 0,
                  totalPendingImages: 0,
                }));
                setFailedRuns([]);
                router.refresh();
              } else {
                toast.error(result.error ?? "清空失败");
              }
            });
          }}
          disabled={isPending}
          className="mr-1 inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[10px] leading-tight text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 sm:flex-row sm:px-2.5 sm:text-[11px]"
          title="清空记录"
        >
          <Trash2 className="size-3.5" /> 清空
        </button>
        <button
          onClick={refresh}
          disabled={isPending}
          className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Pending tab */}
      {activeTab === "pending" && (
        <>
          <SectionCard title="队列概览">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatChip label="待审核图片" value={pendingTotal} tone="accent" />
              <StatChip label="待处理组数" value={runTotal} tone="warn" />
            </div>
          </SectionCard>

          <SectionCard title="最新结果组">
            <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
              {queueRuns.length === 0 && (
                <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
                  暂无待审核项
                </div>
              )}
              {queueRuns.map((run) => (
                <HardNavigationLink
                  key={run.id}
                  id={`run-${run.id}`}
                  href={`/queue/${run.id}`}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06] md:max-w-[500px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{run.projectTitle}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-400">{run.projectTitle}：{run.sectionName}</div>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-500">{formatTimeAgo(run.finishedAt) ?? run.createdAt}</span>
                  </div>

                  {run.thumbnailUrls.length > 0 && (
                    <div className="mt-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                      {run.thumbnailUrls.map((src, i) => (
                        <div key={i} className="flex h-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[var(--panel-soft)]">
                          <Image
                            src={src}
                            alt=""
                            width={72}
                            height={72}
                            loading="lazy"
                            unoptimized
                            className="h-full w-auto object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="size-3" />
                      共 {run.totalCount} 张{run.pendingCount < run.totalCount && ` · ${run.pendingCount} 待审`}
                    </span>
                    <span className="flex items-center text-sky-300">
                      查看宫格 <ChevronRight className="size-3" />
                    </span>
                  </div>
                </HardNavigationLink>
              ))}
            </div>
            {queuePagination.totalItems > 0 && (
              <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-2.5 text-[11px] text-zinc-500 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-3 sm:text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {queuePagination.startItem}-{queuePagination.endItem} / {queuePagination.totalItems}
                </div>
                {queuePagination.totalPages > 1 && (
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <Link
                      href={pageHref(Math.max(1, queuePagination.page - 1))}
                      prefetch={false}
                      className={`inline-flex size-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] sm:size-7 ${queuePagination.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                    >
                      <ChevronLeft className="size-3 sm:size-3.5" />
                    </Link>
                    {visiblePages.map((page, index) => {
                      const prev = visiblePages[index - 1];
                      const showGap = prev !== undefined && page - prev > 1;
                      return (
                        <div key={page} className="flex items-center gap-0.5 sm:gap-1">
                          {showGap && <span className="px-0.5 text-[10px] text-zinc-600 sm:px-1 sm:text-xs">...</span>}
                          <Link
                            href={pageHref(page)}
                            prefetch={false}
                            className={`inline-flex size-6 items-center justify-center rounded-md border text-[10px] transition sm:size-7 sm:text-[11px] ${
                              page === queuePagination.page
                                ? "border-sky-500/30 bg-sky-500/20 text-sky-200"
                                : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                            }`}
                          >
                            {page}
                          </Link>
                        </div>
                      );
                    })}
                    <Link
                      href={pageHref(Math.min(queuePagination.totalPages, queuePagination.page + 1))}
                      prefetch={false}
                      className={`inline-flex size-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] sm:size-7 ${queuePagination.page >= queuePagination.totalPages ? "pointer-events-none opacity-40" : ""}`}
                    >
                      <ChevronRight className="size-3 sm:size-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* Running tab */}
      {activeTab === "running" && (
        <SectionCard title="运行中" subtitle="自动每 5 秒刷新。">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            {runningRuns.some((r) => r.status === "queued" || r.status === "running") && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await runQueueControlProgressStream("/api/queue/pause-active?stream=1", {
                      loading: "Pausing active queue",
                      success: (result) => `Paused ${result.count ?? 0} run(s)`,
                      error: "Failed to pause active queue",
                      onSuccess: refresh,
                    });
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40"
              >
                <Pause className="size-3.5" /> 全部暂停
              </button>
            )}
            {runningRuns.some((r) => r.status === "paused") && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await runQueueControlProgressStream("/api/queue/resume-paused?stream=1", {
                      loading: "Resuming paused queue",
                      success: (result) => `Resumed ${result.count ?? 0} run(s)`,
                      error: "Failed to resume paused queue",
                      onSuccess: refresh,
                    });
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
              >
                <Play className="size-3.5" /> 全部恢复
              </button>
            )}
            <button
              type="button"
              disabled={isPending || runningRuns.length === 0}
              onClick={handleClearActiveRuns}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
            >
              <Trash2 className="size-3.5" /> 清空运行中队列
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
            {runningRuns.length === 0 && (
              <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
                暂无运行中的项目
              </div>
            )}
            {runningRuns.map((run) => (
              <div
                key={run.id}
                id={`run-${run.id}`}
                className={`w-full rounded-xl border p-3 md:max-w-[500px] ${
                  run.status === "paused"
                    ? "border-amber-500/20 bg-amber-500/[0.03]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
                    <div className="mt-1 text-xs text-zinc-400">{run.projectTitle}：{run.sectionName}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${
                    run.status === "paused"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                      : run.status === "running"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                  }`}>
                    {run.status === "paused" ? (
                      <>
                        <Pause className="mr-1 inline size-3" />
                        已暂停
                      </>
                    ) : (
                      <>
                        <Loader2 className={`mr-1 inline size-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                        {run.status === "running" ? "运行中" : "排队中"}
                      </>
                    )}
                  </span>
                </div>
                {run.status !== "paused" && <RunProgressView run={run} />}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-3 text-xs text-zinc-400">
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                      <Clock3 className="mb-1 size-3.5" />
                      {run.startedAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {run.status === "paused" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await resumeRun(run.id);
                            if (result.ok) {
                              toast.success("任务已恢复");
                              refresh();
                            } else {
                              toast.error(result.error ?? "恢复失败");
                            }
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <Play className="size-3" /> 恢复
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await pauseRun(run.id);
                            if (result.ok) {
                              toast.success("任务已暂停");
                              refresh();
                            } else {
                              toast.error(result.error ?? "暂停失败");
                            }
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        <Pause className="size-3" /> 暂停
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await cancelRun(run.id);
                          if (result.ok) {
                            toast.success("任务已取消");
                            setRunningRuns((prev) => prev.filter((r) => r.id !== run.id));
                          } else {
                            toast.error(result.error ?? "取消失败");
                          }
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <XCircle className="size-3" /> 取消
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Censoring tasks */}
          {censoringProgress.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Shield className="size-3.5 text-amber-400" />
                <span>打码任务</span>
              </div>
              {censoringProgress.map((item) => (
                <CensoringProgressCard key={item.projectId} item={item} onCancel={handleCancelCensoring} onPause={handlePauseCensoring} onResume={handleResumeCensoring} />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Censoring tab */}
      {activeTab === "censoring" && (
        <SectionCard title="打码记录" subtitle="最近 50 条打码任务。">
          {/* Active progress at top */}
          {censoringProgress.length > 0 && (
            <div className="mb-4 space-y-3">
              {censoringProgress.map((item) => (
                <CensoringProgressCard key={item.projectId} item={item} onCancel={handleCancelCensoring} onPause={handlePauseCensoring} onResume={handleResumeCensoring} />
              ))}
            </div>
          )}
          {censoringHistory.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-zinc-500">
              暂无打码记录
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {censoringHistory.map((task) => {
                const createdDate = new Date(task.createdAt);
                const finishedDate = task.finishedAt ? new Date(task.finishedAt) : null;
                const timeStr = `${createdDate.getMonth() + 1}/${createdDate.getDate()} ${String(createdDate.getHours()).padStart(2, "0")}:${String(createdDate.getMinutes()).padStart(2, "0")}`;

                return (
                  <div
                    key={task.id}
                    className="relative overflow-hidden rounded-lg border border-white/10"
                    title={`${task.projectTitle}\n创建: ${task.createdAt}${task.finishedAt ? `\n完成: ${task.finishedAt}` : ""}${task.errorMessage ? `\n错误: ${task.errorMessage}` : ""}`}
                  >
                    <Image
                      src={task.thumbUrl}
                      alt=""
                      width={120}
                      height={160}
                      className="aspect-[3/4] w-full object-cover"
                      unoptimized
                    />
                    <div className="absolute left-0 right-0 top-0 bg-black/60 px-1 py-0.5 text-[8px] text-zinc-300">
                      {finishedDate ? `${finishedDate.getMonth() + 1}/${finishedDate.getDate()} ${String(finishedDate.getHours()).padStart(2, "0")}:${String(finishedDate.getMinutes()).padStart(2, "0")}` : timeStr}
                    </div>
                    <div className={`absolute bottom-0 left-0 right-0 py-0.5 text-center text-[8px] font-medium text-white ${
                      task.status === "done" ? "bg-emerald-500/80" :
                      task.status === "failed" ? "bg-rose-500/80" :
                      task.status === "running" ? "bg-amber-500/80" :
                      task.status === "cancelled" ? "bg-zinc-500/80" :
                      task.status === "paused" ? "bg-sky-500/80" :
                      "bg-sky-500/80"
                    }`}>
                      {task.status === "done" ? "完成" :
                       task.status === "failed" ? "失败" :
                       task.status === "running" ? "运行中" :
                       task.status === "cancelled" ? "已取消" :
                       task.status === "paused" ? "已暂停" : "队列中"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* Failed tab */}
      {activeTab === "failed" && (
        <SectionCard title="失败记录" subtitle="最近 20 条失败记录。">
          <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
            {failedRuns.length === 0 && (
              <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
                暂无失败记录
              </div>
            )}
            {failedRuns.map((run) => (
              <div
                key={run.id}
                id={`run-${run.id}`}
                className="w-full rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3 md:max-w-[500px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
                    <div className="mt-1 text-xs text-zinc-400">{run.projectTitle}：{run.sectionName}</div>
                  </div>
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                    <AlertTriangle className="mr-1 inline size-3" />
                    失败
                  </span>
                </div>
                {run.errorMessage && (
                  <div className="mt-2 rounded-xl bg-black/30 px-3 py-2 font-mono text-[11px] leading-5 text-red-400/80">
                    {run.errorMessage}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {formatTimeAgo(run.finishedAt) ?? ""}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await runSection(run.sectionId);
                        showRunSubmissionToast(result, `已重新提交「${run.sectionName}」`);
                        refresh();
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
                  >
                    <RotateCw className="size-3" />
                    重试
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Trash tab */}
      {activeTab === "trash" && (
        <>
          <SectionCard title="回收站" subtitle="已删除的图片可在此恢复到原位置。">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-3 sm:w-72">
                <StatChip label="已删除图片" value={trashCount} tone="warn" />
              </div>
              <button
                type="button"
                disabled={isPending || trashCount === 0}
                onClick={handleClearTrash}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
                清空回收站
              </button>
            </div>
          </SectionCard>

          {trashCount === 0 ? (
            <SectionCard title="无回收记录" subtitle="暂无已删除的图片。">
              <div className="py-8 text-center text-sm text-zinc-500">
                回收站为空
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="已删除图片" subtitle="点击恢复按钮将图片移回原路径。">
              <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
                {trashItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 md:max-w-[500px]"
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[var(--panel-soft)]">
                      <Image
                        src={item.src ?? "/placeholder.svg"}
                        alt={item.id}
                        width={128}
                        height={128}
                        loading="lazy"
                        className="size-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        删除于 {item.deletedAt}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-zinc-600">
                        {item.originalPath}
                      </div>
                    </div>
                    <button
                      disabled={isPending}
                      onClick={() => handleRestore(item)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <RotateCcw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
                      恢复
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
