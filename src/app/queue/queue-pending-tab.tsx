"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import type { QueuePagination, QueueRun } from "@/lib/types";

type QueuePendingTabProps = {
  queueRuns: QueueRun[];
  queuePagination: QueuePagination;
  formatTimeAgo: (isoString: string | null) => string | null;
};

export function QueuePendingTab({
  queueRuns,
  queuePagination,
  formatTimeAgo,
}: QueuePendingTabProps) {
  const pendingTotal = queuePagination.totalPendingImages;
  const runTotal = queuePagination.totalItems;
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

  return (
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
  );
}
