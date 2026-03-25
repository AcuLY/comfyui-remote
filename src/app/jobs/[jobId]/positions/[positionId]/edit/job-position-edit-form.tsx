"use client";

import Link from "next/link";
import { ArrowLeft, Layers, Save } from "lucide-react";
import { useActionState } from "react";
import { saveJobPositionEditAction } from "@/app/jobs/actions";
import { initialJobSaveState } from "@/app/jobs/action-types";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import type { JobDetailPosition } from "@/lib/server-data";

type JobPositionEditFormProps = {
  jobId: string;
  position: JobDetailPosition;
  positivePrompt: string;
};

export function JobPositionEditForm({ jobId, position, positivePrompt }: JobPositionEditFormProps) {
  const [state, formAction, pending] = useActionState(saveJobPositionEditAction, initialJobSaveState);

  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="positionId" value={position.id} />

      <div className="flex items-center justify-between gap-3">
        <Link href={`/jobs/${jobId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回任务详情
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {pending ? "Saving..." : "Save Position"}
        </button>
      </div>

      <PageHeader
        title={`Edit ${position.name}`}
        description="Update the current position overrides with the backend PATCH API."
      />

      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}>
        {pending ? "Saving position changes..." : state.message}
      </p>

      <SectionCard title="Prompt Overrides" subtitle="Clear a field if you want the backend to fall back to template defaults.">
        <div className="space-y-3">
          <textarea
            name="positivePrompt"
            disabled={pending}
            className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            defaultValue={positivePrompt}
          />
          <textarea
            name="negativePrompt"
            disabled={pending}
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            defaultValue={position.promptOverview.negativePrompt ?? ""}
          />
        </div>
      </SectionCard>

      <SectionCard title="Run Parameters" subtitle="Only supported position fields are submitted from this form.">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-2">
            <div className="text-xs text-zinc-500">Aspect ratio</div>
            <input
              name="aspectRatio"
              disabled={pending}
              defaultValue={position.aspectRatio ?? ""}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            />
          </label>
          <label className="space-y-2">
            <div className="text-xs text-zinc-500">Batch size</div>
            <input
              name="batchSize"
              type="number"
              min={1}
              disabled={pending}
              defaultValue={position.batchSize ?? ""}
              className="input-number w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            />
          </label>
          <label className="col-span-2 space-y-2">
            <div className="text-xs text-zinc-500">Seed policy</div>
            <input
              name="seedPolicy"
              disabled={pending}
              defaultValue={position.seedPolicy ?? ""}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            />
          </label>
        </div>
      </SectionCard>

      <Link
        href={`/jobs/${jobId}/positions/${position.id}/blocks`}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
      >
        <Layers className="size-4" /> 管理提示词块
      </Link>
    </form>
  );
}
