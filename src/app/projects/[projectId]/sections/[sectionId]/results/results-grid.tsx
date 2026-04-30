"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, CheckSquare, ClipboardCheck, Square, Trash2 } from "lucide-react";
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
    featured2: boolean;
  }[];
};
export function ResultsGrid({ runs }: { runs: RunData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Flatten all images for the lightbox
  const allImages = runs.flatMap((run) =>
    run.images.map((img) => ({
      ...img,
      runIndex: run.runIndex,
    })),
  );

  function toggleSelect(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRunSelect(imageIds: string[]) {
    if (imageIds.length === 0) return;
    setSelected((prev) => {
      const allSelected = imageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of imageIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  return (
    <ResultsGalleryProvider allImages={allImages}>
      {({ openLightbox, isFeatured, isFeatured2 }) => (
        <div className="space-y-6">
          {/* Image grid by run */}
          {runs.map((run) => {
            const runPendingImages = run.images.filter((img) => img.status === "pending");
            const runImageIds = run.images.map((img) => img.id);
            const runSelectedIds = run.images.filter((img) => selected.has(img.id)).map((img) => img.id);
            const runSelectedCount = runSelectedIds.length;
            const isRunFullySelected = runImageIds.length > 0 && runImageIds.every((id) => selected.has(id));

            return (
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
                  {runPendingImages.length > 0 && (
                    <span className="ml-auto text-[10px] text-amber-400">
                      {runPendingImages.length} 张待审
                    </span>
                  )}
                  {run.images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleRunSelect(runImageIds)}
                      className={`${runPendingImages.length > 0 ? "" : "ml-auto"} inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white`}
                    >
                      {isRunFullySelected ? <CheckSquare className="size-3" /> : <Square className="size-3" />}
                      {isRunFullySelected ? "取消全选" : "全选"}
                    </button>
                  )}
                  <Link
                    href={`/queue/${run.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 transition hover:bg-sky-500/20"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ClipboardCheck className="size-3" />
                    跳转至审核
                  </Link>
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
                      const featured2 = isFeatured2(img.id);
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

                          {/* Featured markers */}
                          {(featured || featured2) && (
                            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                              {featured && (
                                <Star className="size-3.5 fill-amber-400 text-amber-400 drop-shadow" />
                              )}
                              {featured2 && (
                                <span className="rounded bg-cyan-400/90 px-1 py-0.5 text-[8px] font-semibold leading-none text-zinc-950 shadow">
                                  2
                                </span>
                              )}
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

                {/* Batch action buttons — one set per run */}
                {run.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (runSelectedIds.length === 0) {
                          // Quick keep: keep all pending in this run
                          const ids = runPendingImages.map((img) => img.id);
                          if (ids.length === 0) return;
                          startTransition(async () => {
                            await keepImages(ids);
                            setSelected(new Set());
                            router.refresh();
                          });
                        } else {
                          startTransition(async () => {
                            await keepImages(runSelectedIds);
                            setSelected(new Set());
                            router.refresh();
                          });
                        }
                      }}
                      disabled={isPending}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      {isPending
                        ? "处理中…"
                        : runSelectedCount > 0
                          ? `保留 (${runSelectedCount})`
                          : runPendingImages.length > 0
                            ? `全部保留 (${runPendingImages.length})`
                            : "保留"}
                    </button>
                    <button
                      onClick={() => {
                        if (runSelectedIds.length === 0) {
                          // Quick trash: trash all pending in this run
                          const ids = runPendingImages.map((img) => img.id);
                          if (ids.length === 0) return;
                          startTransition(async () => {
                            await trashImages(ids);
                            setSelected(new Set());
                            router.refresh();
                          });
                        } else {
                          startTransition(async () => {
                            await trashImages(runSelectedIds);
                            setSelected(new Set());
                            router.refresh();
                          });
                        }
                      }}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      <Trash2 className="size-3" />
                      {isPending
                        ? "处理中…"
                        : runSelectedCount > 0
                          ? `删除 (${runSelectedCount})`
                          : runPendingImages.length > 0
                            ? `全部删除 (${runPendingImages.length})`
                            : "删除"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </ResultsGalleryProvider>
  );
}
