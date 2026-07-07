"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Shield,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { QuickCensorCanvas } from "@/components/quick-censor-canvas";
import type { ReviewMutationAction } from "@/lib/client-review-mutation";
import type { ProjectResultsImageWithRun } from "./use-project-results-filter-state";

export function ProjectResultsLightbox({
  lightboxImage,
  lightboxIndex,
  imageCount,
  showCensoredMode,
  quickCensorMode,
  lightboxBusy,
  reviewingAction,
  onClose,
  onPrevious,
  onNext,
  onKeep,
  onTrash,
  onToggleFeatured,
  onToggleFeatured2,
  onSetCover,
  onToggleCensoredMode,
  onStartQuickCensor,
  onCancelQuickCensor,
  onFinishQuickCensor,
  onRunAutoCensor,
}: {
  lightboxImage: ProjectResultsImageWithRun;
  lightboxIndex: number;
  imageCount: number;
  showCensoredMode: boolean;
  quickCensorMode: boolean;
  lightboxBusy: boolean;
  reviewingAction: ReviewMutationAction | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onKeep: () => void;
  onTrash: () => void;
  onToggleFeatured: () => void;
  onToggleFeatured2: () => void;
  onSetCover: () => void;
  onToggleCensoredMode: () => void;
  onStartQuickCensor: () => void;
  onCancelQuickCensor: () => void;
  onFinishQuickCensor: (blob: Blob) => Promise<void>;
  onRunAutoCensor: () => void;
}) {
  const canReviewOrCensor =
    lightboxImage.status === "kept" || lightboxImage.status === "pending";

  return (
    <div
      data-project-results-lightbox
      className="fixed inset-0 z-[140] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
          <span className="truncate">
            Run #{lightboxImage.runIndex} · {lightboxIndex + 1}/{imageCount}
          </span>
          {lightboxImage.status === "pending" && (
            <span className="rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] text-white">
              待审
            </span>
          )}
          {lightboxImage.status === "kept" && (
            <span className="rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] text-white">
              保留
            </span>
          )}
          {lightboxImage.featured && (
            <span className="rounded bg-amber-400/80 px-1.5 py-0.5 text-[10px] text-white">
              p站
            </span>
          )}
          {lightboxImage.featured2 && (
            <span className="rounded bg-cyan-400/80 px-1.5 py-0.5 text-[10px] text-white">
              预览
            </span>
          )}
          {lightboxImage.cover && (
            <span className="rounded bg-violet-400/80 px-1.5 py-0.5 text-[10px] text-white">
              封面
            </span>
          )}
          {showCensoredMode && lightboxImage.censoredFull && (
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
            onClose();
          }}
          title="关闭"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="grid h-[calc(100dvh-8.5rem)] min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)_3rem] sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]">
        <button
          type="button"
          disabled={quickCensorMode || imageCount <= 1}
          className="flex h-full items-center justify-center border-r border-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/10"
          onClick={(event) => {
            event.stopPropagation();
            onPrevious();
          }}
          title="上一张"
        >
          <ChevronLeft className="size-7" />
        </button>

        <div
          className="relative flex min-w-0 items-center justify-center px-1 py-3"
          onClick={(event) => event.stopPropagation()}
        >
          {quickCensorMode ? (
            <QuickCensorCanvas
              source={lightboxImage.full}
              disabled={lightboxBusy}
              onCancel={onCancelQuickCensor}
              onComplete={onFinishQuickCensor}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={lightboxImage.id}
                src={showCensoredMode && lightboxImage.censoredFull ? lightboxImage.censoredFull : lightboxImage.full}
                alt=""
                loading="eager"
                fetchPriority="high"
                draggable={false}
                className="max-h-[calc(100dvh-11rem)] max-w-full rounded-lg object-contain"
              />
            </>
          )}
        </div>

        <button
          type="button"
          disabled={quickCensorMode || imageCount <= 1}
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
        className="z-10 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/50 p-3 sm:grid-cols-8 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={quickCensorMode || lightboxBusy}
          onClick={onKeep}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/12 px-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45"
        >
          <Check className="size-4" />
          {reviewingAction === "keep" ? "处理中..." : "保留"}
        </button>
        <button
          type="button"
          disabled={quickCensorMode || lightboxBusy}
          onClick={onTrash}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/12 px-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-45"
        >
          <Trash2 className="size-4" />
          {reviewingAction === "trash" ? "处理中..." : "删除"}
        </button>
        <button
          type="button"
          disabled={quickCensorMode || lightboxBusy}
          onClick={onToggleFeatured}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
            lightboxImage.featured
              ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
          }`}
        >
          <Star
            className="size-4"
            fill={lightboxImage.featured ? "currentColor" : "none"}
          />
          {lightboxImage.featured ? "取消p站" : "p站"}
        </button>
        <button
          type="button"
          disabled={quickCensorMode || lightboxBusy}
          onClick={onToggleFeatured2}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
            lightboxImage.featured2
              ? "border-cyan-300/35 bg-cyan-400/25 text-cyan-100 hover:bg-cyan-400/30"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-cyan-100"
          }`}
        >
          <Eye className="size-4" />
          {lightboxImage.featured2 ? "取消预览" : "预览"}
        </button>
        <button
          type="button"
          disabled={quickCensorMode || lightboxBusy || lightboxImage.cover}
          onClick={onSetCover}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
            lightboxImage.cover
              ? "border-violet-300/35 bg-violet-400/25 text-violet-100"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-violet-100"
          }`}
        >
          <ImageIcon className="size-4" />
          {lightboxImage.cover ? "封面" : "设为封面"}
        </button>
        <button
          type="button"
          disabled={quickCensorMode || !lightboxImage.censoredFull}
          onClick={onToggleCensoredMode}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-45 ${
            showCensoredMode && lightboxImage.censoredFull
              ? "border-amber-300/35 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30"
              : lightboxImage.censoredFull
                ? "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-amber-100"
                : "border-white/10 bg-white/5 text-zinc-600"
          }`}
        >
          <Shield className="size-4" />
          {showCensoredMode && lightboxImage.censoredFull
            ? "显示原图"
            : lightboxImage.censoredFull
              ? "查看打码"
              : "暂未打码"}
        </button>
        {canReviewOrCensor && (
          <button
            type="button"
            disabled={quickCensorMode || lightboxBusy}
            onClick={onStartQuickCensor}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-400/25 bg-amber-500/12 px-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-45"
          >
            <Shield className="size-4" />
            开始打码
          </button>
        )}
        {canReviewOrCensor && !lightboxImage.censoredAt && (
          <button
            type="button"
            disabled={quickCensorMode || lightboxBusy}
            onClick={onRunAutoCensor}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/12 px-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-45"
          >
            <Shield className="size-4" />
            执行打码
          </button>
        )}
      </div>
    </div>
  );
}
