"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { ReviewImage } from "@/lib/types";

type ReviewAction = "keep" | "trash";
type MarkerField = "featured" | "featured2";

export function ImageLightbox({
  image,
  visible,
  imageIndex,
  imageCount,
  busy,
  reviewingAction,
  onClose,
  onPrev,
  onNext,
  onReview,
  onToggleMarker,
}: {
  image: ReviewImage | null;
  visible: boolean;
  imageIndex: number;
  imageCount: number;
  busy: boolean;
  reviewingAction: ReviewAction | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReview: (action: ReviewAction) => void;
  onToggleMarker: (field: MarkerField) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const shieldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    clearTimeout(shieldTimerRef.current!);
    document.body.style.pointerEvents = "none";
    shieldTimerRef.current = setTimeout(() => {
      document.body.style.pointerEvents = "";
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    setImageLoaded(false);
  }, [image?.id, visible]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
      if (event.key === "ArrowLeft" && imageCount > 1) onPrev();
      if (event.key === "ArrowRight" && imageCount > 1) onNext();
      if (event.key === "f" || event.key === "F") onToggleMarker("featured");
      if (event.key === "2") onToggleMarker("featured2");
      if (event.key === "k" || event.key === "K") onReview("keep");
      if (event.key === "Delete" || event.key === "Backspace") onReview("trash");
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleClose,
    imageCount,
    onNext,
    onPrev,
    onReview,
    onToggleMarker,
    visible,
  ]);

  useEffect(() => {
    return () => clearTimeout(shieldTimerRef.current!);
  }, []);

  if (!visible || !image) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div className="z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
          <span className="truncate">
            {image.label} / {imageIndex + 1}/{imageCount}
          </span>
          {image.status === "pending" && (
            <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
              待审
            </span>
          )}
          {image.status === "kept" && (
            <span className="rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] text-white">
              保留
            </span>
          )}
          {image.status === "trashed" && (
            <span className="rounded bg-rose-500/80 px-1.5 py-0.5 text-[10px] text-white">
              删除
            </span>
          )}
          {image.featured && (
            <span className="rounded bg-amber-400/80 px-1.5 py-0.5 text-[10px] text-white">
              精选
            </span>
          )}
          {image.featured2 && (
            <span className="rounded bg-cyan-400/80 px-1.5 py-0.5 text-[10px] text-white">
              精选2
            </span>
          )}
        </div>

        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          onClick={(event) => {
            event.stopPropagation();
            handleClose();
          }}
          title="关闭"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="grid h-[calc(100dvh-8.5rem)] min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)_3rem] sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]">
        <button
          type="button"
          disabled={imageCount <= 1}
          className="flex h-full items-center justify-center border-r border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
          onClick={(event) => {
            event.stopPropagation();
            onPrev();
          }}
          title="上一张"
        >
          <ChevronLeft className="size-7" />
        </button>

        <div
          className="relative flex min-w-0 items-center justify-center px-2 py-3"
          onClick={(event) => event.stopPropagation()}
        >
          {!imageLoaded && (
            <div className="absolute inset-3 flex items-center justify-center">
              <div className="h-full max-h-[calc(100dvh-11rem)] w-full max-w-5xl animate-pulse rounded-lg bg-white/[0.08]" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={image.id}
            src={image.full}
            alt={image.id}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
            draggable={false}
            className={`max-h-[calc(100dvh-11rem)] max-w-full rounded-lg object-contain drop-shadow-2xl transition-opacity duration-150 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        <button
          type="button"
          disabled={imageCount <= 1}
          className="flex h-full items-center justify-center border-l border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          title="下一张"
        >
          <ChevronRight className="size-7" />
        </button>
      </div>

      <div
        className="z-10 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/50 p-3 sm:grid-cols-4 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => onReview("keep")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/12 px-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45"
        >
          <Check className="size-4" />
          {reviewingAction === "keep" ? "处理中..." : "保留"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onReview("trash")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/12 px-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-45"
        >
          <Trash2 className="size-4" />
          {reviewingAction === "trash" ? "处理中..." : "删除"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleMarker("featured")}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
            image.featured
              ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
          }`}
        >
          <Star className="size-4" fill={image.featured ? "currentColor" : "none"} />
          {image.featured ? "取消精选" : "精选"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleMarker("featured2")}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
            image.featured2
              ? "border-cyan-300/35 bg-cyan-400/25 text-cyan-100 hover:bg-cyan-400/30"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-cyan-100"
          }`}
        >
          <Star className="size-4" fill={image.featured2 ? "currentColor" : "none"} />
          {image.featured2 ? "取消精选2" : "精选2"}
        </button>
      </div>
    </div>
  );
}
