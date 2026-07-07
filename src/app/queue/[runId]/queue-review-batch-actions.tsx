"use client";

import type { Dispatch, SetStateAction, TransitionStartFunction } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { keepImages, trashImages } from "@/lib/actions/image-review";
import {
  buildTrashUndoEntry,
  type TrashUndoEntry,
} from "@/lib/review-undo-state";
import type { ReviewImage } from "@/lib/types";

type QueueReviewAction = "keep" | "trash";

type QueueReviewBatchActionsProps = {
  isPending: boolean;
  reviewImages: ReviewImage[];
  selectedIds: string[];
  selectedCount: number;
  lastAction: QueueReviewAction | null;
  remainingPendingIds: string[];
  nextRunId: string | null;
  startTransition: TransitionStartFunction;
  setTrashUndoStack: Dispatch<SetStateAction<TrashUndoEntry<ReviewImage>[]>>;
  markImagesKept: (ids: string[]) => void;
  removeImages: (ids: string[]) => void;
  removeSelectedIds: (ids: string[]) => void;
  setLastAction: Dispatch<SetStateAction<QueueReviewAction | null>>;
  navigateDocument: (href: string) => void;
  refreshRoute: () => void;
};

export function QueueReviewBatchActions({
  isPending,
  reviewImages,
  selectedIds,
  selectedCount,
  lastAction,
  remainingPendingIds,
  nextRunId,
  startTransition,
  setTrashUndoStack,
  markImagesKept,
  removeImages,
  removeSelectedIds,
  setLastAction,
  navigateDocument,
  refreshRoute,
}: QueueReviewBatchActionsProps) {
  const pendingAfterAction = lastAction
    ? reviewImages.filter((img) => img.status === "pending").map((img) => img.id)
    : [];

  function handleKeep() {
    const ids = selectedIds;
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        await keepImages(ids);
        markImagesKept(ids);
        removeSelectedIds(ids);
        setLastAction("keep");
        refreshRoute();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "保留失败");
      }
    });
  }

  function handleTrash() {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const undoEntry = buildTrashUndoEntry(reviewImages, ids);
    startTransition(async () => {
      try {
        await trashImages(ids);
        setTrashUndoStack((prev) => undoEntry ? [...prev, undoEntry] : prev);
        removeImages(ids);
        removeSelectedIds(ids);
        setLastAction("trash");
        refreshRoute();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  function handleRestAndNext(action: QueueReviewAction) {
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

  return (
    <>
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
    </>
  );
}
