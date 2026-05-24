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

  return (
    <JobPageShell
      job={job}
      currentPath="sections"
      title={`${job.characterName} / 训练集模块`}
      description="按模块查看候选训练图数量、审核进度和生成状态。"
    >
      <MetricGrid>
        <MetricCard label="模块完成" value={`${completedSections}/${sections.length}`} detail="keep 数达到目标" />
        <MetricCard label="保留图片" value={totalKept} />
        <MetricCard label="待审图片" value={totalPending} />
        <MetricCard label="候选图片" value={sections.reduce((sum, section) => sum + section.counts.candidateImages, 0)} />
      </MetricGrid>

      <SimpleSection title="模块列表" subtitle={`${sections.length} 个模块`}>
        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
            暂无训练集模块
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_44px] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500 sm:grid">
              <span>模块</span>
              <span>状态</span>
              <span>保留目标</span>
              <span>更新时间</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {sections.map((section) => (
                <Link
                  key={section.id}
                  href={`/character-lora-training/${job.id}/sections/${section.id}`}
                  className="grid gap-2 px-3 py-3 text-sm transition hover:bg-white/[0.04] sm:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_44px] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium text-white sm:truncate">{section.name}</span>
                    <span className="mt-1 block break-all font-mono text-[11px] text-zinc-500 sm:truncate">{section.key}</span>
                  </span>
                  <StatusPill value={section.status} />
                  <span className="text-xs text-zinc-400">
                    {section.keepCount}/{section.targetKeepCount} keep, {section.pendingCount} pending
                  </span>
                  <span className="text-xs text-zinc-500">{formatDate(section.updatedAt)}</span>
                  <span className="hidden justify-end text-zinc-500 sm:flex">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </SimpleSection>
    </JobPageShell>
  );
}
