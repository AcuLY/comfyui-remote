"use client";

import Link from "next/link";
import { Copy, Play } from "lucide-react";
import { useActionState } from "react";
import { copyJobAction, initialJobCopyState, initialJobRunState, runJobAction, runJobPositionAction } from "@/app/jobs/actions";

const idleFeedbackClassName = "border-white/10 bg-white/[0.03] text-zinc-400";
const errorFeedbackClassName = "border-rose-500/20 bg-rose-500/10 text-rose-200";
const successFeedbackClassName = "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";

function getFeedbackClassName(status: "idle" | "success" | "error") {
  if (status === "error") {
    return errorFeedbackClassName;
  }

  if (status === "success") {
    return successFeedbackClassName;
  }

  return idleFeedbackClassName;
}

type JobCopyButtonProps = {
  jobId: string;
};

export function JobCopyButton({ jobId }: JobCopyButtonProps) {
  const [state, formAction, pending] = useActionState(copyJobAction, initialJobCopyState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Copy className="size-3.5" />
        {pending ? "正在复制..." : "复制"}
      </button>
      <div className="space-y-2">
        <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${getFeedbackClassName(state.status)}`}>
          {pending ? "正在让后端复制这个任务..." : state.message}
        </p>
        {state.status === "success" && state.copiedJobId ? (
          <Link
            href={`/jobs/${state.copiedJobId}/edit`}
            className="inline-flex text-xs text-sky-300"
          >
            打开复制后的草稿
          </Link>
        ) : null}
      </div>
    </form>
  );
}

type JobRunButtonProps = {
  jobId: string;
};

export function JobRunButton({ jobId }: JobRunButtonProps) {
  const [state, formAction, pending] = useActionState(runJobAction, initialJobRunState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="size-4" />
        {pending ? "正在排队整组任务..." : "运行整组"}
      </button>
      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${getFeedbackClassName(state.status)}`}>
        {pending ? "正在把整组任务提交到后端队列..." : state.message}
      </p>
    </form>
  );
}

type PositionRunButtonProps = {
  jobId: string;
  positionId: string;
  positionName: string;
  disabled: boolean;
};

export function PositionRunButton({ jobId, positionId, positionName, disabled }: PositionRunButtonProps) {
  const [state, formAction, pending] = useActionState(runJobPositionAction, initialJobRunState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="positionId" value={positionId} />
      <button
        type="submit"
        disabled={pending || disabled}
        className="inline-flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="size-3.5" />
        {disabled ? "本节已禁用" : pending ? "排队中..." : "运行本节"}
      </button>
      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-[11px] leading-5 ${getFeedbackClassName(state.status)}`}>
        {disabled
          ? `${positionName} 当前已禁用，不能单独运行。`
          : pending
            ? `正在把 ${positionName} 提交到后端队列...`
            : state.message}
      </p>
    </form>
  );
}
