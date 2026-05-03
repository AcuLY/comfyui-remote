"use client";

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Eye, ImageIcon, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { keepImages, trashImages } from "@/lib/actions";

type GalleryImage = {
  id: string;
  src: string;
  full: string;
  status: string;
  featured: boolean;
  featured2: boolean;
  cover: boolean;
  runIndex: number;
};

type MarkerField = "featured" | "featured2" | "cover";
type ReviewAction = "keep" | "trash";

export function ResultsGalleryProvider({
  allImages: initialImages,
  children,
}: {
  allImages: GalleryImage[];
  children: (ctx: {
    openLightbox: (index: number) => void;
    isFeatured: (imageId: string) => boolean;
    isFeatured2: (imageId: string) => boolean;
    isCover: (imageId: string) => boolean;
  }) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState(initialImages);
  const [loadedImageId, setLoadedImageId] = useState<string | null>(null);
  const [togglingMarker, setTogglingMarker] = useState<MarkerField | null>(null);
  const [reviewingAction, setReviewingAction] = useState<ReviewAction | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setAllImages(initialImages);
  }, [initialImages]);

  const current = allImages[currentIndex];
  const imageLoaded = current ? loadedImageId === current.id : false;
  const busy = Boolean(togglingMarker || reviewingAction);

  useEffect(() => {
    if (open && allImages.length === 0) setOpen(false);
    if (currentIndex >= allImages.length) {
      setCurrentIndex(Math.max(allImages.length - 1, 0));
    }
  }, [allImages.length, currentIndex, open]);

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

  const reviewCurrent = useCallback(
    (action: ReviewAction) => {
      if (!current || busy) return;

      const imageId = current.id;
      const removedIndex = currentIndex;
      const imageCount = allImages.length;
      setReviewingAction(action);

      startTransition(async () => {
        try {
          if (action === "keep") {
            await keepImages([imageId]);
            setAllImages((prev) =>
              prev.map((image) =>
                image.id === imageId ? { ...image, status: "kept" } : image,
              ),
            );
          } else {
            await trashImages([imageId]);
            setAllImages((prev) => prev.filter((image) => image.id !== imageId));
            if (imageCount <= 1) {
              setOpen(false);
            } else {
              setCurrentIndex(Math.min(removedIndex, imageCount - 2));
            }
          }
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "审核失败");
        } finally {
          setReviewingAction(null);
        }
      });
    },
    [allImages.length, busy, current, currentIndex, router],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft" && allImages.length > 1) goPrev();
      if (event.key === "ArrowRight" && allImages.length > 1) goNext();
      if (event.key === "f" || event.key === "F") toggleMarker("featured");
      if (event.key === "2") toggleMarker("featured2");
      if (event.key === "c" || event.key === "C") toggleMarker("cover");
      if (event.key === "k" || event.key === "K") reviewCurrent("keep");
      if (event.key === "Delete" || event.key === "Backspace") reviewCurrent("trash");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allImages.length, goNext, goPrev, open, reviewCurrent, toggleMarker]);

  const openLightbox = useCallback(
    (index: number) => {
      if (!allImages[index]) return;
      setCurrentIndex(index);
      setOpen(true);
    },
    [allImages],
  );

  const isFeatured = useCallback(
    (imageId: string) => allImages.find((img) => img.id === imageId)?.featured ?? false,
    [allImages],
  );

  const isFeatured2 = useCallback(
    (imageId: string) => allImages.find((img) => img.id === imageId)?.featured2 ?? false,
    [allImages],
  );

  const isCover = useCallback(
    (imageId: string) => allImages.find((img) => img.id === imageId)?.cover ?? false,
    [allImages],
  );

  return (
    <>
      {children({ openLightbox, isFeatured, isFeatured2, isCover })}

      {open && current && (
        <div
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
                src={current.full}
                alt=""
                onLoad={() => setLoadedImageId(current.id)}
                onError={() => setLoadedImageId(current.id)}
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
            className="z-10 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/50 p-3 sm:grid-cols-5 sm:px-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => reviewCurrent("keep")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/12 px-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45"
            >
              <Check className="size-4" />
              {reviewingAction === "keep" ? "处理中..." : "保留"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => reviewCurrent("trash")}
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
          </div>
        </div>
      )}
    </>
  );
}
