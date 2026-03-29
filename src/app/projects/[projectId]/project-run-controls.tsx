"use client";

import Link from "next/link";
import { Copy, Play } from "lucide-react";
import { useActionState } from "react";
import { copyProjectAction, runProjectAction, runSectionAction } from "@/app/projects/actions";
import { initialProjectCopyState, initialProjectRunState } from "@/app/projects/action-types";

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

type ProjectCopyButtonProps = {
  projectId: string;
};

export function ProjectCopyButton({ projectId }: ProjectCopyButtonProps) {
  const [state, formAction, pending] = useActionState(copyProjectAction, initialProjectCopyState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
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
          {pending ? "正在让后端复制这个项目..." : state.message}
        </p>
        {state.status === "success" && state.copiedProjectId ? (
          <Link
            href={`/projects/${state.copiedProjectId}/edit`}
            className="inline-flex text-xs text-sky-300"
          >
            打开复制后的草稿
          </Link>
        ) : null}
      </div>
    </form>
  );
}

type ProjectRunButtonProps = {
  projectId: string;
};

export function ProjectRunButton({ projectId }: ProjectRunButtonProps) {
  const [state, formAction, pending] = useActionState(runProjectAction, initialProjectRunState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="size-4" />
        {pending ? "正在排队整组项目..." : "运行整组"}
      </button>
      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${getFeedbackClassName(state.status)}`}>
        {pending ? "正在把整组项目提交到后端队列..." : state.message}
      </p>
    </form>
  );
}

type SectionRunButtonProps = {
  projectId: string;
  sectionId: string;
  sectionName: string;
  disabled: boolean;
};

export function SectionRunButton({ projectId, sectionId, sectionName, disabled }: SectionRunButtonProps) {
  const [state, formAction, pending] = useActionState(runSectionAction, initialProjectRunState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sectionId" value={sectionId} />
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
          ? `${sectionName} 当前已禁用，不能单独运行。`
          : pending
            ? `正在把 ${sectionName} 提交到后端队列...`
            : state.message}
      </p>
    </form>
  );
}
