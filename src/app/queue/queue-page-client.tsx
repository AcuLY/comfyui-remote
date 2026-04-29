"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RotateCw, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, AlertTriangle, XCircle, ImageIcon, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { cancelRun, runSection, clearRuns, restoreImage } from "@/lib/actions";
import type { QueuePagination, QueueRun, RunningRun, FailedRun, TrashItem } from "@/lib/types";

export type QueueTabKey = "pending" | "running" | "failed" | "trash";

type TabDef = { key: QueueTabKey; label: string };

const TABS: TabDef[] = [
  { key: "pending", label: "待审核" },
  { key: "running", label: "运行中" },
  { key: "failed", label: "失败" },
  { key: "trash", label: "回收站" },
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
  initialQueuePagination: QueuePagination;
  initialRunningRuns: RunningRun[];
  initialFailedRuns?: FailedRun[];
  initialTrashItems?: TrashItem[];
};

export function QueuePageClient({ initialQueueRuns, initialQueuePagination, initialRunningRuns, initialFailedRuns, initialTrashItems }: Props) {
  const [activeTab, setActiveTab] = useState<QueueTabKey>("pending");
  const [queueRuns, setQueueRuns] = useState<QueueRun[]>(initialQueueRuns);
  const [queuePagination, setQueuePagination] = useState<QueuePagination>(initialQueuePagination);
  const [runningRuns, setRunningRuns] = useState<RunningRun[]>(initialRunningRuns);
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>(initialFailedRuns ?? []);
  const [trashItems, setTrashItems] = useState<TrashItem[]>(initialTrashItems ?? []);
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

  const refresh = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams({
        page: String(queuePagination.page),
        pageSize: String(queuePagination.pageSize),
      });
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

      router.refresh();
    });
  }, [queuePagination.page, queuePagination.pageSize, router]);

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
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
  }, []);

  const pendingTotal = queuePagination.totalPendingImages;
  const runTotal = queuePagination.totalItems;
  const runningCount = runningRuns.length;
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

  function handleRestore(trashRecordId: string) {
    startTransition(async () => {
      await restoreImage(trashRecordId);
      setTrashItems((prev) => prev.filter((item) => item.id !== trashRecordId));
      toast.success("图片已恢复");
    });
  }

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
                <Link
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
                          <img
                            src={src}
                            alt=""
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
                </Link>
              ))}
            </div>
            {queuePagination.totalItems > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {queuePagination.startItem}-{queuePagination.endItem} / {queuePagination.totalItems}
                  {queuePagination.staleImageCount > 0 && (
                    <span className="ml-2 text-amber-400/80">
                      {queuePagination.staleImageCount} stale images hidden
                    </span>
                  )}
                </div>
                {queuePagination.totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Link
                      href={pageHref(Math.max(1, queuePagination.page - 1))}
                      prefetch={false}
                      className={`inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] ${queuePagination.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                    >
                      <ChevronLeft className="size-4" />
                    </Link>
                    {visiblePages.map((page, index) => {
                      const prev = visiblePages[index - 1];
                      const showGap = prev !== undefined && page - prev > 1;
                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showGap && <span className="px-1 text-zinc-600">...</span>}
                          <Link
                            href={pageHref(page)}
                            prefetch={false}
                            className={`inline-flex size-8 items-center justify-center rounded-lg border text-xs transition ${
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
                      className={`inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] ${queuePagination.page >= queuePagination.totalPages ? "pointer-events-none opacity-40" : ""}`}
                    >
                      <ChevronRight className="size-4" />
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
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 md:max-w-[500px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
                    <div className="mt-1 text-xs text-zinc-400">{run.projectTitle}：{run.sectionName}</div>
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
                        await runSection(run.sectionId);
                        toast.success(`已重新提交「${run.sectionName}」`);
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
            <div className="grid grid-cols-2 gap-3">
              <StatChip label="已删除图片" value={trashCount} tone="warn" />
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
                      onClick={() => handleRestore(item.id)}
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
