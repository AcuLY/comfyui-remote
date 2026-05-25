"use client";

import { useState } from "react";
import { Check, ChevronDown, RefreshCw, X } from "lucide-react";

import { getEffectiveCanonicalViewLabel } from "@/lib/character-lora-canonical-views";
import { ArtifactThumbCompact, compactId } from "./shared-ui";
import { WorkflowActionForm } from "./workflow-action-form";
import type { WorkflowActionResult } from "./workflow-actions";

type CanonicalVersion = {
  id: string;
  version: number;
  status: string;
  canonicalView: string | null;
  notes: string | null;
  createdAt: string;
  artifact: { id: string; relativePath: string | null; sha256: string | null } | null;
};

type SourceImage = {
  id: string;
  relativePath: string | null;
};

type ViewSpec = {
  key: string;
  label: string;
  promptPhrase: string;
};

type CanonicalViewPanelProps = {
  viewSpec: ViewSpec;
  candidates: CanonicalVersion[];
  sourceImages: SourceImage[];
  allNonRejectedVersions: CanonicalVersion[];
  jobId: string;
  currentCanonicalVersionId: string | null;
  enqueueAction: (formData: FormData) => Promise<WorkflowActionResult>;
  selectAction: (versionId: string) => Promise<void>;
  rejectAction: (versionId: string) => Promise<void>;
  rerunAction: (formData: FormData) => Promise<WorkflowActionResult>;
  disabled: boolean;
};

