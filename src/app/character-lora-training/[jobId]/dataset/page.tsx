import { notFound } from "next/navigation";

import {
  getCharacterLoraTrainingJob,
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
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
  formatDate,
} from "../shared-ui";
import { WorkflowActionForm } from "../workflow-action-form";
import { freezeDatasetAction } from "../workflow-actions";

export const dynamic = "force-dynamic";

export default async function DatasetPage({
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

  const [candidateImages, datasetRevisions, sections] = await Promise.all([
    listCharacterLoraCandidateImages(jobId, {}),
    listCharacterLoraDatasetRevisions(jobId),
    listCharacterLoraJobSections(jobId),
  ]);
  const keptImages = candidateImages.filter((image) => image.reviewStatus === "keep");
  const includedImageCount = candidateImages.filter((image) => image.reviewStatus === "included_in_training").length;
  const missingCaptionCount = keptImages.filter((image) => !image.captionDraft?.trim()).length;
  const latestRevision = datasetRevisions.at(-1) ?? null;
  const keepCountBySection = keptImages.reduce<Map<string, number>>((counts, image) => {
    if (image.sectionId) {
      counts.set(image.sectionId, (counts.get(image.sectionId) ?? 0) + 1);
    }
    return counts;
  }, new Map());
  const incompleteSections = sections.filter(
    (section) => (keepCountBySection.get(section.id) ?? 0) < section.targetKeepCount,
  );
  const blockingReasons = [
    keptImages.length === 0 ? "没有 keep 图片" : null,
    missingCaptionCount > 0 ? `${missingCaptionCount} 张保留图片缺少 caption` : null,
    incompleteSections.length > 0 ? `${incompleteSections.length} 个训练集模块未达到 keep 目标` : null,
    !job.currentPromptCardVersionId ? "缺少当前提示词卡" : null,
    !job.currentCanonicalVersionId ? "缺少当前人设图 canonical" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const canFreeze = blockingReasons.length === 0;

  return (
    <JobPageShell
      job={job}
      currentPath="dataset"
      title={`${job.characterName} / 训练集版本`}
      description="检查入集阻塞原因，并冻结可训练的数据集版本。"
    >
      <MetricGrid>
        <MetricCard label="保留图片" value={keptImages.length} />
        <MetricCard label="已入集图片" value={includedImageCount} />
        <MetricCard label="缺 caption" value={missingCaptionCount} />
        <MetricCard label="训练集版本" value={datasetRevisions.length} detail={latestRevision ? `最新 v${latestRevision.version} / ${latestRevision.status}` : "未确认"} />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SimpleSection title="保留图片" subtitle={`${keptImages.length} 张`}>
          {keptImages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
              暂无保留图片
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {keptImages.map((image) => (
                <div key={image.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <ArtifactThumb jobId={job.id} relativePath={image.relativePath} alt={image.id} />
                  <div className="mt-2 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-zinc-400">
                    {image.captionDraft || "缺少 caption"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SimpleSection>

        <div className="space-y-4">
          <SimpleSection title="冻结训练集" subtitle={canFreeze ? "可创建新的 frozen revision" : "存在阻塞原因"}>
            <WorkflowActionForm
              action={freezeDatasetAction.bind(null, job.id)}
              submitLabel="创建并冻结训练集版本"
              pendingLabel="正在冻结"
              successMessage="训练集版本已冻结"
              disabled={!canFreeze}
              className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
            >
              {blockingReasons.length > 0 ? (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <div className="font-medium">阻塞原因</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {blockingReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {keptImages.length} 张图片 caption 完整，当前提示词卡和人设图已就绪。
                </div>
              )}
              <input type="hidden" name="captionStrategy" value="captionDraft" />
              <label className="block text-xs text-zinc-400">
                repeat count
                <input name="repeatCount" type="number" min={1} defaultValue={1} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
              </label>
              <label className="block text-xs text-zinc-400">
                source weight
                <input name="sourceWeight" type="number" min={0.1} step={0.1} defaultValue={1} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
              </label>
            </WorkflowActionForm>
          </SimpleSection>

          <SimpleSection title="版本记录" subtitle={`${datasetRevisions.length} 个`}>
            {datasetRevisions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
                暂无训练集版本
              </div>
            ) : (
              <div className="space-y-3">
                {datasetRevisions.map((revision) => (
                  <dl key={revision.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <InfoRow label="版本" value={`v${revision.version}`} />
                    <InfoRow label="状态" value={<StatusPill value={revision.status} />} />
                    <InfoRow label="图片数" value={revision.itemCount} />
                    <InfoRow label="确认时间" value={formatDate(revision.frozenAt)} />
                  </dl>
                ))}
              </div>
            )}
          </SimpleSection>
        </div>
      </div>
    </JobPageShell>
  );
}
