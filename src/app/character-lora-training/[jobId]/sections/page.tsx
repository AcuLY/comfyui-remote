import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  getCharacterLoraTrainingJob,
  listCharacterLoraJobSections,
} from "@/lib/actions/character-lora-training";
import {
  JobPageShell,
  MetricCard,
  MetricGrid,
  SimpleSection,
  StatusPill,
  formatDate,
} from "../shared-ui";
import { enqueueSectionRunAction, instantiateSectionsAction } from "../workflow-actions";

export const dynamic = "force-dynamic";

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getCharacterLoraTrainingJob(jobId).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("not found")) return null;
    throw error;
  });
  if (!job) notFound();

  const sections = await listCharacterLoraJobSections(jobId);
  const completedSections = sections.filter((section) => section.keepCount >= section.targetKeepCount).length;
  const totalKept = sections.reduce((sum, section) => sum + section.keepCount, 0);
  const totalPending = sections.reduce((sum, section) => sum + section.pendingCount, 0);
  const blockingReasons = [
    !job.currentCanonicalVersionId ? "缺少当前人设图 canonical" : null,
    !job.currentPromptCardVersionId ? "缺少当前提示词卡" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const canGenerate = blockingReasons.length === 0;

  return (
    <JobPageShell
      job={job}
      currentPath="sections"
      title={`${job.characterName} / 训练集模块`}
      description="初始化训练集模块，并按模块入队生成候选训练图。"
    >
      <MetricGrid>
        <MetricCard label="模块完成" value={`${completedSections}/${sections.length}`} detail="keep 数达到目标" />
        <MetricCard label="保留图片" value={totalKept} />
        <MetricCard label="待审图片" value={totalPending} />
        <MetricCard label="候选图片" value={sections.reduce((sum, section) => sum + section.counts.candidateImages, 0)} />
      </MetricGrid>

      <SimpleSection title="模块控制" subtitle={canGenerate ? "lineage 已就绪" : "仍有阻塞前置条件"}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className={`rounded-lg border px-3 py-2 text-sm ${canGenerate ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-amber-500/25 bg-amber-500/10 text-amber-200"}`}>
            {canGenerate ? "当前 canonical 与 prompt card 已存在，可以初始化或更新 section lineage。" : `阻塞：${blockingReasons.join("；")}`}
          </div>
          <form action={instantiateSectionsAction.bind(null, job.id)}>
            <button disabled={!canGenerate} className="h-10 w-full rounded-md bg-sky-500 px-3 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
              初始化 / 更新模块 lineage
            </button>
          </form>
        </div>
      </SimpleSection>

      <SimpleSection title="模块列表" subtitle={`${sections.length} 个模块`}>
        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
            暂无训练集模块
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_140px] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500 sm:grid">
              <span>模块</span>
              <span>状态</span>
              <span>保留目标</span>
              <span>更新时间</span>
              <span>操作</span>
            </div>
            <div className="divide-y divide-white/10">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="grid gap-2 px-3 py-3 text-sm transition hover:bg-white/[0.04] sm:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_140px] sm:items-center"
                >
                  <Link href={`/character-lora-training/${job.id}/sections/${section.id}`} className="min-w-0">
                    <span className="block break-words font-medium text-white sm:truncate">{section.name}</span>
                    <span className="mt-1 block break-all font-mono text-[11px] text-zinc-500 sm:truncate">{section.key}</span>
                  </Link>
                  <StatusPill value={section.status} />
                  <span className="text-xs text-zinc-400">
                    {section.keepCount}/{section.targetKeepCount} keep, {section.pendingCount} pending
                  </span>
                  <span className="text-xs text-zinc-500">{formatDate(section.updatedAt)}</span>
                  <div className="flex items-center gap-2">
                    <form action={enqueueSectionRunAction.bind(null, section.id, job.id)}>
                      <button disabled={!canGenerate || !section.canonicalVersionId || !section.promptCardVersionId || section.status === "paused"} className="h-8 rounded-md bg-emerald-500 px-2 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                        生成
                      </button>
                    </form>
                    <Link href={`/character-lora-training/${job.id}/sections/${section.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 transition hover:bg-white/[0.06]">
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SimpleSection>
    </JobPageShell>
  );
}
