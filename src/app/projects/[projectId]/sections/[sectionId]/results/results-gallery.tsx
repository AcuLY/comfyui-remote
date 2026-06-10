"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Eye, ImageIcon, Shield, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { censorImage } from "@/lib/actions";
import { submitReviewMutation } from "@/lib/client-review-mutation";
import {
  getLightboxPreloadCandidates,
  LIGHTBOX_PRELOAD_AHEAD,
  reconcileReviewImagesWithOptimisticReviews,
} from "@/lib/review-lightbox-state";

type GalleryImage = {
  id: string;
  src: string;
  full: string;
  status: string;
  featured: boolean;
  featured2: boolean;
  cover: boolean;
  runIndex: number;
  censoredSrc: string | null;
  censoredFull: string | null;
  censoredAt: string | null;
};

type MarkerField = "featured" | "featured2" | "cover";
type ReviewAction = "keep" | "trash";
type ResultsGalleryUndoHelpers = {
  restoreImages: (imageIds: string[]) => void;
};

export function ResultsGalleryProvider({
  allImages: initialImages,
  children,
  onUndo,
}: {
  allImages: GalleryImage[];
  children: (ctx: {
    openLightbox: (index: number) => void;
    openImageLightbox: (imageId: string) => void;
    getImage: (imageId: string) => GalleryImage | null;
    imageCount: number;
    pendingImageCount: number;
    isFeatured: (imageId: string) => boolean;
    isFeatured2: (imageId: string) => boolean;
    isCover: (imageId: string) => boolean;
  }) => ReactNode;
  onUndo?: (helpers: ResultsGalleryUndoHelpers) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState(initialImages);
  const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());
  const [togglingMarker, setTogglingMarker] = useState<MarkerField | null>(null);
  const [pendingReviewActions, setPendingReviewActions] = useState<Map<string, ReviewAction>>(new Map());
  const [showCensored, setShowCensored] = useState(false);
  const preloadedImageUrlsRef = useRef<Set<string>>(new Set());
  const preloadImagesRef = useRef<HTMLImageElement[]>([]);
  const optimisticReviewsRef = useRef<Map<string, ReviewAction>>(new Map());
  const pendingReviewIdsRef = useRef<Set<string>>(new Set());
  const knownImageByIdRef = useRef<Map<string, GalleryImage>>(new Map());
  const imageOrderByIdRef = useRef<Map<string, number>>(new Map());
  const [, startTransition] = useTransition();

  useEffect(() => {
    initialImages.forEach((image, index) => {
      knownImageByIdRef.current.set(image.id, image);
      imageOrderByIdRef.current.set(image.id, index);
    });
    setAllImages(
      reconcileReviewImagesWithOptimisticReviews(
        initialImages,
        optimisticReviewsRef.current,
      ),
    );
  }, [initialImages]);

  const current = allImages[currentIndex];
  const imageById = useMemo(
    () => new Map(allImages.map((image) => [image.id, image])),
    [allImages],
  );
  const imageIndexById = useMemo(
    () => new Map(allImages.map((image, index) => [image.id, index])),
    [allImages],
  );
  const pendingImageCount = useMemo(
    () => allImages.reduce((count, image) => count + (image.status === "pending" ? 1 : 0), 0),
    [allImages],
  );
  const imageLoaded = current ? loadedImageIds.has(current.id) : false;
  const busy = Boolean(togglingMarker);
  const currentReviewingAction = current
    ? pendingReviewActions.get(current.id) ?? null
    : null;
  const currentReviewBusy = Boolean(currentReviewingAction);

  useEffect(() => {
    if (open && allImages.length === 0) setOpen(false);
    if (currentIndex >= allImages.length) {
      setCurrentIndex(Math.max(allImages.length - 1, 0));
    }
  }, [allImages.length, currentIndex, open]);

  const markImageLoaded = useCallback((image: Pick<GalleryImage, "id" | "full">) => {
    if (image.full) {
      preloadedImageUrlsRef.current.add(image.full);
    }
    setLoadedImageIds((prev) => {
      if (prev.has(image.id)) return prev;
      const next = new Set(prev);
      next.add(image.id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!current) return;
    if (!loadedImageIds.has(current.id)) return;

    const preloadTargets = getLightboxPreloadCandidates(
      allImages,
      currentIndex,
      LIGHTBOX_PRELOAD_AHEAD,
    );

    for (const image of preloadTargets) {
      if (!image.full || preloadedImageUrlsRef.current.has(image.full)) continue;
      const preloadImage = new window.Image();
      preloadImage.decoding = "async";
      preloadImage.setAttribute("fetchpriority", "low");
      preloadImage.onload = () => markImageLoaded(image);
      preloadImage.onerror = () => markImageLoaded(image);
      preloadImage.src = image.full;
      preloadedImageUrlsRef.current.add(image.full);
      preloadImagesRef.current.push(preloadImage);
    }
  }, [allImages, current, currentIndex, loadedImageIds, markImageLoaded, open]);

  const goPrev = useCallback(() => {
    setCurrentIndex((index) => (index > 0 ? index - 1 : allImages.length - 1));
  }, [allImages.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((index) => (index < allImages.length - 1 ? index + 1 : 0));
  }, [allImages.length]);

  const setImageMarker = useCallback(
    (imageId: string, field: MarkerField, value: boolean) => {
      setAllImages((prev) =>
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

  const restoreImages = useCallback((imageIds: string[]) => {
    const uniqueImageIds = [...new Set(imageIds.filter(Boolean))];
    if (uniqueImageIds.length === 0) return;

    for (const imageId of uniqueImageIds) {
      optimisticReviewsRef.current.delete(imageId);
      pendingReviewIdsRef.current.delete(imageId);
    }

    setPendingReviewActions((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const imageId of uniqueImageIds) {
        changed = next.delete(imageId) || changed;
      }
      return changed ? next : prev;
    });

    setAllImages((prev) => {
      const nextById = new Map(prev.map((image) => [image.id, image]));
      for (const imageId of uniqueImageIds) {
        const knownImage = knownImageByIdRef.current.get(imageId);
        if (!knownImage) continue;
        nextById.set(imageId, { ...knownImage, status: "pending" });
      }

      return [...nextById.values()].sort((a, b) => {
        const aOrder = imageOrderByIdRef.current.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = imageOrderByIdRef.current.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    });
  }, []);

  const toggleMarker = useCallback(
    (field: MarkerField) => {
      if (!current || busy) return;
      if (field === "cover" && current.cover) return;

      const nextValue = field === "cover" ? true : !current[field];
      const endpoint =
        field === "featured" ? "featured" : field === "featured2" ? "featured2" : "cover";
      const body =
        field === "featured"
          ? { featured: nextValue }
          : field === "featured2"
            ? { featured2: nextValue }
            : { cover: true };
      const previousImages = allImages;

      setTogglingMarker(field);
      setImageMarker(current.id, field, nextValue);

      startTransition(async () => {
        try {
          const response = await fetch(
            `/api/images/${encodeURIComponent(current.id)}/${endpoint}`,
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
            setAllImages(previousImages);
          } else {
            setImageMarker(current.id, field, !nextValue);
          }
          toast.error(error instanceof Error ? error.message : "更新标记失败");
        } finally {
          setTogglingMarker(null);
        }
      });
    },
    [allImages, busy, current, router, setImageMarker],
  );

  function addPendingReviewAction(imageId: string, action: ReviewAction) {
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

  const reviewCurrent = useCallback(
    (action: ReviewAction, autoNext = false) => {
      if (!current || busy) return;

      const imageId = current.id;
      if (pendingReviewIdsRef.current.has(imageId)) return;

      const imageCount = allImages.length;
      const removedIndex = currentIndex;
      const previousOptimisticAction = optimisticReviewsRef.current.get(imageId);
      knownImageByIdRef.current.set(imageId, current);
      if (!imageOrderByIdRef.current.has(imageId)) {
        imageOrderByIdRef.current.set(imageId, currentIndex);
      }
      optimisticReviewsRef.current.set(imageId, action);
      addPendingReviewAction(imageId, action);

      if (action === "keep") {
        setAllImages((prev) =>
          prev.map((image) =>
            image.id === imageId ? { ...image, status: "kept" } : image,
          ),
        );
        if (autoNext && imageCount > 1) {
          goNext();
        }
      } else {
        // Record trashed image ID for undo
        const setLastTrashedIds = (window as unknown as Record<string, (ids: string[]) => void>).__resultsGridSetLastTrashedIds;
        if (setLastTrashedIds) {
          setLastTrashedIds([imageId]);
        }

        setAllImages((prev) => prev.filter((image) => image.id !== imageId));
        if (imageCount <= 1) {
          setOpen(false);
        } else {
          setCurrentIndex(Math.min(currentIndex, imageCount - 2));
        }
      }

      void submitReviewMutation(action, [imageId])
        .catch((error) => {
          if (previousOptimisticAction) {
            optimisticReviewsRef.current.set(imageId, previousOptimisticAction);
          } else {
            optimisticReviewsRef.current.delete(imageId);
          }

          if (action === "keep") {
            setAllImages((prev) =>
              prev.map((image) => (image.id === imageId ? current : image)),
            );
          } else {
            setAllImages((prev) => {
              if (prev.some((image) => image.id === imageId)) return prev;
              const next = [...prev];
              next.splice(Math.min(removedIndex, next.length), 0, current);
              return next;
            });
            setOpen(true);
          }
          toast.error(error instanceof Error ? error.message : "审核失败");
        })
        .finally(() => removePendingReviewAction(imageId));
    },
    [allImages.length, busy, current, currentIndex, goNext],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      const key = event.key;

      // Close lightbox: I / D / Escape
      if (key === "i" || key === "I" || key === "d" || key === "D") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (key === "Escape") { setOpen(false); return; }

      // Prev image: S / ArrowLeft
      if (key === "s" || key === "S" || key === "ArrowLeft") {
        event.preventDefault();
        if (allImages.length > 1) goPrev();
        return;
      }
      // Next image: F / ArrowRight
      if (key === "f" || key === "F" || key === "ArrowRight") {
        event.preventDefault();
        if (allImages.length > 1) goNext();
        return;
      }

      // Keep + advance: J / W
      if (key === "j" || key === "J" || key === "w" || key === "W") {
        event.preventDefault();
        reviewCurrent("keep", true);
        return;
      }
      // Trash + advance: K / E
      if (key === "k" || key === "K" || key === "e" || key === "E") {
        event.preventDefault();
        reviewCurrent("trash", true);
        return;
      }

      // Featured (p站): L / R
      if (key === "l" || key === "L" || key === "r" || key === "R") {
        event.preventDefault();
        toggleMarker("featured");
        return;
      }
      // Featured2 (预览): ; / T
      if (key === ";" || key === "t" || key === "T") {
        event.preventDefault();
        toggleMarker("featured2");
        return;
      }
      // Cover (封面): '
      if (key === "'") {
        event.preventDefault();
        toggleMarker("cover");
        return;
      }

      // Undo: Z (plain, no modifier)
      if ((key === "z" || key === "Z") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        if (onUndo) {
          onUndo({ restoreImages }).catch((error) => {
            toast.error(error instanceof Error ? error.message : "撤销失败");
          });
        }
        return;
      }

      // H key: toggle censored version
      if (key === "h" || key === "H") {
        event.preventDefault();
        if (current?.censoredFull) {
          setShowCensored((prev) => !prev);
        }
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allImages.length, goNext, goPrev, open, restoreImages, reviewCurrent, toggleMarker, onUndo, current]);

  // Reset censored view when navigating
  useEffect(() => {
    setShowCensored(false);
  }, [currentIndex]);

  const openLightbox = useCallback(
    (index: number) => {
      if (!allImages[index]) return;
      setCurrentIndex(index);
      setOpen(true);
    },
    [allImages],
  );

  const openImageLightbox = useCallback(
    (imageId: string) => {
      const index = imageIndexById.get(imageId);
      if (index === undefined) return;
      setCurrentIndex(index);
      setOpen(true);
    },
    [imageIndexById],
  );

  const getImage = useCallback(
    (imageId: string) => imageById.get(imageId) ?? null,
    [imageById],
  );

  const toggleLightbox = useCallback(
    (index: number = 0) => {
      if (open) {
        setOpen(false);
      } else {
        if (!allImages[index]) return;
        setCurrentIndex(index);
        setOpen(true);
      }
    },
    [open, allImages],
  );

  // Expose toggleLightbox to window for cross-component communication
  useEffect(() => {
    (window as unknown as Record<string, (index?: number) => void>).__resultsGalleryToggleLightbox = toggleLightbox;
    return () => {
      delete (window as unknown as Record<string, unknown>).__resultsGalleryToggleLightbox;
    };
  }, [toggleLightbox]);

  const reviewingAction = currentReviewingAction;

  const isFeatured = useCallback(
    (imageId: string) => imageById.get(imageId)?.featured ?? false,
    [imageById],
  );

  const isFeatured2 = useCallback(
    (imageId: string) => imageById.get(imageId)?.featured2 ?? false,
    [imageById],
  );

  const isCover = useCallback(
    (imageId: string) => imageById.get(imageId)?.cover ?? false,
    [imageById],
  );

  return (
    <>
      {children({
        openLightbox,
        openImageLightbox,
        getImage,
        imageCount: allImages.length,
        pendingImageCount,
        isFeatured,
        isFeatured2,
        isCover,
      })}

      {open && current && (
        <div
          data-results-lightbox
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div className="z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
              <span className="truncate">
                Run #{current.runIndex} / {currentIndex + 1}/{allImages.length}
              </span>
              {current.status === "pending" && (
                <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  待审
                </span>
              )}
              {current.status === "kept" && (
                <span className="rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  保留
                </span>
              )}
              {current.featured && (
                <span className="rounded bg-amber-400/80 px-1.5 py-0.5 text-[10px] text-white">
                  p站
                </span>
              )}
              {current.featured2 && (
                <span className="rounded bg-cyan-400/80 px-1.5 py-0.5 text-[10px] text-white">
                  预览
                </span>
              )}
              {current.cover && (
                <span className="rounded bg-violet-400/80 px-1.5 py-0.5 text-[10px] text-white">
                  封面
                </span>
              )}
              {showCensored && (
                <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
                  打码版
                </span>
              )}
            </div>

            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
              title="关闭"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid h-[calc(100dvh-8.5rem)] min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)_3rem] sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]">
            <button
              type="button"
              disabled={allImages.length <= 1}
              className="flex h-full items-center justify-center border-r border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              title="上一张"
            >
              <ChevronLeft className="size-7" />
            </button>

            <div
              className="relative flex min-w-0 items-center justify-center px-1 py-3"
              onClick={(event) => event.stopPropagation()}
            >
              {!imageLoaded && (
                <div className="absolute inset-3 flex items-center justify-center">
                  <div className="h-full max-h-[calc(100dvh-11rem)] w-full max-w-5xl animate-pulse rounded-lg bg-white/[0.08]" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={current.id}
                src={showCensored && current.censoredFull ? current.censoredFull : current.full}
                alt=""
                loading="eager"
                fetchPriority="high"
                onLoad={() => markImageLoaded(current)}
                onError={() => markImageLoaded(current)}
                className={`max-h-[calc(100dvh-11rem)] max-w-full rounded-lg object-contain transition-opacity duration-150 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>

            <button
              type="button"
              disabled={allImages.length <= 1}
              className="flex h-full items-center justify-center border-l border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              title="下一张"
            >
              <ChevronRight className="size-7" />
            </button>
          </div>

          <div
            className="z-10 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/50 p-3 sm:grid-cols-7 sm:px-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={busy || currentReviewBusy}
              onClick={() => reviewCurrent("keep", true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/12 px-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45"
            >
              <Check className="size-4" />
              {reviewingAction === "keep" ? "处理中..." : "保留"}
            </button>
            <button
              type="button"
              disabled={busy || currentReviewBusy}
              onClick={() => reviewCurrent("trash", true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/12 px-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-45"
            >
              <Trash2 className="size-4" />
              {reviewingAction === "trash" ? "处理中..." : "删除"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => toggleMarker("featured")}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                current.featured
                  ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
                  : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
              }`}
            >
              <Star
                className="size-4"
                fill={current.featured ? "currentColor" : "none"}
              />
              {current.featured ? "取消p站" : "p站"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => toggleMarker("featured2")}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                current.featured2
                  ? "border-cyan-300/35 bg-cyan-400/25 text-cyan-100 hover:bg-cyan-400/30"
                  : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-cyan-100"
              }`}
            >
              <Eye className="size-4" />
              {current.featured2 ? "取消预览" : "预览"}
            </button>
            <button
              type="button"
              disabled={busy || current.cover}
              onClick={() => toggleMarker("cover")}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                current.cover
                  ? "border-violet-300/35 bg-violet-400/25 text-violet-100"
                  : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-violet-100"
              }`}
            >
              <ImageIcon className="size-4" />
              {current.cover ? "封面" : "设为封面"}
            </button>
            <button
              type="button"
              disabled={!current.censoredFull}
              onClick={() => current.censoredFull && setShowCensored((prev) => !prev)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
                showCensored
                  ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
                  : current.censoredFull
                    ? "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
                    : "border-white/10 bg-white/5 text-zinc-600"
              }`}
            >
              <Shield className="size-4" />
              {showCensored ? "显示原图" : current.censoredFull ? "查看打码" : "暂未打码"}
            </button>
            {/* Single-image censor trigger */}
            {(current.status === "kept" || current.status === "pending") && !current.censoredAt && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const result = await censorImage(current.id);
                      if (result.success) {
                        toast.success(result.message);
                        router.refresh();
                      } else {
                        toast.error(result.message);
                      }
                    } catch {
                      toast.error("打码失败");
                    }
                  });
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/12 px-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-45"
              >
                <Shield className="size-4" />
                执行打码
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
