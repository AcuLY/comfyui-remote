"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Star } from "lucide-react";
import { keepImages, trashImages } from "@/lib/actions";
import { ResultsGalleryProvider } from "./results-gallery";

const RUN_STATUS_BADGE: Record<string, string> = {
  done: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  running: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  queued: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  failed: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

type RunData = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: string;
  images: {
    id: string;
    src: string;
    full: string;
    status: string;
    featured: boolean;
  }[];
};

type LastAction = "keep" | "trash";

export function ResultsGrid({ runs }: { runs: RunData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  // Flatten all images for the lightbox
  const allImages = runs.flatMap((run) =>
    run.images.map((img) => ({
      ...img,
      runIndex: run.runIndex,
    })),
  );

  const pendingImages = allImages.filter((img) => img.status === "pending");
  const selectedCount = selected.size;

  function toggleSelect(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === allImages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allImages.map((img) => img.id)));
    }
  }

  function selectPendingOnly() {
    setSelected(new Set(pendingImages.map((img) => img.id)));
  }

  // IDs of pending images NOT in the last action's selection
  const pendingAfterAction = lastAction
    ? allImages.filter((img) => img.status === "pending").map((img) => img.id)
    : [];

  function handleKeep() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await keepImages(ids);
      setLastAction("keep");
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleTrash() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await trashImages(ids);
      setLastAction("trash");
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleRest(action: LastAction) {
    const ids = pendingAfterAction.length > 0 ? pendingAfterAction : pendingImages.map((img) => img.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      if (action === "keep") {
        await keepImages(ids);
      } else {
        await trashImages(ids);
      }
      setLastAction(null);
      router.refresh();
    });
  }

  return (
    <ResultsGalleryProvider allImages={allImages}>
      {({ openLightbox, isFeatured }) => (
        <div className="space-y-6">
          {/* Select controls */}
          {allImages.length > 0 && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <button
                onClick={selectAll}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
              >
                {selected.size === allImages.length ? "取消全选" : "全选"}
              </button>
              <button
                onClick={selectPendingOnly}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
              >
                选中待审核 ({pendingImages.length})
              </button>
              {selectedCount > 0 && (
                <span className="ml-auto text-sky-300">已选 {selectedCount} 张</span>
              )}
            </div>
          )}

          {/* Image grid by run */}
          {runs.map((run) => (
            <div key={run.id}>
              {/* Run header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  Run #{run.runIndex}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {run.createdAt}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.queued
                  }`}
                >
                  {run.status}
                </span>
              </div>

              {/* Image grid */}
              {run.images.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-[11px] text-zinc-600">
                  无图片
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                  {run.images.map((img) => {
                    const globalIndex = allImages.findIndex(
                      (a) => a.id === img.id
                    );
                    const featured = isFeatured(img.id);
                    const isSelected = selected.has(img.id);
                    return (
                      <div
                        key={img.id}
                        className={`group relative cursor-pointer overflow-hidden rounded-xl border transition ${
                          isSelected
                            ? "border-sky-400/50 ring-2 ring-sky-400/30"
                            : img.status === "kept"
                              ? "border-emerald-500/30 hover:border-sky-500/40"
                              : "border-white/10 hover:border-sky-500/40"
                        }`}
                        onClick={() => openLightbox(globalIndex)}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={(e) => toggleSelect(img.id, e)}
                          className={`absolute left-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded border transition ${
                            isSelected
                              ? "border-sky-400 bg-sky-500 text-white"
                              : "border-white/20 bg-black/30 text-transparent hover:border-white/40"
                          }`}
                        >
                          <Check className="size-3" />
                        </button>

                        {/* Featured star */}
                        {featured && (
                          <div className="absolute right-1.5 top-1.5">
                            <Star className="size-3.5 fill-amber-400 text-amber-400 drop-shadow" />
                          </div>
                        )}

                        <Image
                          src={img.src}
                          alt=""
                          width={200}
                          height={280}
                          className="aspect-[3/4] w-full object-cover"
                          unoptimized
                        />

                        {/* Status badges */}
                        {img.status === "pending" && !isSelected && (
                          <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 py-0.5 text-center text-[8px] font-medium text-white">
                            待审
                          </div>
                        )}
                        {img.status === "kept" && !isSelected && (
                          <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-0.5 text-center text-[8px] font-medium text-white">
                            保留
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Batch action buttons */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={handleKeep}
              disabled={isPending || selectedCount === 0}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {isPending ? "处理中…" : `批量保留${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
            </button>
            <button
              onClick={handleTrash}
              disabled={isPending || selectedCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
            >
              <Trash2 className="size-4" />
              {isPending ? "处理中…" : `批量删除${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
            </button>
          </div>

          {/* Handle remaining */}
          {lastAction && pendingAfterAction.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleRest("keep")}
                disabled={isPending}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-40"
              >
                {isPending ? "处理中…" : `保留剩余 (${pendingAfterAction.length})`}
              </button>
              <button
                onClick={() => handleRest("trash")}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-40"
              >
                <Trash2 className="size-4" />
                {isPending ? "处理中…" : `删除剩余 (${pendingAfterAction.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </ResultsGalleryProvider>
  );
}
