"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { QueueReviewBatchActions } from "./queue-review-batch-actions";
import { QueueReviewImageCard } from "./queue-review-image-card";
import { QueueReviewSelectionToolbar } from "./queue-review-selection-toolbar";
import { useQueueReviewKeyboardShortcuts } from "./use-queue-review-keyboard-shortcuts";
import { useQueueReviewSelection } from "./use-queue-review-selection";

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
  const refreshRoute = useCallback(() => {
    router.refresh();
  }, [router]);
  const openFirstLightboxImage = useCallback(() => {
    setLightboxIndex(0);
  }, []);

  const pendingImages = reviewImages.filter((img) => img.status === "pending");
  const {
    selected,
    selectedIds,
    selectedCount,
    allSelected,
    remainingPendingIds,
    isSelected,
    toggleSelect,
    selectAll,
    selectPending,
    removeSelectedIds,
    addSelectedIds,
  } = useQueueReviewSelection({
    reviewImages,
    pendingImages,
  });

  useEffect(() => {
    const reconciledImages = reconcileReviewImagesWithOptimisticReviews(
      images,
      optimisticReviewsRef.current,
    );

    setReviewImages(reconciledImages);
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
      removeSelectedIds(imageIds);
      setTrashUndoStack((prev) => prev.slice(0, -1));
      toast.success(`已撤销删除 ${imageIds.length} 张图片`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "撤销失败");
    } finally {
      isUndoingTrashRef.current = false;
    }
  }, [removeSelectedIds, router, trashUndoStack]);

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
        removeSelectedIds(ids);
        setLastAction("trash");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }, [isPending, removeSelectedIds, reviewImages, router, startTransition]);

  useQueueReviewKeyboardShortcuts({
    lightboxOpen: lightboxIndex !== null,
    prevRunId,
    nextRunId,
    reviewImageCount: reviewImages.length,
    navigateDocument,
    openLightbox: openFirstLightboxImage,
    onUndoTrash: handleUndoTrash,
    onTrashCurrentRun: trashCurrentRunImages,
  });

  const lightboxImage = lightboxIndex === null ? null : reviewImages[lightboxIndex] ?? null;
  const lightboxBusy = Boolean(
    togglingMarker || (lightboxImage && pendingReviewActions.has(lightboxImage.id)),
  );
  const lightboxReviewingAction = lightboxImage
    ? pendingReviewActions.get(lightboxImage.id) ?? null
    : null;

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
    [lightboxBusy, lightboxImage, removeSelectedIds, reviewImages, router, setImageMarker],
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

          if (wasSelected) addSelectedIds([imageId]);
          setLastAction(previousLastAction);
          toast.error(error instanceof Error ? error.message : "审核失败");
        })
        .finally(() => removePendingReviewAction(imageId));
    },
    [
      addSelectedIds,
      lastAction,
      lightboxImage,
      lightboxIndex,
      removeSelectedIds,
      reviewImages,
      selected,
      togglingMarker,
    ],
  );

  return (
    <div>
      {/* 全选 / 只选 pending */}
      <QueueReviewSelectionToolbar
        allSelected={allSelected}
        pendingCount={pendingImages.length}
        selectedCount={selectedCount}
        onToggleSelectAll={selectAll}
        onSelectPending={selectPending}
      />

      {/* 宫格 */}
      <div className="flex flex-wrap gap-3">
        {reviewImages.map((image, index) => {
          const selectedImage = isSelected(image.id);
          return (
            <QueueReviewImageCard
              key={image.id}
              image={image}
              index={index}
              isSelected={selectedImage}
              onToggleSelect={toggleSelect}
              onOpen={setLightboxIndex}
            />
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

      <QueueReviewBatchActions
        isPending={isPending}
        reviewImages={reviewImages}
        selectedIds={selectedIds}
        selectedCount={selectedCount}
        lastAction={lastAction}
        remainingPendingIds={remainingPendingIds}
        nextRunId={nextRunId}
        startTransition={startTransition}
        setTrashUndoStack={setTrashUndoStack}
        markImagesKept={markImagesKept}
        removeImages={removeImages}
        removeSelectedIds={removeSelectedIds}
        setLastAction={setLastAction}
        navigateDocument={navigateDocument}
        refreshRoute={refreshRoute}
      />
    </div>
  );
}
