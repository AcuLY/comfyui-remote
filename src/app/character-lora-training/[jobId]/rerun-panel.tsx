"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { CANONICAL_VIEW_SPECS } from "@/lib/character-lora-canonical-views";
import { ArtifactThumbCompact } from "./shared-ui";
import { WorkflowActionForm } from "./workflow-action-form";
import type { WorkflowActionResult } from "./workflow-actions";

export type RerunBaseImage = {
  id: string;
  version: number;
  canonicalView: string | null;
  artifactId: string;
  relativePath: string;
  sha256: string;
};

type RerunPanelProps = {
  baseImages: RerunBaseImage[];
  onRemoveImage: (id: string) => void;
  onClear: () => void;
  jobId: string;
  rerunAction: (formData: FormData) => Promise<WorkflowActionResult>;
};

export function RerunPanel({
  baseImages,
  onRemoveImage,
  onClear,
  jobId,
  rerunAction,
}: RerunPanelProps) {
  const [canonicalView, setCanonicalView] = useState<string>("front");
  const [submitted, setSubmitted] = useState(false);

  // Auto-select canonical view from first base image
  useEffect(() => {
    if (baseImages.length > 0 && baseImages[0].canonicalView) {
      setCanonicalView(baseImages[0].canonicalView);
    }
  }, [baseImages]);

  // Clear after successful submission
  useEffect(() => {
    if (submitted) {
      onClear();
      setSubmitted(false);
    }
  }, [submitted, onClear]);

  if (baseImages.length === 0) return null;

  const firstImage = baseImages[0];

  const wrappedAction = async (formData: FormData): Promise<WorkflowActionResult> => {
    const result = await rerunAction(formData);
    if (result.ok) {
      setSubmitted(true);
    }
    return result;
  };

  return (
    <div className="rounded-lg border border-violet-400/20 bg-violet-500/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-violet-200">重生面板</h3>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
        >
          <X className="size-3" />
          清除
        </button>
      </div>

      {/* Base images horizontal strip */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {baseImages.map((img) => (
          <div key={img.id} className="group relative flex-none" style={{ width: "56px" }}>
            <div className="overflow-hidden rounded-md ring-1 ring-violet-400/30">
              <ArtifactThumbCompact
                jobId={jobId}
                relativePath={img.relativePath}
                alt={`v${img.version}`}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemoveImage(img.id)}
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-black/80 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-white"
            >
              <X className="size-2.5" />
            </button>
            <div className="mt-0.5 text-center text-[9px] tabular-nums text-zinc-500">
              v{img.version}
            </div>
          </div>
        ))}
      </div>

      {/* Rerun form */}
      <WorkflowActionForm
        action={wrappedAction}
        submitLabel="重生入队"
        pendingLabel="入队中"
        successMessage="重生任务已入队"
        disabled={!firstImage.relativePath || !firstImage.sha256}
        className="space-y-2"
        buttonClassName="h-7 w-full rounded-md bg-violet-500 px-2 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Hidden inputs for the first base image's artifact */}
        <input type="hidden" name="artifactId" value={firstImage.artifactId} />
        <input type="hidden" name="relativePath" value={firstImage.relativePath} />
        <input type="hidden" name="sha256" value={firstImage.sha256} />

        {/* Additional base images as canonicalVersionIds */}
        {baseImages.slice(1).map((img) => (
          <input key={img.id} type="hidden" name="canonicalVersionIds" value={img.id} />
        ))}

        {/* Canonical view select */}
        <label className="block text-[11px] text-zinc-400">
          目标角度
          <select
            name="canonicalView"
            value={canonicalView}
            onChange={(e) => setCanonicalView(e.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none transition focus:border-violet-400"
          >
            {CANONICAL_VIEW_SPECS.map((view) => (
              <option key={view.key} value={view.key}>
                {view.label}
              </option>
            ))}
          </select>
        </label>

        {/* Provider select */}
        <label className="block text-[11px] text-zinc-400">
          生成器
          <select
            name="provider"
            defaultValue="openai-codex"
            className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none transition focus:border-violet-400"
          >
            <option value="openai-codex">openai-codex</option>
            <option value="mock-local">mock-local</option>
          </select>
        </label>

        {/* Reference image upload */}
        <label className="block text-[11px] text-zinc-400">
          额外参考图（可选）
          <input
            type="file"
            name="referenceFiles"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none file:mr-2 file:rounded file:border-0 file:bg-violet-500/20 file:px-2 file:py-0.5 file:text-[10px] file:text-violet-200"
          />
        </label>

        {/* User instruction (required) */}
        <textarea
          name="userInstruction"
          rows={2}
          required
          placeholder="说明要调整的地方..."
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-violet-400"
        />

        {/* Negative prompt */}
        <input
          name="negativePrompt"
          placeholder="负面提示词（可选）"
          className="w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-[11px] text-zinc-200 outline-none transition focus:border-violet-400"
        />
      </WorkflowActionForm>
    </div>
  );
}
