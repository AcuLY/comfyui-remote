import { notFound } from "next/navigation";

import {
  getCharacterLoraTrainingJob,
  listCharacterLoraCandidateImages,
  listCharacterLoraJobSections,
} from "@/lib/actions/character-lora-training";
import {
  ArtifactThumb,
  InfoRow,
  JobPageShell,
  MetricCard,
  MetricGrid,
  SimpleSection,
  StatusPill,
  compactId,
  formatDate,
} from "../../shared-ui";

export const dynamic = "force-dynamic";

export default async function SectionDetailPage({
  params,
}: {
  params: Promise<{ jobId: string; sectionId: string }>;
}) {
  const { jobId, sectionId } = await params;
  const job = await getCharacterLoraTrainingJob(jobId).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("not found")) return null;
    throw error;
  });
  if (!job) notFound();

  const [sections, candidateImages] = await Promise.all([
    listCharacterLoraJobSections(jobId),
    listCharacterLoraCandidateImages(jobId, { sectionId }),
  ]);
  const section = sections.find((item) => item.id === sectionId);
  if (!section) notFound();

  const keptImages = candidateImages.filter((image) =>
    image.reviewStatus === "keep" || image.reviewStatus === "included_in_training"
  );

  return (
    <JobPageShell
      job={job}
      currentPath="sections"
      title={`${job.characterName} / ${section.name}`}
      description="单个训练集模块的状态、候选图和 caption 摘要。"
    >
      <MetricGrid>
        <MetricCard label="状态" value={<StatusPill value={section.status} />} />
        <MetricCard label="保留目标" value={`${section.keepCount}/${section.targetKeepCount}`} />
        <MetricCard label="候选图片" value={candidateImages.length} />
        <MetricCard label="待审图片" value={section.pendingCount} />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SimpleSection title="模块信息">
          <dl>
            <InfoRow label="模块 ID" value={<span className="font-mono text-xs">{compactId(section.id)}</span>} />
            <InfoRow label="Key" value={<span className="font-mono text-xs">{section.key}</span>} />
            <InfoRow label="人设图版本" value={compactId(section.canonicalVersionId)} />
            <InfoRow label="提示词卡版本" value={compactId(section.promptCardVersionId)} />
            <InfoRow label="生成批次" value={section.counts.generationRuns} />
            <InfoRow label="更新时间" value={formatDate(section.updatedAt)} />
          </dl>
        </SimpleSection>

        <SimpleSection title="候选训练图" subtitle={`${keptImages.length} keep / ${candidateImages.length} total`}>
          {candidateImages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
              暂无候选训练图
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {candidateImages.map((image) => (
                <div key={image.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <ArtifactThumb jobId={job.id} relativePath={image.relativePath} alt={image.id} />
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <StatusPill value={image.reviewStatus} />
                    <span className="font-mono text-zinc-500">{compactId(image.id)}</span>
                  </div>
                  <div className="mt-2 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-zinc-400">
                    {image.captionDraft || "暂无 caption"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SimpleSection>
      </div>
    </JobPageShell>
  );
}
