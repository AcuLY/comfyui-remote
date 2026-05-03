"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, ChevronRight, Eye, ImageIcon, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { keepImages, trashImages } from "@/lib/actions";
import type { ReviewImage } from "@/lib/types";
import { ImageLightbox } from "./image-lightbox";

type LastAction = "keep" | "trash";
type MarkerField = "featured" | "featured2" | "cover";

export function ReviewGrid({
  images,
  nextRunId,
}: {
  images: ReviewImage[];
  nextRunId: string | null;
}) {
  const router = useRouter();
  const [reviewImages, setReviewImages] = useState<ReviewImage[]>(images);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  /** Tracks the last bulk action so we can offer the complementary "handle rest" button. */
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviewingAction, setReviewingAction] = useState<LastAction | null>(null);
  const [togglingMarker, setTogglingMarker] = useState<MarkerField | null>(null);

  useEffect(() => {
    setReviewImages(images);
    setSelected((prev) => {
      const imageIds = new Set(images.map((image) => image.id));
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

  const pendingImages = reviewImages.filter((img) => img.status === "pending");
  const selectedCount = selected.size;
  const lightboxImage = lightboxIndex === null ? null : reviewImages[lightboxIndex] ?? null;
  const lightboxBusy = isPending || Boolean(reviewingAction || togglingMarker);

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
    startTransition(async () => {
      try {
        await trashImages(ids);
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
          router.push(`/queue/${nextRunId}`);
        } else {
          router.push("/queue");
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

      setTogglingMarker(field);
      setImageMarker(imageId, field, nextValue);

      startTransition(async () => {
        try {
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

          router.refresh();
        } catch (error) {
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
      if (!lightboxImage || lightboxBusy) return;

      const imageId = lightboxImage.id;
      const removedIndex = lightboxIndex ?? 0;
      const imageCount = reviewImages.length;
      setReviewingAction(action);

      startTransition(async () => {
        try {
          if (action === "keep") {
            await keepImages([imageId]);
            markImagesKept([imageId]);
          } else {
            await trashImages([imageId]);
            removeImages([imageId]);
            if (imageCount <= 1) {
              setLightboxIndex(null);
            } else {
              setLightboxIndex(Math.min(removedIndex, imageCount - 2));
            }
          }
          removeSelectedIds([imageId]);
          setLastAction(action);
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "审核失败");
        } finally {
          setReviewingAction(null);
        }
      });
    },
    [lightboxBusy, lightboxImage, lightboxIndex, reviewImages.length, router],
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
        reviewingAction={reviewingAction}
        onClose={() => setLightboxIndex(null)}
        onPrev={goPrev}
        onNext={goNext}
        onReview={reviewLightboxImage}
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
