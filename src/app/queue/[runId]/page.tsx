import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, Images } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getReviewGroup, getReviewGroupIds } from "@/lib/server-data";
import { ReviewGrid } from "./review-grid";

function ExecutionMetaDisplay({ meta }: { meta: Record<string, unknown> }) {
  const ks1Seed = meta.ks1Seed as number | null | undefined;
  const ks2Seed = meta.ks2Seed as number | null | undefined;
  const ks1Steps = meta.ks1Steps as number | null | undefined;
  const ks1Cfg = meta.ks1Cfg as number | null | undefined;
  const ks1Sampler = meta.ks1Sampler as string | null | undefined;
  const ks1Denoise = meta.ks1Denoise as number | null | undefined;
  const ks2Steps = meta.ks2Steps as number | null | undefined;
  const ks2Cfg = meta.ks2Cfg as number | null | undefined;
  const ks2Sampler = meta.ks2Sampler as string | null | undefined;
  const ks2Denoise = meta.ks2Denoise as number | null | undefined;

  // Extra params
  const aspectRatio = meta.aspectRatio as string | null | undefined;
  const shortSidePx = meta.shortSidePx as number | null | undefined;
  const batchSize = meta.batchSize as number | null | undefined;
  const upscaleFactor = meta.upscaleFactor as number | null | undefined;
  const workflowId = meta.workflowId as string | null | undefined;
  const lora1 = meta.lora1 as Array<{ path: string; weight: number; enabled: boolean }> | null | undefined;
  const lora2 = meta.lora2 as Array<{ path: string; weight: number; enabled: boolean }> | null | undefined;
  const positivePrompt = meta.positivePrompt as string | null | undefined;
  const negativePrompt = meta.negativePrompt as string | null | undefined;

  const pill = "rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1";

  function loraName(path: string) {
    return path.split(/[/\\]/).pop() ?? path;
  }

  return (
    <div className="mt-3 space-y-2 text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        {/* KSampler1 */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-1">
          <div className="text-[10px] font-medium text-zinc-500">KSampler1</div>
          {ks1Seed != null && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Seed</span>
              <span className="font-mono text-zinc-300">{ks1Seed}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500">
            {ks1Steps != null && <span>steps {ks1Steps}</span>}
            {ks1Cfg != null && <span>cfg {ks1Cfg}</span>}
            {ks1Sampler && <span>{ks1Sampler}</span>}
            {ks1Denoise != null && <span>denoise {ks1Denoise}</span>}
          </div>
        </div>
        {/* KSampler2 */}
        {ks2Seed != null ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-1">
            <div className="text-[10px] font-medium text-zinc-500">KSampler2</div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Seed</span>
              <span className="font-mono text-zinc-300">{ks2Seed}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500">
              {ks2Steps != null && <span>steps {ks2Steps}</span>}
              {ks2Cfg != null && <span>cfg {ks2Cfg}</span>}
              {ks2Sampler && <span>{ks2Sampler}</span>}
              {ks2Denoise != null && <span>denoise {ks2Denoise}</span>}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
            <div className="text-[10px] font-medium text-zinc-600">KSampler2</div>
            <div className="text-zinc-600">跳过（1× 无高清修复）</div>
          </div>
        )}
      </div>

      {/* Quick info row */}
      <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
        {aspectRatio != null && shortSidePx != null && (
          <span className={pill}>
            <span className="font-mono text-zinc-300">{aspectRatio}</span> · {shortSidePx}px
          </span>
        )}
        {batchSize != null && (
          <span className={pill}>
            batch <span className="font-mono text-zinc-300">{batchSize}</span>
          </span>
        )}
        {upscaleFactor != null && (
          <span className={pill}>
            upscale <span className="font-mono text-zinc-300">{upscaleFactor}x</span>
          </span>
        )}
        {workflowId && (
          <span className={pill}>
            workflow: <span className="font-mono text-zinc-300">{workflowId}</span>
          </span>
        )}
      </div>

      {/* LoRA lists */}
      {(lora1?.length || lora2?.length) && (
        <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
          {lora1 && lora1.length > 0 && (
            <div className="inline-flex flex-wrap items-center gap-1">
              <span className="text-zinc-600">LoRA1:</span>
              {lora1.map((l, i) => (
                <span key={i} className="rounded border border-white/5 bg-white/[0.02] px-1.5 py-0.5">
                  {loraName(l.path)} {l.weight}{l.enabled ? "" : " (disabled)"}
                </span>
              ))}
            </div>
          )}
          {lora2 && lora2.length > 0 && (
            <div className="inline-flex flex-wrap items-center gap-1">
              <span className="text-zinc-600">LoRA2:</span>
              {lora2.map((l, i) => (
                <span key={i} className="rounded border border-white/5 bg-white/[0.02] px-1.5 py-0.5">
                  {loraName(l.path)} {l.weight}{l.enabled ? "" : " (disabled)"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompts */}
      {(positivePrompt || negativePrompt) && (
        <div className="space-y-1 text-[10px]">
          {positivePrompt && (
            <details>
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Prompt</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-2 text-zinc-400">{positivePrompt}</pre>
            </details>
          )}
          {negativePrompt && (
            <details>
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Negative Prompt</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-2 text-zinc-400">{negativePrompt}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default async function ReviewGroupPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const [group, allIds] = await Promise.all([
    getReviewGroup(runId),
    getReviewGroupIds(),
  ]);

  if (!group) notFound();

  const currentIndex = allIds.indexOf(runId);
  const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
  const nextId = currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/queue#run-${runId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回队列
        </Link>
        <div className="flex items-center gap-2">
          {group.projectId && group.projectSectionId && (
            <Link
              href={`/projects/${group.projectId}/sections/${group.projectSectionId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300"
            >
              <ExternalLink className="size-3.5" /> 跳转小节
            </Link>
          )}
          {group.projectId && group.projectSectionId && (
            <Link
              href={`/projects/${group.projectId}/sections/${group.projectSectionId}/results`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300"
            >
              <Images className="size-3.5" /> 查看结果
            </Link>
          )}
          <a
            href={`/api/runs/${runId}/workflow`}
            download
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300"
          >
            <Download className="size-4" /> 下载工作流
          </a>
        </div>
      </div>

      <SectionCard title={group.title} subtitle={`${group.presetNames.join(" · ") || group.sectionName} · ${group.createdAt}`}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500">
          <span>待审核<strong className="ml-1.5 text-sm font-semibold text-white">{group.pendingCount}</strong></span>
          <span>总张数<strong className="ml-1.5 text-sm font-semibold text-white">{group.totalCount}</strong></span>
        </div>
        {group.executionMeta && (
          <ExecutionMetaDisplay meta={group.executionMeta} />
        )}
      </SectionCard>

      <SectionCard title="宫格审核">
        <ReviewGrid images={group.images} nextRunId={nextId} />
      </SectionCard>

      <div className="grid grid-cols-2 gap-3">
        {prevId ? (
          <Link href={`/queue/${prevId}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <ChevronLeft className="size-4" /> 上一组
          </Link>
        ) : <div />}
        {nextId ? (
          <Link href={`/queue/${nextId}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            下一组 <ChevronRight className="size-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
