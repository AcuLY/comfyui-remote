"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Star } from "lucide-react";

type GalleryImage = {
  id: string;
  src: string;
  full: string;
  status: string;
  featured: boolean;
  runIndex: number;
};

/**
 * Wrapper component: provides a shared featured-state across all thumbnails
 * and renders the shared lightbox overlay.
 */
export function ResultsGalleryProvider({
  allImages: initialImages,
  children,
}: {
  allImages: GalleryImage[];
  children: (ctx: {
    openLightbox: (index: number) => void;
    isFeatured: (imageId: string) => boolean;
  }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState(initialImages);
  const [toggling, setToggling] = useState(false);

  // Sync when parent re-renders with new server data
  useEffect(() => {
    setAllImages(initialImages);
  }, [initialImages]);

  const current = allImages[currentIndex];

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : allImages.length - 1));
  }, [allImages.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < allImages.length - 1 ? i + 1 : 0));
  }, [allImages.length]);

  const toggleFeatured = useCallback(async () => {
    if (!current || toggling) return;
    const newVal = !current.featured;
    setToggling(true);
    // Optimistic update
    setAllImages((prev) =>
      prev.map((img) =>
        img.id === current.id ? { ...img, featured: newVal } : img
      )
    );
    try {
      const res = await fetch(`/api/images/${current.id}/featured`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: newVal }),
      });
      if (!res.ok) {
        // Revert on failure
        setAllImages((prev) =>
          prev.map((img) =>
            img.id === current.id ? { ...img, featured: !newVal } : img
          )
        );
      }
    } catch {
      setAllImages((prev) =>
        prev.map((img) =>
          img.id === current.id ? { ...img, featured: !newVal } : img
        )
      );
    } finally {
      setToggling(false);
    }
  }, [current, toggling]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "f" || e.key === "F") toggleFeatured();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext, toggleFeatured]);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setOpen(true);
  }, []);

  const isFeatured = useCallback(
    (imageId: string) => allImages.find((img) => img.id === imageId)?.featured ?? false,
    [allImages]
  );

  return (
    <>
      {children({ openLightbox, isFeatured })}

      {open && current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          {/* Top-right: featured + close */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <button
              className={`rounded-full p-2 transition ${
                current.featured
                  ? "bg-amber-500/30 text-amber-300 hover:bg-amber-500/40"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              } ${toggling ? "opacity-50" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFeatured();
              }}
              disabled={toggling}
              title={current.featured ? "取消精选 (F)" : "标记精选 (F)"}
            >
              <Star
                className="size-5"
                fill={current.featured ? "currentColor" : "none"}
              />
            </button>
            <button
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={() => setOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Info badge */}
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
            <span>
              Run #{current.runIndex} · {currentIndex + 1}/{allImages.length}
            </span>
            {current.status === "pending" && (
              <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
                待审
              </span>
            )}
            {current.featured && (
              <span className="rounded bg-amber-400/80 px-1.5 py-0.5 text-[10px] text-white">
                精选
              </span>
            )}
          </div>

          {/* Prev */}
          {allImages.length > 1 && (
            <button
              className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative max-h-[85vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.full}
              alt=""
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>

          {/* Next */}
          {allImages.length > 1 && (
            <button
              className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
