"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import type { TrashItem, TrashPagination } from "@/lib/types";

type QueueTrashTabProps = {
  trashCount: number;
  trashItems: TrashItem[];
  trashPagination: TrashPagination;
  trashVisiblePages: number[];
  isPending: boolean;
  onClearTrash: () => void;
  onRestore: (item: TrashItem) => void;
  onTrashPageChange: (page: number) => void;
};

export function QueueTrashTab({
  trashCount,
  trashItems,
  trashPagination,
  trashVisiblePages,
  isPending,
  onClearTrash,
  onRestore,
  onTrashPageChange,
}: QueueTrashTabProps) {
  return (
    <>
      <SectionCard title="回收站" subtitle="已删除的图片可在此恢复到原位置。">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:w-72">
            <StatChip label="已删除图片" value={trashCount} tone="warn" />
          </div>
          <button
            type="button"
            disabled={isPending || trashCount === 0}
            onClick={onClearTrash}
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
                  onClick={() => onRestore(item)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <RotateCcw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
                  恢复
                </button>
              </div>
            ))}
          </div>
          {trashPagination.totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {trashPagination.startItem}-{trashPagination.endItem} / {trashPagination.totalItems}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={isPending || trashPagination.page <= 1}
                  onClick={() => onTrashPageChange(trashPagination.page - 1)}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                {trashVisiblePages.map((page, index) => {
                  const prev = trashVisiblePages[index - 1];
                  return (
                    <div key={page} className="flex items-center gap-1.5">
                      {prev && page - prev > 1 && (
                        <span className="px-1 text-zinc-600">…</span>
                      )}
                      <button
                        type="button"
                        disabled={isPending || page === trashPagination.page}
                        onClick={() => onTrashPageChange(page)}
                        className={`inline-flex size-7 items-center justify-center rounded-md border text-[11px] transition ${
                          page === trashPagination.page
                            ? "border-sky-500/30 bg-sky-500/20 text-sky-200"
                            : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  disabled={isPending || trashPagination.page >= trashPagination.totalPages}
                  onClick={() => onTrashPageChange(trashPagination.page + 1)}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      )}
    </>
  );
}
