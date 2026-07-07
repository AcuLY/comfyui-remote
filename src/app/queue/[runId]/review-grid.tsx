"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronRight, Eye, ImageIcon, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { keepImages, trashImages } from "@/lib/actions/image-review";
import { submitReviewMutation } from "@/lib/client-review-mutation";
import {
  getLightboxPreloadCandidates,
  LIGHTBOX_PRELOAD_AHEAD,
  reconcileReviewImagesWithOptimisticReviews,
} from "@/lib/review-lightbox-state";
import {
  buildTrashUndoEntry,
  restoreTrashUndoEntry,
  type TrashUndoEntry,
} from "@/lib/review-undo-state";
import type { ReviewImage } from "@/lib/types";
import { ImageLightbox } from "./image-lightbox";

type LastAction = "keep" | "trash";
type MarkerField = "featured" | "featured2" | "cover";

export function ReviewGrid({
  images,
  prevRunId,
  nextRunId,
}: {
  images: ReviewImage[];
  prevRunId: string | null;
  nextRunId: string | null;
}) {
  const router = useRouter();
  const [reviewImages, setReviewImages] = useState<ReviewImage[]>(images);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  /** Tracks the last bulk action so we can offer the complementary "handle rest" button. */
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingReviewActions, setPendingReviewActions] = useState<Map<string, LastAction>>(new Map());
  const [togglingMarker, setTogglingMarker] = useState<MarkerField | null>(null);
  const [loadedLightboxImageIds, setLoadedLightboxImageIds] = useState<Set<string>>(new Set());
  const [trashUndoStack, setTrashUndoStack] = useState<TrashUndoEntry<ReviewImage>[]>([]);
  const optimisticReviewsRef = useRef<Map<string, LastAction>>(new Map());
  const pendingReviewIdsRef = useRef<Set<string>>(new Set());
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  const preloadImagesRef = useRef<HTMLImageElement[]>([]);
  const isUndoingTrashRef = useRef(false);

  const navigateDocument = useCallback((href: string) => {
    window.location.assign(href);
  }, []);

  useEffect(() => {
    const reconciledImages = reconcileReviewImagesWithOptimisticReviews(
      images,
      optimisticReviewsRef.current,
    );

    setReviewImages(reconciledImages);
    setSelected((prev) => {
      const imageIds = new Set(reconciledImages.map((image) => image.id));
      return new Set([...prev].filter((id) => imageIds.has(id)));
    });
  }, [images]);

  useEffect(() => {
    setLightboxIndex((index) => {
      if (index === null) return null;
      if (reviewImages.length === 0) return null;
      return Math.min(index, reviewImages.length - 1);
    });
  }, [reviewImages.length]);

  const markLightboxImageLoaded = useCallback((imageId: string, full?: string) => {
    if (full) {
      preloadedUrlsRef.current.add(full);
    }
    setLoadedLightboxImageIds((prev) => {
      if (prev.has(imageId)) return prev;
      const next = new Set(prev);
      next.add(imageId);
      return next;
    });
  }, []);

  // Preload upcoming images after the current full image has loaded.
  useEffect(() => {
    if (lightboxIndex === null) return;

    const currentLightboxImage = reviewImages[lightboxIndex];
    if (!currentLightboxImage) return;
    if (!loadedLightboxImageIds.has(currentLightboxImage.id)) return;

    const preloadTargets = getLightboxPreloadCandidates(
      reviewImages,
      lightboxIndex,
      LIGHTBOX_PRELOAD_AHEAD,
    );

    for (const img of preloadTargets) {
      if (!img.full || preloadedUrlsRef.current.has(img.full)) continue;
      const preload = new window.Image();
      preload.decoding = "async";
      preload.setAttribute("fetchpriority", "low");
      preload.onload = () => markLightboxImageLoaded(img.id, img.full);
      preload.onerror = () => markLightboxImageLoaded(img.id, img.full);
      preload.src = img.full;
      preloadedUrlsRef.current.add(img.full);
      preloadImagesRef.current.push(preload);
    }
  }, [lightboxIndex, loadedLightboxImageIds, markLightboxImageLoaded, reviewImages]);

  const handleUndoTrash = useCallback(async () => {
    if (isUndoingTrashRef.current) return;
    const undoEntry = trashUndoStack[trashUndoStack.length - 1];
    if (!undoEntry) {
      toast.error("没有可撤销的删除");
      return;
    }

    const imageIds = undoEntry.items.map((item) => item.image.id);
    isUndoingTrashRef.current = true;
    try {
      await Promise.all(
        imageIds.map(async (id) => {
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

      for (const imageId of imageIds) {
        optimisticReviewsRef.current.delete(imageId);
        pendingReviewIdsRef.current.delete(imageId);
      }
      setPendingReviewActions((prev) => {
        const next = new Map(prev);
        for (const imageId of imageIds) next.delete(imageId);
        return next;
      });
      setReviewImages((prev) => restoreTrashUndoEntry(prev, undoEntry));
      setSelected((prev) => {
        const idSet = new Set(imageIds);
        return new Set([...prev].filter((id) => !idSet.has(id)));
      });
      setTrashUndoStack((prev) => prev.slice(0, -1));
      toast.success(`已撤销删除 ${imageIds.length} 张图片`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤销失败");
    } finally {
      isUndoingTrashRef.current = false;
    }
  }, [router, trashUndoStack]);

  const trashCurrentRunImages = useCallback(() => {
    if (isPending) return;
    const ids = reviewImages
      .filter((image) => image.status !== "trashed")
      .map((image) => image.id);
    if (ids.length === 0) return;

    const undoEntry = buildTrashUndoEntry(reviewImages, ids);
    const idSet = new Set(ids);
    startTransition(async () => {
      try {
        await trashImages(ids);
        setTrashUndoStack((prev) => undoEntry ? [...prev, undoEntry] : prev);
        setReviewImages((prev) => prev.filter((image) => !idSet.has(image.id)));
        setSelected((prev) => new Set([...prev].filter((id) => !idSet.has(id))));
        setLastAction("trash");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }, [isPending, reviewImages, router, startTransition]);

  // Page-level shortcuts (lightbox closed)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (lightboxIndex !== null) return; // lightbox handles its own keys
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key;
      // S / ArrowLeft: prev group
      if (key === "s" || key === "S" || key === "ArrowLeft") {
        event.preventDefault();
        if (prevRunId) navigateDocument(`/queue/${prevRunId}`);
        return;
      }
      // F / ArrowRight: next group
      if (key === "f" || key === "F" || key === "ArrowRight") {
        event.preventDefault();
        if (nextRunId) navigateDocument(`/queue/${nextRunId}`);
        return;
      }
      // A: jump to section editor
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        const editorLink = document.querySelector<HTMLAnchorElement>('[data-nav-editor]');
        if (editorLink) editorLink.click();
        return;
      }
      // 1-5: set rerun batch size
      if ("12345".includes(event.key)) {
        event.preventDefault();
        const bsMap: Record<string, number> = { "1": 1, "2": 2, "3": 4, "4": 8, "5": 16 };
        const bs = bsMap[event.key];
        if (bs !== undefined) {
          const batchButton = document.querySelector<HTMLButtonElement>(`[data-batch-size="${bs}"]`);
          if (batchButton) {
            batchButton.click();
            toast.dismiss("batch-size");
            toast(`Batch size: ${bs}`, { id: "batch-size", duration: 2000 });
          }
        }
        return;
      }
      // N: rerun current section
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        const runButton = document.querySelector<HTMLButtonElement>('[data-queue-run-section]');
        if (runButton) runButton.click();
        return;
      }
      // I / D: open lightbox
      if (key === "i" || key === "I" || key === "d" || key === "D") {
        event.preventDefault();
        if (reviewImages.length > 0) setLightboxIndex(0);
        return;
      }
      // Z: undo last trash batch
      if ((key === "z" || key === "Z") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        handleUndoTrash();
        return;
      }
      // X: trash current queue group
      if (event.key === "x" || event.key === "X") {
        if (event.repeat) return;
        event.preventDefault();
        trashCurrentRunImages();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndoTrash, lightboxIndex, navigateDocument, prevRunId, nextRunId, reviewImages.length, trashCurrentRunImages]);

  const pendingImages = reviewImages.filter((img) => img.status === "pending");
  const selectedCount = selected.size;
  const lightboxImage = lightboxIndex === null ? null : reviewImages[lightboxIndex] ?? null;
  const lightboxBusy = Boolean(
    togglingMarker || (lightboxImage && pendingReviewActions.has(lightboxImage.id)),
  );
  const lightboxReviewingAction = lightboxImage
    ? pendingReviewActions.get(lightboxImage.id) ?? null
    : null;

  /** IDs of images that are still pending **and** were NOT part of the last action selection. */
  const remainingPendingIds = pendingImages
    .filter((img) => !selected.has(img.id))
    .map((img) => img.id);

  const pendingAfterAction = lastAction
    ? reviewImages.filter((img) => img.status === "pending").map((img) => img.id)
    : [];

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === reviewImages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reviewImages.map((img) => img.id)));
    }
  }

  function removeSelectedIds(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function markImagesKept(ids: string[]) {
    const idSet = new Set(ids);
    setReviewImages((prev) =>
      prev.map((image) =>
        idSet.has(image.id) ? { ...image, status: "kept" } : image,
      ),
    );
  }

  function removeImages(ids: string[]) {
    const idSet = new Set(ids);
    setReviewImages((prev) => prev.filter((image) => !idSet.has(image.id)));
  }

  function addPendingReviewAction(imageId: string, action: LastAction) {
    pendingReviewIdsRef.current.add(imageId);
    setPendingReviewActions((prev) => {
      const next = new Map(prev);
      next.set(imageId, action);
      return next;
    });
  }

  function removePendingReviewAction(imageId: string) {
    pendingReviewIdsRef.current.delete(imageId);
    setPendingReviewActions((prev) => {
      if (!prev.has(imageId)) return prev;
      const next = new Map(prev);
      next.delete(imageId);
      return next;
    });
  }

  function handleKeep() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        await keepImages(ids);
        markImagesKept(ids);
        removeSelectedIds(ids);
        setLastAction("keep");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "保留失败");
      }
    });
  }

  function handleTrash() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const undoEntry = buildTrashUndoEntry(reviewImages, ids);
    startTransition(async () => {
      try {
        await trashImages(ids);
        setTrashUndoStack((prev) => undoEntry ? [...prev, undoEntry] : prev);
        removeImages(ids);
        removeSelectedIds(ids);
        setLastAction("trash");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  /** Handle the remaining pending images with the complementary action and navigate to the next group. */
  function handleRestAndNext(action: LastAction) {
    startTransition(async () => {
      const ids = pendingAfterAction.length > 0 ? pendingAfterAction : remainingPendingIds;
      try {
        if (ids.length > 0) {
          if (action === "keep") {
            await keepImages(ids);
          } else {
            await trashImages(ids);
          }
        }
        if (nextRunId) {
          navigateDocument(`/queue/${nextRunId}`);
        } else {
          navigateDocument("/queue");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "处理失败");
      }
    });
  }

  const goPrev = useCallback(() => {
    setLightboxIndex((index) => {
      if (index === null || reviewImages.length === 0) return index;
      return index > 0 ? index - 1 : reviewImages.length - 1;
    });
  }, [reviewImages.length]);

  const goNext = useCallback(() => {
    setLightboxIndex((index) => {
      if (index === null || reviewImages.length === 0) return index;
      return index < reviewImages.length - 1 ? index + 1 : 0;
    });
  }, [reviewImages.length]);

  const setImageMarker = useCallback(
    (imageId: string, field: MarkerField, value: boolean) => {
      setReviewImages((prev) =>
        prev.map((image) => {
          if (field === "cover") {
            return {
              ...image,
              cover: image.id === imageId ? value : value ? false : image.cover,
            };
          }
          return image.id === imageId ? { ...image, [field]: value } : image;
        }),
      );
    },
    [],
  );

  const toggleLightboxMarker = useCallback(
    (field: MarkerField) => {
      if (!lightboxImage || lightboxBusy) return;
      if (field === "cover" && lightboxImage.cover) return;

      const imageId = lightboxImage.id;
      const nextValue = field === "cover" ? true : !lightboxImage[field];
      const endpoint =
        field === "featured" ? "featured" : field === "featured2" ? "featured2" : "cover";
      const body =
        field === "featured"
          ? { featured: nextValue }
          : field === "featured2"
            ? { featured2: nextValue }
            : { cover: true };
      const previousImages = reviewImages;
      const previousOptimisticAction = optimisticReviewsRef.current.get(imageId);

      setTogglingMarker(field);
      setImageMarker(imageId, field, nextValue);

      startTransition(async () => {
        try {
          // 1. Toggle the marker
          const response = await fetch(
            `/api/images/${encodeURIComponent(imageId)}/${endpoint}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          const result = (await response.json().catch(() => null)) as {
            ok?: boolean;
            error?: { message?: string };
          } | null;

          if (!response.ok || result?.ok === false) {
            throw new Error(result?.error?.message ?? "更新标记失败");
          }

          // 2. Also keep the image
          optimisticReviewsRef.current.set(imageId, "keep");
          await keepImages([imageId]);
          markImagesKept([imageId]);
          removeSelectedIds([imageId]);
          setLastAction("keep");
          router.refresh();
        } catch (error) {
          if (previousOptimisticAction) {
            optimisticReviewsRef.current.set(imageId, previousOptimisticAction);
          } else {
            optimisticReviewsRef.current.delete(imageId);
          }
          if (field === "cover") {
            setReviewImages(previousImages);
          } else {
            setImageMarker(imageId, field, !nextValue);
          }
          toast.error(error instanceof Error ? error.message : "更新标记失败");
        } finally {
          setTogglingMarker(null);
        }
      });
    },
    [lightboxBusy, lightboxImage, reviewImages, router, setImageMarker],
  );

  const reviewLightboxImage = useCallback(
    (action: LastAction) => {
      if (!lightboxImage || togglingMarker) return;

      const imageId = lightboxImage.id;
      if (pendingReviewIdsRef.current.has(imageId)) return;

      const removedIndex = lightboxIndex ?? 0;
      const imageCount = reviewImages.length;
      const previousLastAction = lastAction;
      const previousOptimisticAction = optimisticReviewsRef.current.get(imageId);
      const wasSelected = selected.has(imageId);
      const undoEntry = action === "trash" ? buildTrashUndoEntry(reviewImages, [imageId]) : null;
      optimisticReviewsRef.current.set(imageId, action);
      addPendingReviewAction(imageId, action);

      if (action === "keep") {
        markImagesKept([imageId]);
        // Auto-advance to next image after keep (matching section results behavior)
        if (imageCount > 1) {
          setLightboxIndex((idx) =>
            idx !== null ? (idx < imageCount - 1 ? idx + 1 : 0) : idx,
          );
        }
      } else {
        removeImages([imageId]);
        if (imageCount <= 1) {
          setLightboxIndex(null);
        } else {
          setLightboxIndex(Math.min(removedIndex, imageCount - 2));
        }
      }
      removeSelectedIds([imageId]);
      setLastAction(action);

      void submitReviewMutation(action, [imageId])
        .then(() => {
          if (action === "trash") {
            setTrashUndoStack((prev) => undoEntry ? [...prev, undoEntry] : prev);
          }
        })
        .catch((error) => {
          if (previousOptimisticAction) {
            optimisticReviewsRef.current.set(imageId, previousOptimisticAction);
          } else {
            optimisticReviewsRef.current.delete(imageId);
          }
          if (action === "keep") {
            setReviewImages((prev) =>
              prev.map((image) => (image.id === imageId ? lightboxImage : image)),
            );
          } else {
            setReviewImages((prev) => {
              if (prev.some((image) => image.id === imageId)) return prev;
              const next = [...prev];
              next.splice(Math.min(removedIndex, next.length), 0, lightboxImage);
              return next;
            });
          }

          if (wasSelected) {
            setSelected((prev) => new Set(prev).add(imageId));
          }
          setLastAction(previousLastAction);
          toast.error(error instanceof Error ? error.message : "审核失败");
        })
        .finally(() => removePendingReviewAction(imageId));
    },
    [lastAction, lightboxImage, lightboxIndex, reviewImages, selected, togglingMarker],
  );

  return (
    <div>
      {/* 全选 / 只选 pending */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={selectAll}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
        >
          {selected.size === reviewImages.length ? "取消全选" : "全选"}
        </button>
        <button
          type="button"
          onClick={() =>
            setSelected(new Set(pendingImages.map((img) => img.id)))
          }
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
        >
          选中待审核 ({pendingImages.length})
        </button>
        {selectedCount > 0 && (
          <span className="ml-auto text-sky-300">已选 {selectedCount} 张</span>
        )}
      </div>

      {/* 宫格 */}
      <div className="flex flex-wrap gap-3">
        {reviewImages.map((image, index) => {
          const isSelected = selected.has(image.id);
          return (
            <div
              key={image.id}
              className={`group relative w-fit max-w-full overflow-hidden rounded-2xl border bg-[var(--panel-soft)] transition ${isSelected ? "border-sky-400/50 ring-2 ring-sky-400/30" : "border-white/10"}`}
            >
              <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelect(image.id)}
                  className={`flex size-5 items-center justify-center rounded border text-[10px] transition ${isSelected ? "border-sky-400 bg-sky-500 text-white" : "border-white/20 bg-black/30 text-transparent hover:border-white/40"}`}
                >
                  <Check className="size-3" />
                </button>
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
                  {image.label}
                </span>
              </div>

              {(image.featured || image.featured2 || image.cover) && (
                <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
                  {image.featured && (
                    <Star className="size-4 fill-amber-400 text-amber-400 drop-shadow" />
                  )}
                  {image.featured2 && (
                    <Eye className="size-4 rounded-full bg-cyan-400/90 p-0.5 text-zinc-950 shadow" />
                  )}
                  {image.cover && (
                    <ImageIcon className="size-4 rounded-full bg-violet-400/90 p-0.5 text-zinc-950 shadow" />
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="block h-40 max-w-full bg-[var(--panel-soft)]"
              >
                <Image
                  src={image.src}
                  alt={image.id}
                  width={400}
                  height={560}
                  loading="lazy"
                  className="h-40 w-auto max-w-full object-contain"
                  unoptimized
                />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-[10px] text-white">
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    image.status === "kept"
                      ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                      : image.status === "trashed"
                        ? "border-rose-500/30 bg-rose-500/20 text-rose-300"
                        : "border-white/10 bg-black/30"
                  }`}
                >
                  {image.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <ImageLightbox
        image={lightboxImage}
        visible={lightboxIndex !== null && Boolean(lightboxImage)}
        imageIndex={lightboxIndex ?? 0}
        imageCount={reviewImages.length}
        busy={lightboxBusy}
        reviewingAction={lightboxReviewingAction}
        preloadedImageIds={loadedLightboxImageIds}
        onImageLoaded={(imageId) => {
          const loadedImage = reviewImages.find((image) => image.id === imageId);
          markLightboxImageLoaded(imageId, loadedImage?.full);
        }}
        onClose={() => setLightboxIndex(null)}
        onPrev={goPrev}
        onNext={goNext}
        onReview={reviewLightboxImage}
        onUndo={handleUndoTrash}
        onToggleMarker={toggleLightboxMarker}
      />

      {/* 操作按钮 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleKeep}
          disabled={isPending || selectedCount === 0}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {isPending ? "处理中…" : `批量保留${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
        <button
          type="button"
          onClick={handleTrash}
          disabled={isPending || selectedCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
        >
          <Trash2 className="size-4" />
          {isPending ? "处理中…" : `批量删除${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
      </div>

      {/* 保留/删除剩余 → 跳转下一组 */}
      {lastAction && pendingAfterAction.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleRestAndNext("keep")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {isPending ? "处理中…" : `保留剩余 (${pendingAfterAction.length})`}
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handleRestAndNext("trash")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-40"
          >
            {isPending ? "处理中…" : `删除剩余 (${pendingAfterAction.length})`}
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
