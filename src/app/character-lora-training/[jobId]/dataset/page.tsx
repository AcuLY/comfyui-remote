import { notFound } from "next/navigation";

import {
  getCharacterLoraTrainingJob,
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
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

  const [candidateImages, datasetRevisions] = await Promise.all([
    listCharacterLoraCandidateImages(jobId, {}),
    listCharacterLoraDatasetRevisions(jobId),
  ]);
  const keptImages = candidateImages.filter((image) => image.reviewStatus === "keep" || image.reviewStatus === "included_in_training");
  const missingCaptionCount = keptImages.filter((image) => !image.captionDraft?.trim()).length;
  const latestRevision = datasetRevisions[0] ?? null;

  return (
    <JobPageShell
      job={job}
      currentPath="dataset"
      title={`${job.characterName} / 训练集版本`}
      description="查看保留图片、caption 状态和已确认的训练集版本。"
    >
      <MetricGrid>
        <MetricCard label="保留图片" value={keptImages.length} />
        <MetricCard label="缺 caption" value={missingCaptionCount} />
        <MetricCard label="训练集版本" value={datasetRevisions.length} />
        <MetricCard label="最新版本" value={latestRevision ? `v${latestRevision.version}` : "-"} detail={latestRevision?.status ?? "未确认"} />
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
    </JobPageShell>
  );
}
