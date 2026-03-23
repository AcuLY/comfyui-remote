"use client";

import Image from "next/image";
import Link from "next/link";
import { Expand, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { initialReviewMutationState, submitReviewSelectionAction } from "./review-actions";
import type { ReviewGroup } from "@/lib/types";

export function ReviewGrid({ group }: { group: ReviewGroup }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const submitAction = useMemo(() => submitReviewSelectionAction.bind(null, group.id), [group.id]);
  const [state, formAction, pending] = useActionState(submitAction, initialReviewMutationState);

  const availableIds = useMemo(() => new Set(group.images.map((image) => image.id)), [group.images]);
  const effectiveSelectedIds = state.status === "success"
    ? []
    : selectedIds.filter((imageId) => availableIds.has(imageId));
  const selectedCount = effectiveSelectedIds.length;
  const hiddenImageIds = effectiveSelectedIds.join(",");
  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  function toggleSelected(imageId: string) {
    setSelectedIds((current) => current.includes(imageId)
      ? current.filter((entry) => entry !== imageId)
      : [...current, imageId]);
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imageIds" value={hiddenImageIds} />

      <div className="grid grid-cols-3 gap-3">
        {group.images.map((image) => {
          const checked = effectiveSelectedIds.includes(image.id);

          return (
            <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel-soft)]">
              <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={pending}
                  onChange={() => toggleSelected(image.id)}
                  className="size-4 rounded border-white/20 bg-black/30"
                />
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">{image.label}</span>
              </div>
              <Link href={`/queue/${group.id}/images/${image.id}`}>
                <Image src={image.src} alt={image.id} width={400} height={560} className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" unoptimized />
              </Link>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-[10px] text-white">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5">{image.status}</span>
                <Link href={`/queue/${group.id}/images/${image.id}`} className="inline-flex items-center gap-1 text-zinc-200">
                  <Expand className="size-3" /> 查看
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="submit"
          name="action"
          value="keep"
          disabled={pending || selectedCount === 0}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "提交中..." : `批量保留${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
        <button
          type="submit"
          name="action"
          value="trash"
          disabled={pending || selectedCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="size-4" />
          {pending ? "提交中..." : `批量删除${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
      </div>

      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}>
        {pending ? `正在提交 ${selectedCount} 张图片...` : state.message}
      </p>
    </form>
  );
}
