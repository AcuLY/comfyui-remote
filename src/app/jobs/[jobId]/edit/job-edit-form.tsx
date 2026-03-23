"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useActionState } from "react";
import { initialJobSaveState, saveJobEditAction } from "@/app/jobs/actions";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import type { JobDetail } from "@/lib/server-data";

type JobEditFormProps = {
  job: JobDetail;
  aspectRatioOptions: string[];
  characterLoraPath: string;
  defaultAspectRatio: string;
};

export function JobEditForm({ job, aspectRatioOptions, characterLoraPath, defaultAspectRatio }: JobEditFormProps) {
  const [state, formAction, pending] = useActionState(saveJobEditAction, initialJobSaveState);

  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="jobId" value={job.id} />

      <div className="flex items-center justify-between gap-3">
        <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> Back to Job
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {pending ? "Saving..." : "Save Job"}
        </button>
      </div>

      <PageHeader
        title={`Edit ${job.title}`}
        description="Update the current job prompts and job-level defaults with the backend PATCH API."
      />

      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}>
        {pending ? "Saving job changes..." : state.message}
      </p>

      <SectionCard title="Character / Scene / Style" subtitle="These values map directly to editable job prompt fields.">
        <div className="space-y-3 text-sm">
          <textarea
            name="characterPrompt"
            disabled={pending}
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            defaultValue={job.promptOverview.characterPrompt}
          />
          <textarea
            name="scenePrompt"
            disabled={pending}
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            defaultValue={job.promptOverview.scenePrompt}
          />
          <textarea
            name="stylePrompt"
            disabled={pending}
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            defaultValue={job.promptOverview.stylePrompt}
          />
        </div>
      </SectionCard>

      <SectionCard title="Job Defaults" subtitle="Only backend-supported job fields are submitted from this form.">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-2">
            <div className="text-xs text-zinc-500">Aspect ratio</div>
            <select
              name="aspectRatio"
              disabled={pending}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
              defaultValue={defaultAspectRatio}
            >
              <option value="">No job override</option>
              {aspectRatioOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-xs text-zinc-500">Batch size</div>
            <input
              name="batchSize"
              type="number"
              min={1}
              disabled={pending}
              defaultValue={String(job.positions[0]?.batchSize ?? "")}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            />
          </label>
          <label className="col-span-2 space-y-2">
            <div className="text-xs text-zinc-500">LoRA path</div>
            <input
              name="characterLoraPath"
              disabled={pending}
              defaultValue={characterLoraPath}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none disabled:opacity-70"
            />
          </label>
        </div>
      </SectionCard>
    </form>
  );
}
