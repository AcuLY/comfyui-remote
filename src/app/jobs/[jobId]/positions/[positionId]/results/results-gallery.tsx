"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type GalleryImage = {
  id: string;
  src: string;
  full: string;
  status: string;
  runIndex: number;
};

export function ResultsGallery({
  imageIndex,
  allImages,
  children,
}: {
  imageIndex: number;
  allImages: GalleryImage[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(imageIndex);

  const current = allImages[currentIndex];

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : allImages.length - 1));
  }, [allImages.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < allImages.length - 1 ? i + 1 : 0));
  }, [allImages.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext]);

  return (
    <>
      <div
        onClick={() => {
          setCurrentIndex(imageIndex);
          setOpen(true);
        }}
      >
        {children}
      </div>

      {open && current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </button>

          {/* Info badge */}
          <div className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
            Run #{current.runIndex} · {currentIndex + 1}/{allImages.length}
            {current.status === "pending" && (
              <span className="ml-2 rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
                待审
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
            <Image
              src={current.full}
              alt=""
              width={1024}
              height={1440}
              className="max-h-[85vh] w-auto rounded-lg object-contain"
              unoptimized
              priority
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