export function CanonicalViewPanel({
  viewSpec,
  candidates,
  sourceImages,
  allNonRejectedVersions,
  jobId,
  currentCanonicalVersionId,
  enqueueAction,
  selectAction,
  rejectAction,
  rerunAction,
  disabled,
}: CanonicalViewPanelProps) {
  const [genExpanded, setGenExpanded] = useState(false);
  const [rerunTarget, setRerunTarget] = useState<string | null>(null);

  const rerunCandidate = rerunTarget ? candidates.find((c) => c.id === rerunTarget) : null;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">{viewSpec.label}</h3>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
            {candidates.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setGenExpanded(!genExpanded)}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          生成
          <ChevronDown className={`size-3 transition-transform ${genExpanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Candidate horizontal strip */}
      {candidates.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-white/[0.08] text-[11px] text-zinc-600">
          暂无候选
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {candidates.map((version) => {
            const isCurrent = version.id === currentCanonicalVersionId;
            const isRejected = version.status === "rejected";
            const isRerunTarget = rerunTarget === version.id;
            return (
              <div
                key={version.id}
                className={`group relative flex-none ${isRejected ? "opacity-50" : ""}`}
                style={{ width: "clamp(72px, 18vw, 100px)" }}
              >
                <div
                  className={`overflow-hidden rounded-md ${isCurrent ? "ring-2 ring-sky-400/70" : ""} ${isRerunTarget ? "ring-2 ring-violet-400/70" : ""}`}
                >
                  <ArtifactThumbCompact
                    jobId={jobId}
                    relativePath={version.artifact?.relativePath}
                    alt={`v${version.version}`}
                  />
                </div>
                {/* Version + status */}
                <div className="mt-1 flex items-center justify-between gap-0.5">
                  <span className="text-[10px] tabular-nums text-zinc-400">v{version.version}</span>
                  {isCurrent && (
                    <span className="rounded bg-sky-500/20 px-1 py-px text-[9px] text-sky-300">当前</span>
                  )}
                </div>
                {/* Action buttons */}
                {!isRejected && (
                  <div className="mt-1 flex gap-1">
                    <form action={() => selectAction(version.id)} className="flex-1">
                      <button
                        type="submit"
                        disabled={isCurrent}
                        title="选用"
                        className="flex h-5 w-full items-center justify-center rounded bg-sky-500/20 text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-30"
                      >
                        <Check className="size-3" />
                      </button>
                    </form>
                    <form action={() => rejectAction(version.id)} className="flex-1">
                      <button
                        type="submit"
                        disabled={isCurrent}
                        title="拒绝"
                        className="flex h-5 w-full items-center justify-center rounded bg-rose-500/20 text-rose-300 transition hover:bg-rose-500/30 disabled:opacity-30"
                      >
                        <X className="size-3" />
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setRerunTarget(isRerunTarget ? null : version.id)}
                      title="重生"
                      className={`flex h-5 flex-1 items-center justify-center rounded transition ${isRerunTarget ? "bg-violet-500/30 text-violet-200" : "bg-white/[0.06] text-zinc-400 hover:bg-violet-500/20 hover:text-violet-300"}`}
                    >
                      <RefreshCw className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rerun form (shown when a candidate is selected for rerun) */}
      {rerunCandidate && rerunCandidate.artifact?.id && (
        <div className="mt-2 rounded-md border border-violet-400/20 bg-violet-500/[0.06] p-2">
          <div className="mb-1.5 text-[11px] font-medium text-violet-200">
            基于 v{rerunCandidate.version} 重生
          </div>
          <WorkflowActionForm
            action={rerunAction}
            submitLabel="重生入队"
            pendingLabel="入队中"
            successMessage="重生任务已入队"
            disabled={!rerunCandidate.artifact?.relativePath || !rerunCandidate.artifact?.sha256}
            className="space-y-1.5"
            buttonClassName="h-7 w-full rounded-md bg-violet-500 px-2 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <input type="hidden" name="provider" value="openai-codex" />
            <input type="hidden" name="canonicalView" value={rerunCandidate.canonicalView ?? viewSpec.key} />
            <input type="hidden" name="artifactId" value={rerunCandidate.artifact.id} />
            <input type="hidden" name="relativePath" value={rerunCandidate.artifact.relativePath ?? ""} />
            <input type="hidden" name="sha256" value={rerunCandidate.artifact.sha256 ?? ""} />
            <textarea
              name="userInstruction"
              rows={2}
              required
              placeholder="说明要调整的地方..."
              className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-violet-400"
            />
            <input
              name="negativePrompt"
              placeholder="负面提示词（可选）"
              className="w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-[11px] text-zinc-200 outline-none transition focus:border-violet-400"
            />
          </WorkflowActionForm>
        </div>
      )}

      {/* Generation form (collapsible) */}
      {genExpanded && (
        <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-2">
          <WorkflowActionForm
            action={enqueueAction}
            submitLabel={`生成${viewSpec.label}`}
            pendingLabel="入队中"
            successMessage={`${viewSpec.label}人设图任务已入队`}
            disabled={disabled}
            className="space-y-2"
            buttonClassName="h-7 w-full rounded-md bg-emerald-500 px-2 text-[11px] font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <input type="hidden" name="canonicalView" value={viewSpec.key} />
            <label className="block text-[11px] text-zinc-400">
              生成器
              <select
                name="provider"
                defaultValue="openai-codex"
                className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none transition focus:border-emerald-400"
              >
                <option value="openai-codex">openai-codex</option>
                <option value="mock-local">mock-local</option>
              </select>
            </label>

            {/* Source images */}
            {sourceImages.length > 0 && (
              <details className="rounded border border-white/10 bg-black/20 p-1.5 text-[11px]">
                <summary className="cursor-pointer text-zinc-300">原始参考图 ({sourceImages.length})</summary>
                <div className="mt-1 space-y-0.5">
                  {sourceImages.map((image) => (
                    <label key={image.id} className="flex items-center gap-1.5 px-1 py-0.5 text-zinc-400">
                      <input name="sourceImageIds" value={image.id} type="checkbox" defaultChecked className="size-3 accent-sky-500" />
                      <span className="font-mono">{compactId(image.id)}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}

            {/* Reference versions */}
            {allNonRejectedVersions.length > 0 && (
              <details className="rounded border border-white/10 bg-black/20 p-1.5 text-[11px]">
                <summary className="cursor-pointer text-zinc-300">已有视图参考 ({allNonRejectedVersions.length})</summary>
                <div className="mt-1 space-y-0.5">
                  {allNonRejectedVersions.map((version) => (
                    <label key={version.id} className="flex items-center gap-1.5 px-1 py-0.5 text-zinc-400">
                      <input name="canonicalVersionIds" value={version.id} type="checkbox" className="size-3 accent-violet-500" />
                      <span>v{version.version} / {getEffectiveCanonicalViewLabel(version.canonicalView)}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}

            <input name="negativePrompt" placeholder="负面提示词（可选）" className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-200 outline-none transition focus:border-emerald-400" />
            <textarea name="characterDescription" rows={2} placeholder="角色描述（可选）" className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-emerald-400" />
            <textarea name="finalPromptDraft" rows={2} placeholder="成品提示词（可选）" className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-emerald-400" />
            <textarea name="visualPrompt" rows={2} placeholder="本次补充说明（可选）" className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 outline-none transition focus:border-emerald-400" />

            {disabled && (
              <div className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                需要至少一张原始参考图或已有 canonical 视图
              </div>
            )}
          </WorkflowActionForm>
        </div>
      )}
    </div>
  );
}
