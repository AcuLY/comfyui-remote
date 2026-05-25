"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { CANONICAL_VIEW_SPECS } from "@/lib/character-lora-canonical-views";
import { ArtifactThumbCompact } from "./shared-ui";
import { WorkflowActionForm } from "./workflow-action-form";
import type { WorkflowActionResult } from "./workflow-actions";

export type GenerationBaseImage = {
  id: string;
  label: string;
  relativePath: string;
  // Canonical variant fields
  artifactId?: string;
  sha256?: string;
  canonicalView?: string | null;
  // Section variant fields
  generationRunId?: string;
};

type GenerationPanelProps = {
  /** "canonical" for persona-reference page; "section" for section detail page */
  variant?: "canonical" | "section";
  baseImages: GenerationBaseImage[];
  onRemoveImage: (id: string) => void;
  onClear: () => void;
  jobId: string;
  sourceImages?: Array<{ id: string; relativePath: string | null }>;
  enqueueAction: (formData: FormData) => Promise<WorkflowActionResult>;
  rerunAction: (formData: FormData) => Promise<WorkflowActionResult>;
  disabled: boolean;
  disabledReason?: string;
};

export function GenerationPanel({
  variant = "canonical",
  baseImages,
  onRemoveImage,
  onClear,
  jobId,
  sourceImages = [],
  enqueueAction,
  rerunAction,
  disabled,
  disabledReason,
}: GenerationPanelProps) {
  const [canonicalView, setCanonicalView] = useState<string>("front");
  const [submitted, setSubmitted] = useState(false);

  const isRerunMode = baseImages.length > 0;
  const isCanonical = variant === "canonical";

  // Auto-select canonical view from first base image (canonical variant only)
  useEffect(() => {
    if (isCanonical && baseImages.length > 0 && baseImages[0].canonicalView) {
      setCanonicalView(baseImages[0].canonicalView);
    }
  }, [baseImages, isCanonical]);

  // Clear base images after successful rerun submission
  useEffect(() => {
    if (submitted) {
      onClear();
      setSubmitted(false);
    }
  }, [submitted, onClear]);

  const firstImage = baseImages[0] ?? null;

  const wrappedRerunAction = async (formData: FormData): Promise<WorkflowActionResult> => {
    const result = await rerunAction(formData);
    if (result.ok) {
      setSubmitted(true);
    }
    return result;
  };

  // Determine if rerun submit should be disabled
  const rerunDisabled = isCanonical
    ? (!firstImage?.artifactId || !firstImage?.sha256)
    : (!firstImage?.generationRunId);

  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-500/[0.03] p-3">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImagePlus className="size-4 text-sky-300" />
          <h3 className="text-sm font-semibold text-zinc-100">生图</h3>
          {isRerunMode && (
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
              基于已有图
            </span>
          )}
        </div>
        {isRerunMode && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <X className="size-3" />
            清除基底
          </button>
        )}
      </div>

      {/* Base images (shown when in rerun mode) */}
      {isRerunMode && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {baseImages.map((img) => (
            <div key={img.id} className="group relative flex-none" style={{ width: "56px" }}>
              <div className="overflow-hidden rounded-md ring-1 ring-violet-400/30">
                <ArtifactThumbCompact
                  jobId={jobId}
                  relativePath={img.relativePath}
                  alt={img.label}
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
                {img.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form: different action based on mode */}
      <WorkflowActionForm
        action={isRerunMode ? wrappedRerunAction : enqueueAction}
        submitLabel={isRerunMode ? "重生入队" : "生成入队"}
        pendingLabel="入队中"
        successMessage={isRerunMode ? "重生任务已入队" : "生图任务已入队"}
        disabled={isRerunMode ? rerunDisabled : disabled}
        className="space-y-2"
        buttonClassName="h-8 w-full rounded-md bg-sky-500 px-3 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Hidden inputs for rerun mode */}
        {isRerunMode && firstImage && isCanonical && (
          <>
            <input type="hidden" name="artifactId" value={firstImage.artifactId ?? ""} />
            <input type="hidden" name="relativePath" value={firstImage.relativePath} />
            <input type="hidden" name="sha256" value={firstImage.sha256 ?? ""} />
            {baseImages.slice(1).map((img) => (
              <input key={img.id} type="hidden" name="canonicalVersionIds" value={img.id} />
            ))}
          </>
        )}
        {isRerunMode && firstImage && !isCanonical && (
          <>
            <input type="hidden" name="parentRunId" value={firstImage.generationRunId ?? ""} />
            {baseImages.map((img) => (
              <input key={img.id} type="hidden" name="previousCandidateImageIds" value={img.id} />
            ))}
          </>
        )}

        {/* Row: view selector (canonical only) + provider */}
        <div className={`grid gap-2 ${isCanonical ? "sm:grid-cols-2" : ""}`}>
          {isCanonical && (
            <label className="block text-[11px] text-zinc-400">
              目标角度
              <select
                name="canonicalView"
                value={canonicalView}
                onChange={(e) => setCanonicalView(e.target.value)}
                className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none transition focus:border-sky-400"
              >
                {CANONICAL_VIEW_SPECS.map((view) => (
                  <option key={view.key} value={view.key}>
                    {view.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-[11px] text-zinc-400">
            生成器
            <select
              name="provider"
              defaultValue="openai-codex"
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none transition focus:border-sky-400"
            >
              <option value="openai-codex">openai-codex</option>
              <option value="mock-local">mock-local</option>
            </select>
          </label>
        </div>

        {/* Reference image upload */}
        <label className="block text-[11px] text-zinc-400">
          参考图上传（可选）
          <input
            type="file"
            name="referenceFiles"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none file:mr-2 file:rounded file:border-0 file:bg-sky-500/20 file:px-2 file:py-0.5 file:text-[10px] file:text-sky-200"
          />
        </label>

        {/* Text inputs: differ by variant and mode */}
        {isCanonical && !isRerunMode && (
          <>
            <textarea
              name="characterDescription"
              rows={2}
              placeholder="角色描述（可选，从参考图中提取角色特征）"
              className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-sky-400"
            />
            <textarea
              name="visualPrompt"
              rows={2}
              placeholder="补充说明（可选，追加到自动构建的 prompt）"
              className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-sky-400"
            />
          </>
        )}

        {/* Section variant or rerun mode: userInstruction */}
        {(!isCanonical || isRerunMode) && (
          <textarea
            name="userInstruction"
            rows={2}
            required={isRerunMode}
            placeholder={isRerunMode ? "说明要调整的地方（必填）..." : "本轮生成指令（可选，补充角度、姿势、构图要求）"}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-sky-400"
          />
        )}

        <input
          name="negativePrompt"
          placeholder="负面提示词（可选）"
          className="w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-[11px] text-zinc-200 outline-none transition focus:border-sky-400"
        />

        {/* Source image checkboxes (canonical initial mode only) */}
        {isCanonical && !isRerunMode && sourceImages.length > 0 && (
          <details className="rounded border border-white/10 bg-black/20 p-1.5 text-[11px]" open>
            <summary className="cursor-pointer text-zinc-300">原始参考图 ({sourceImages.length})</summary>
            <div className="mt-1 space-y-0.5">
              {sourceImages.map((image) => (
                <label key={image.id} className="flex items-center gap-1.5 px-1 py-0.5 text-zinc-400">
                  <input name="sourceImageIds" value={image.id} type="checkbox" defaultChecked className="size-3 accent-sky-500" />
                  <span className="font-mono text-[10px]">{image.id.slice(0, 8)}</span>
                </label>
              ))}
            </div>
          </details>
        )}

        {/* Disabled message */}
        {!isRerunMode && disabled && disabledReason && (
          <div className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
            {disabledReason}
          </div>
        )}
      </WorkflowActionForm>
    </div>
  );
}
