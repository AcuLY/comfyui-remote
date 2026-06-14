"use client";

import { toast } from "sonner";

type RunSubmissionToastResult = {
  submission?: {
    status?: string;
    queuedRunCount?: number;
    deferredRunCount?: number;
  };
} | null | undefined;

export function showRunSubmissionToast(
  result: RunSubmissionToastResult,
  successMessage: string,
) {
  if (result?.submission?.status === "deferred") {
    const count =
      result.submission.deferredRunCount ?? result.submission.queuedRunCount ?? 0;
    toast.warning("ComfyUI 未启动，任务已加入队列", {
      description:
        count > 0
          ? `ComfyUI 可达后会自动恢复 ${count} 个任务。`
          : "ComfyUI 可达后会自动恢复任务。",
    });
    return;
  }

  toast.success(successMessage);
}
