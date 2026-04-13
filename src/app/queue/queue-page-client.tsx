"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock3, Eye, Sparkles, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { cancelRun } from "@/lib/actions";
import type { QueueRun, RunningRun, FailedRun } from "@/lib/types";

export type QueueTabKey = "pending" | "running" | "failed";

type TabDef = { key: QueueTabKey; label: string };

const TABS: TabDef[] = [
  { key: "pending", label: "待审核" },
  { key: "running", label: "运行中" },
  { key: "failed", label: "失败" },
];

const POLL_INTERVAL_MS = 5_000;

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

type Props = {
  initialQueueRuns: QueueRun[];
  initialRunningRuns: RunningRun[];
  initialFailedRuns?: FailedRun[];
};

export function QueuePageClient({ initialQueueRuns, initialRunningRuns, initialFailedRuns }: Props) {
  const [activeTab, setActiveTab] = useState<QueueTabKey>("pending");
  const [queueRuns, setQueueRuns] = useState<QueueRun[]>(initialQueueRuns);
  const [runningRuns, setRunningRuns] = useState<RunningRun[]>(initialRunningRuns);
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>(initialFailedRuns ?? []);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Track known failed run IDs for toast diff
  const knownFailedIdsRef = useRef<Set<string>>(new Set((initialFailedRuns ?? []).map((r) => r.id)));

  // Track known completed run IDs for success toast
  const knownDoneIdsRef = useRef<Set<string>>(new Set((initialQueueRuns ?? []).map((r) => r.id)));

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/queue-data");
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

      router.refresh();
    });
  }, [router]);

  // Auto-poll
  useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const pendingTotal = queueRuns.reduce((sum, run) => sum + run.pendingCount, 0);
  const runTotal = queueRuns.length;
  const runningCount = runningRuns.length;
  const failedCount = failedRuns.length;

  return (
    <div className="space-y-4">
      <PageHeader title="待审核队列" description="默认按最新 Section Run 倒序显示，先处理最新的一组。" />

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge =
            tab.key === "pending" ? pendingTotal :
            tab.key === "running" ? runningCount :
            failedCount;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
                isActive
                  ? tab.key === "failed"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-sky-500/20 text-sky-300"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
              }`}
            >
              {tab.label}
              {badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    isActive
                      ? tab.key === "failed"
                        ? "bg-red-500/30 text-red-200"
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
          <SectionCard title="队列概览" subtitle="审核通过后会从待审核列表中消失。">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatChip label="待审核图片" value={pendingTotal} tone="accent" />
              <StatChip label="待处理组数" value={runTotal} tone="warn" />
            </div>
          </SectionCard>

          <SectionCard title="最新结果组" subtitle="点进某一组后，用宫格勾选批量保留/删除。">
            <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
              {queueRuns.length === 0 && (
                <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
                  暂无待审核项
                </div>
              )}
              {queueRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/queue/${run.id}`}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06] md:max-w-[500px]"
                >
                  <div className="flex items-start gap-3">
                    {run.thumbnailUrl && (
                      <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                        <Image
                          src={run.thumbnailUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{run.projectTitle}</div>
                          <div className="mt-1 truncate text-xs text-zinc-400">{run.sectionName}{run.presetNames.length > 0 ? ` · ${run.presetNames.join(" · ")}` : ""}</div>
                        </div>
                        <span className="flex-shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">{run.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400 lg:grid-cols-6">
                        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                          <CheckCircle2 className="mb-1 size-3.5" />
                          {formatTimeAgo(run.finishedAt) ?? run.createdAt}
                        </div>
                        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                          <Eye className="mb-1 size-3.5" />
                          待审核 {run.pendingCount}
                        </div>
                        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                          <Sparkles className="mb-1 size-3.5" />
                          共 {run.totalCount} 张
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end text-xs text-sky-300">
                    打开宫格 <ChevronRight className="ml-1 size-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {/* Running tab */}
      {activeTab === "running" && (
        <SectionCard title="运行中" subtitle="自动每 5 秒刷新。">
          <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
            {runningRuns.length === 0 && (
              <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
                暂无运行中的项目
              </div>
            )}
            {runningRuns.map((run) => (
              <div
                key={run.id}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 md:max-w-[500px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
                    <div className="mt-1 text-xs text-zinc-400">{run.sectionName}{run.presetNames.length > 0 ? ` · ${run.presetNames.join(" · ")}` : ""}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${
                    run.status === "running"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                      : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                  }`}>
                    <Loader2 className={`mr-1 inline size-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                    {run.status === "running" ? "运行中" : "排队中"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-3 text-xs text-zinc-400">
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                      <Clock3 className="mb-1 size-3.5" />
                      {run.startedAt}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`确认取消任务「${run.projectTitle} / ${run.sectionName}」？`)) return;
                      startTransition(async () => {
                        const result = await cancelRun(run.id);
                        if (result.ok) {
                          toast.success("任务已取消");
                          // Remove from local state immediately
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
            ))}
          </div>
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
                className="w-full rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3 md:max-w-[500px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
                    <div className="mt-1 text-xs text-zinc-400">{run.sectionName}{run.presetNames.length > 0 ? ` · ${run.presetNames.join(" · ")}` : ""}</div>
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
                <div className="mt-2 text-xs text-zinc-500">
                  {formatTimeAgo(run.finishedAt) ?? ""}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
