"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { keepImages, trashImages } from "@/lib/actions";

type LastAction = "keep" | "trash";

export function ImageActions({
  imageId,
  runId,
  pendingImageIds,
  nextRunId,
}: {
  imageId: string;
  runId: string;
  /** All pending image IDs in the current group (including the current one). */
  pendingImageIds: string[];
  nextRunId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const remainingIds = pendingImageIds.filter((id) => id !== imageId);

  function handleKeep() {
    startTransition(async () => {
      await keepImages([imageId]);
      setLastAction("keep");
    });
  }

  function handleTrash() {
    startTransition(async () => {
      await trashImages([imageId]);
      setLastAction("trash");
    });
  }

  function handleRestAndNext(action: LastAction) {
    startTransition(async () => {
      if (remainingIds.length > 0) {
        if (action === "keep") {
          await keepImages(remainingIds);
        } else {
          await trashImages(remainingIds);
        }
      }
      if (nextRunId) {
        router.push(`/queue/${nextRunId}`);
      } else {
        router.push("/queue");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <button
          disabled={isPending}
          onClick={handleKeep}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {isPending ? "处理中…" : "保留"}
        </button>
        <button
          disabled={isPending}
          onClick={handleTrash}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Trash2 className="size-4" />
          {isPending ? "处理中…" : "删除"}
        </button>
      </div>

      {/* 保留/删除剩余 → 跳转下一组 */}
      {lastAction && remainingIds.length > 0 && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <button
            onClick={() => handleRestAndNext("keep")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {isPending ? "处理中…" : `保留剩余 (${remainingIds.length})`}
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => handleRestAndNext("trash")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-4 py-3 text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-40"
          >
            {isPending ? "处理中…" : `删除剩余 (${remainingIds.length})`}
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
