"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  CheckSquare,
  ClipboardCheck,
  Eye,
  ImageIcon,
  Loader2,
  Play,
  Shield,
  Square,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { keepImages, trashImages, runSection, censorImage } from "@/lib/actions";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { HardNavigationLink } from "@/components/hard-navigation-link";
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
    cover: boolean;
    censoredSrc: string | null;
    censoredFull: string | null;
    censoredAt: string | null;
  }[];
};

type ResultsGalleryUndoHelpers = {
  restoreImages: (imageIds: string[]) => void;
};

export function ResultsGrid({
  runs,
  sectionId,
  initialBatchSize,
}: {
  runs: RunData[];
  sectionId: string;
  initialBatchSize: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [lastTrashedIds, setLastTrashedIds] = useState<string[]>([]);
  const [tempBatchSize, setTempBatchSize] = useState(initialBatchSize);

  const handleQuickRun = useCallback(async () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        await runSection(sectionId, tempBatchSize, { prioritize: true });
        toast.success(`已提交运行 (batch ${tempBatchSize})`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "运行失败");
      }
    });
  }, [isPending, router, sectionId, startTransition, tempBatchSize]);

  // Flatten all images for the lightbox
  const allImages = useMemo(
    () =>
      runs.flatMap((run) =>
        run.images.map((img) => ({
          ...img,
          runIndex: run.runIndex,
        })),
      ),
    [runs],
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

  const trashLatestRunImages = useCallback(() => {
    if (isPending) return;
    const latestRun = runs.reduce<RunData | null>((latest, run) => {
      if (run.images.length === 0) return latest;
      if (!latest || run.runIndex > latest.runIndex) return run;
      return latest;
    }, null);
    if (!latestRun) return;

    const imageIds = latestRun.images.map((img) => img.id);
    if (imageIds.length === 0) return;

    setLastTrashedIds(imageIds);
    startTransition(async () => {
      try {
        await trashImages(imageIds);
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }, [isPending, router, runs, startTransition]);

  // Save setLastTrashedIds to window for ResultsGalleryProvider to use
  useEffect(() => {
    (window as unknown as Record<string, (ids: string[]) => void>).__resultsGridSetLastTrashedIds = setLastTrashedIds;
    return () => {
      delete (window as unknown as Record<string, unknown>).__resultsGridSetLastTrashedIds;
    };
  }, [setLastTrashedIds]);

  // Keyboard shortcuts: page-level navigation and actions
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      // When lightbox is closed (page-level navigation)
      if (!document.querySelector("[data-results-lightbox]")) {
        // S / ArrowLeft: prev section
        if (event.key === "s" || event.key === "S" || event.key === "ArrowLeft") {
          const previousLink = document.querySelector<HTMLAnchorElement>('[data-section-nav="previous"]');
          if (!previousLink) return;
          event.preventDefault();
          previousLink.click();
          return;
        }
        // F / ArrowRight: next section
        if (event.key === "f" || event.key === "F" || event.key === "ArrowRight") {
          const nextLink = document.querySelector<HTMLAnchorElement>('[data-section-nav="next"]');
          if (!nextLink) return;
          event.preventDefault();
          nextLink.click();
          return;
        }
        // A: jump to section editor
        if (event.key === "a" || event.key === "A") {
          event.preventDefault();
          const editorLink = document.querySelector<HTMLAnchorElement>('[data-nav-editor]');
          if (editorLink) editorLink.click();
          return;
        }
        // G: go to next section with pending images
        if (event.key === "g" || event.key === "G") {
          event.preventDefault();
          const nextPendingLink = document.querySelector<HTMLAnchorElement>('[data-nav-next-pending]');
          if (nextPendingLink) nextPendingLink.click();
          return;
        }
        // 1-5: set temporary batch size
        if ("12345".includes(event.key)) {
          event.preventDefault();
          const bsMap: Record<string, number> = { "1": 1, "2": 2, "3": 4, "4": 8, "5": 16 };
          const bs = bsMap[event.key];
          if (bs !== undefined) {
            setTempBatchSize(bs);
            // Show a toast to confirm
            toast.dismiss("batch-size");
            toast(`Batch size: ${bs}`, { id: "batch-size", duration: 2000 });
          }
          return;
        }
        // N: run current section with temp batch size
        if (event.key === "n" || event.key === "N") {
          event.preventDefault();
          handleQuickRun();
          return;
        }
      }
      // I / D: toggle lightbox (works regardless of lightbox state)
      if (event.key === "i" || event.key === "I" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        const toggleLightbox = (window as unknown as Record<string, (index?: number) => void>).__resultsGalleryToggleLightbox;
        if (toggleLightbox) {
          toggleLightbox(0);
        }
      }
      if (event.key === "x" || event.key === "X") {
        if (event.repeat) return;
        event.preventDefault();
        trashLatestRunImages();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allImages.length, trashLatestRunImages, tempBatchSize, handleQuickRun]);

  // Undo function
  const handleUndo = useCallback(async ({ restoreImages }: ResultsGalleryUndoHelpers) => {
    if (lastTrashedIds.length === 0) {
      toast.error("没有可撤销的操作");
      return;
    }
    try {
      // Restore all last trashed images
      await Promise.all(
        lastTrashedIds.map(async (id) => {
          const response = await fetch(`/api/images/${encodeURIComponent(id)}/restore`, {
            method: "POST",
          });
          const result = (await response.json().catch(() => null)) as {
            ok?: boolean;
            error?: { message?: string };
          } | null;
          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error?.message ?? "撤销失败");
          }
        }),
      );
      restoreImages(lastTrashedIds);
      setLastTrashedIds([]);
      toast.success(`已撤销，恢复了 ${lastTrashedIds.length} 张图片`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤销失败");
    }
  }, [lastTrashedIds, router]);

  return (
    <ResultsGalleryProvider
      allImages={allImages}
      onUndo={handleUndo}
    >
      {({ openImageLightbox, getImage, imageCount, pendingImageCount, isFeatured, isFeatured2, isCover }) => {
        return (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-300">临时运行</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  Batch {tempBatchSize} · {imageCount} 张图片
                  {pendingImageCount > 0 ? ` · ${pendingImageCount} 张待审` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase text-zinc-500">Batch</span>
                <BatchSizeQuickFill
                  onSelect={setTempBatchSize}
                  currentValue={tempBatchSize}
                  disabled={isPending}
                  size="sm"
                />
                <button
                  type="button"
                  data-results-run-section
                  disabled={isPending}
                  onClick={handleQuickRun}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  title={isPending ? "提交中..." : "运行本节"}
                >
                  {isPending ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                  {isPending ? "提交中..." : "运行本节"}
                </button>
              </div>
            </div>
          </div>

          {runs.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              暂无运行结果
            </div>
          )}

          {/* Image grid by run */}
          {runs.map((run) => {
            const runImages = run.images
              .map((image) => getImage(image.id))
              .filter((image): image is NonNullable<ReturnType<typeof getImage>> => Boolean(image));
            const runPendingImages = runImages.filter((img) => img.status === "pending");
            const runImageIds = runImages.map((img) => img.id);
            const runSelectedIds = runImages.filter((img) => selected.has(img.id)).map((img) => img.id);
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
                  {runImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleRunSelect(runImageIds)}
                      className={`${runPendingImages.length > 0 ? "" : "ml-auto"} inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white`}
                    >
                      {isRunFullySelected ? <CheckSquare className="size-3" /> : <Square className="size-3" />}
                      {isRunFullySelected ? "取消全选" : "全选"}
                    </button>
                  )}
                  <HardNavigationLink
                    href={`/queue/${run.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 transition hover:bg-sky-500/20"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ClipboardCheck className="size-3" />
                    跳转至审核
                  </HardNavigationLink>
                </div>

                {/* Image grid */}
                {runImages.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-[11px] text-zinc-600">
                    无图片
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                    {runImages.map((img) => {
                      const featured = isFeatured(img.id);
                      const featured2 = isFeatured2(img.id);
                      const cover = isCover(img.id);
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
                          onClick={() => openImageLightbox(img.id)}
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
                          {(featured || featured2 || cover) && (
                            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                              {featured && (
                                <Star className="size-3.5 fill-amber-400 text-amber-400 drop-shadow" />
                              )}
                              {featured2 && (
                                <Eye className="size-3.5 rounded-full bg-cyan-400/90 p-0.5 text-zinc-950 shadow" />
                              )}
                              {cover && (
                                <ImageIcon className="size-3.5 rounded-full bg-violet-400/90 p-0.5 text-zinc-950 shadow" />
                              )}
                            </div>
                          )}

                          {/* Censored badge */}
                          {img.censoredAt && (
                            <div className="absolute bottom-5 right-1.5">
                              <Shield className="size-3.5 text-amber-400 drop-shadow" />
                            </div>
                          )}

                          <Image
                            src={img.src}
                            alt=""
                            width={200}
                            height={280}
                            loading="lazy"
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
                {runImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
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
                          setLastTrashedIds(ids);
                          startTransition(async () => {
                            await trashImages(ids);
                            setSelected(new Set());
                            router.refresh();
                          });
                        } else {
                          setLastTrashedIds(runSelectedIds);
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
                    <button
                      onClick={() => {
                        // Censor selected kept/pending images; without a selection, censor uncensored kept/pending images in this run.
                        const targetIds = runSelectedIds.length > 0
                          ? runImages.filter((img) => runSelectedIds.includes(img.id) && (img.status === "kept" || img.status === "pending")).map((img) => img.id)
                          : runImages.filter((img) => (img.status === "kept" || img.status === "pending") && !img.censoredAt).map((img) => img.id);
                        if (targetIds.length === 0) {
                          toast.info("没有需要打码的图片");
                          return;
                        }
                        startTransition(async () => {
                          let success = 0;
                          let failed = 0;
                          for (const id of targetIds) {
                            const result = await censorImage(id);
                            if (result.success) success++;
                            else failed++;
                          }
                          setSelected(new Set());
                          router.refresh();
                          if (failed === 0) {
                            toast.success(`已创建 ${success} 个打码任务`);
                          } else {
                            toast.error(`${success} 个成功，${failed} 个失败`);
                          }
                        });
                      }}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40"
                    >
                      <Shield className="size-3" />
                      {isPending
                        ? "处理中…"
                        : runSelectedCount > 0
                          ? `打码 (${runImages.filter((img) => runSelectedIds.includes(img.id) && (img.status === "kept" || img.status === "pending")).length})`
                          : `打码 (${runImages.filter((img) => img.status === "kept" && !img.censoredAt).length})`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        </div>
        );
      }}
    </ResultsGalleryProvider>
  );
}
