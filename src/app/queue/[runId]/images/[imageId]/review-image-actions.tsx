"use client";

import { useActionState, useMemo } from "react";
import { initialReviewMutationState, submitReviewSelectionAction } from "../../review-actions";

export function ReviewImageActions({ runId, imageId }: { runId: string; imageId: string }) {
  const submitAction = useMemo(() => submitReviewSelectionAction.bind(null, runId), [runId]);
  const [state, formAction, pending] = useActionState(submitAction, initialReviewMutationState);
  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="imageIds" value={imageId} />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <button
          type="submit"
          name="action"
          value="keep"
          disabled={pending}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "提交中..." : "保留"}
        </button>
        <button
          type="submit"
          name="action"
          value="trash"
          disabled={pending}
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "提交中..." : "删除"}
        </button>
      </div>

      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}>
        {pending ? "正在提交当前图片..." : state.message}
      </p>
    </form>
  );
}
