import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getReviewGroup, getReviewGroupIds } from "@/lib/server-data";
import { ImageActions } from "./image-actions";

export default async function ReviewImagePage({ params }: { params: Promise<{ runId: string; imageId: string }> }) {
  const { runId, imageId } = await params;
  const [group, allIds] = await Promise.all([
    getReviewGroup(runId),
    getReviewGroupIds(),
  ]);

  if (!group) notFound();

  const imageIndex = group.images.findIndex((item) => item.id === imageId);
  const image = imageIndex >= 0 ? group.images[imageIndex] : null;

  if (!image) notFound();

  const prev = imageIndex > 0 ? group.images[imageIndex - 1] : null;
  const next = imageIndex < group.images.length - 1 ? group.images[imageIndex + 1] : null;

  const currentGroupIndex = allIds.indexOf(runId);
  const nextRunId = currentGroupIndex < allIds.length - 1 ? allIds[currentGroupIndex + 1] : null;
  const pendingImageIds = group.images
    .filter((img) => img.status === "pending")
    .map((img) => img.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/queue/${runId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回宫格
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              image.status === "kept"
                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : image.status === "trashed"
                  ? "border-rose-500/30 bg-rose-500/20 text-rose-300"
                  : "border-white/10 bg-white/5 text-zinc-400"
            }`}
          >
            {image.status}
          </span>
          <span className="text-xs text-zinc-500">{group.presetNames.join(" · ") || group.sectionName}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] p-3 lg:mx-auto lg:max-w-4xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${image.full}?q=85&w=1920`} alt={image.id} className="h-auto w-full rounded-[22px] object-cover" />
      </div>

      {/* Execution params */}
      {group.executionMeta && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
            {group.executionMeta.aspectRatio != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                <span className="font-mono text-zinc-300">{String(group.executionMeta.aspectRatio)}</span>
                {group.executionMeta.shortSidePx != null && (
                  <> · {String(group.executionMeta.shortSidePx)}px</>
                )}
              </span>
            )}
            {group.executionMeta.batchSize != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                batch <span className="font-mono text-zinc-300">{String(group.executionMeta.batchSize)}</span>
              </span>
            )}
            {group.executionMeta.ks1Seed != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                Seed1: <span className="font-mono text-zinc-300">{String(group.executionMeta.ks1Seed)}</span>
              </span>
            )}
            {group.executionMeta.ks2Seed != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                Seed2: <span className="font-mono text-zinc-300">{String(group.executionMeta.ks2Seed)}</span>
              </span>
            )}
            {group.executionMeta.ks1Steps != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                KS1: steps {String(group.executionMeta.ks1Steps)} · cfg {String(group.executionMeta.ks1Cfg)} · {String(group.executionMeta.ks1Sampler)}
                {group.executionMeta.ks1Denoise != null && <> · denoise {String(group.executionMeta.ks1Denoise)}</>}
              </span>
            )}
            {group.executionMeta.ks2Steps != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                KS2: steps {String(group.executionMeta.ks2Steps)} · cfg {String(group.executionMeta.ks2Cfg)} · {String(group.executionMeta.ks2Sampler)}
                {group.executionMeta.ks2Denoise != null && <> · denoise {String(group.executionMeta.ks2Denoise)}</>}
              </span>
            )}
            {group.executionMeta.upscaleFactor != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                upscale <span className="font-mono text-zinc-300">{String(group.executionMeta.upscaleFactor)}x</span>
              </span>
            )}
            {group.executionMeta.workflowId != null && (
              <span className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1">
                workflow: <span className="font-mono text-zinc-300">{String(group.executionMeta.workflowId)}</span>
              </span>
            )}
          </div>
          {/* LoRA list */}
          {Array.isArray(group.executionMeta.lora1) && (group.executionMeta.lora1 as Array<Record<string, unknown>>).length > 0 ? (
            <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
              <span className="text-zinc-600">LoRA1:</span>
              {(group.executionMeta.lora1 as Array<Record<string, unknown>>).map((l, i) => (
                <span key={i} className="rounded border border-white/5 bg-white/[0.02] px-1.5 py-0.5">
                  <span className="text-zinc-300">{String(l.path).split(/[/\\]/).pop()}</span>
                  {l.weight != null && <> · {String(l.weight)}</>}
                  {l.enabled === false && <span className="text-red-400/60"> (off)</span>}
                </span>
              ))}
            </div>
          ) : null}
          {Array.isArray(group.executionMeta.lora2) && (group.executionMeta.lora2 as Array<Record<string, unknown>>).length > 0 ? (
            <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
              <span className="text-zinc-600">LoRA2:</span>
              {(group.executionMeta.lora2 as Array<Record<string, unknown>>).map((l, i) => (
                <span key={i} className="rounded border border-white/5 bg-white/[0.02] px-1.5 py-0.5">
                  <span className="text-zinc-300">{String(l.path).split(/[/\\]/).pop()}</span>
                  {l.weight != null && <> · {String(l.weight)}</>}
                  {l.enabled === false && <span className="text-red-400/60"> (off)</span>}
                </span>
              ))}
            </div>
          ) : null}
          {/* Prompts (collapsible) */}
          {group.executionMeta.positivePrompt ? (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Prompt</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-2 text-zinc-400">
                {String(group.executionMeta.positivePrompt)}
              </pre>
            </details>
          ) : null}
          {group.executionMeta.negativePrompt ? (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Negative Prompt</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-2 text-zinc-400">
                {String(group.executionMeta.negativePrompt)}
              </pre>
            </details>
          ) : null}
        </div>
      )}

      <ImageActions
        imageId={imageId}
        runId={runId}
        pendingImageIds={pendingImageIds}
        nextRunId={nextRunId}
      />

      <div className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link href={`/queue/${runId}/images/${prev.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <ChevronLeft className="size-4" /> 上一张
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/queue/${runId}/images/${next.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            下一张 <ChevronRight className="size-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
