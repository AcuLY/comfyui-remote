import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  getCharacterLoraJobReport,
  getCharacterLoraTrainingJob,
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
  listCharacterLoraJobSections,
  listCharacterLoraPromptCardVersions,
  listCharacterLoraSourceImages,
  listCharacterLoraTrainingRuns,
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
} from "./shared-ui";
import { OverviewMetadataForm } from "./overview-metadata-form";
import { OverviewSourceUpload } from "./overview-source-upload";

export const dynamic = "force-dynamic";

export default async function CharacterLoraTrainingJobPage({
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

  const [
    sourceImages,
    promptCards,
    sections,
    candidateImages,
    datasetRevisions,
    trainingRuns,
    report,
  ] = await Promise.all([
    listCharacterLoraSourceImages(jobId),
    listCharacterLoraPromptCardVersions(jobId),
    listCharacterLoraJobSections(jobId),
    listCharacterLoraCandidateImages(jobId, {}),
    listCharacterLoraDatasetRevisions(jobId),
    listCharacterLoraTrainingRuns(jobId),
    getCharacterLoraJobReport(jobId),
  ]);

  const keptImageCount = candidateImages.filter((image) =>
    image.reviewStatus === "keep" || image.reviewStatus === "included_in_training"
  ).length;
  const latestTraining = trainingRuns[0] ?? null;
  const currentCanonical = report.canonicalVersions.find((version) => version.id === job.currentCanonicalVersionId) ?? null;
  const latestPromptCard = promptCards[promptCards.length - 1] ?? null;
  const completedSections = sections.filter((section) => section.keepCount >= section.targetKeepCount).length;
  const missingItems = buildMechanicalMissingItems({
    sourceImageCount: sourceImages.length,
    hasCurrentCanonical: Boolean(job.currentCanonicalVersionId),
    hasPromptCard: Boolean(job.currentPromptCardVersionId || latestPromptCard),
    sectionCount: sections.length,
    incompleteSectionCount: sections.length - completedSections,
    keptImageCount,
    hasDatasetRevision: datasetRevisions.length > 0,
    hasTrainingRun: trainingRuns.length > 0,
  });

  return (
    <JobPageShell
      job={job}
      currentPath=""
      title={job.characterName}
      description={`${job.triggerToken} / ${job.slug}`}
    >
      <MetricGrid>
        <MetricCard label="当前状态" value={<StatusPill value={job.status} />} detail={job.phase ?? "未设置阶段"} />
        <MetricCard label="机械缺项" value={missingItems.length} detail={missingItems.length ? missingItems[0] : "无"} />
        <MetricCard label="训练集模块" value={`${completedSections}/${sections.length}`} detail="keep 数达到目标的模块" />
        <MetricCard label="保留图片" value={keptImageCount} detail={`${candidateImages.length} 张候选训练图`} />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SimpleSection title="项目信息" subtitle="创建后仍可调整项目名、触发词和 checkpoint 选择。">
            <OverviewMetadataForm job={job} />
          </SimpleSection>

          <SimpleSection title="项目状态" subtitle="只展示确定状态和机械缺项，不给诊断建议。">
            <dl className="divide-y divide-white/10">
              <InfoRow label="项目 ID" value={<span className="font-mono text-xs">{compactId(job.id)}</span>} />
              <InfoRow label="创建时间" value={formatDate(job.createdAt)} />
              <InfoRow label="更新时间" value={formatDate(job.updatedAt)} />
              <InfoRow label="当前人设图" value={job.currentCanonicalVersionId ? compactId(job.currentCanonicalVersionId) : "缺失"} />
              <InfoRow label="当前提示词卡" value={job.currentPromptCardVersionId ? compactId(job.currentPromptCardVersionId) : "缺失"} />
              <InfoRow label="训练集版本" value={datasetRevisions.at(-1) ? `v${datasetRevisions.at(-1)?.version} / ${datasetRevisions.at(-1)?.status}` : "缺失"} />
              <InfoRow label="最新训练" value={latestTraining ? `${latestTraining.status} / ${formatDate(latestTraining.updatedAt)}` : "未开始"} />
            </dl>
          </SimpleSection>

          <SimpleSection title="机械缺项" subtitle={`${missingItems.length} 项`}>
            {missingItems.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-300">
                当前没有机械缺项。
              </div>
            ) : (
              <div className="grid gap-2">
                {missingItems.map((item) => (
                  <div key={item} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {item}
                  </div>
                ))}
              </div>
            )}
          </SimpleSection>

          <SimpleSection title="初始参考图" subtitle={`${sourceImages.length} 张`}>
            <OverviewSourceUpload jobId={job.id} sourceImageCount={sourceImages.length} />
          </SimpleSection>

          <SimpleSection title="流程入口" subtitle="普通 UI 只保留训练准备、训练集和 LoRA 文件产出路径。">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <NavButton href={`/character-lora-training/${job.id}/persona-reference`} label="人设参考图" />
              <NavButton href={`/character-lora-training/${job.id}/prompt-card`} label="提示词卡" />
              <NavButton href={`/character-lora-training/${job.id}/sections`} label="训练集模块" />
              <NavButton href={`/character-lora-training/${job.id}/dataset`} label="训练集版本" />
              <NavButton href={`/character-lora-training/${job.id}/training`} label="训练执行" />
              <NavButton href={`/character-lora-training/${job.id}/expert`} label="Expert / Debug" muted />
            </div>
          </SimpleSection>
        </div>

        <div className="space-y-4">
          <SimpleSection title="人设参考图" subtitle={currentCanonical ? `v${currentCanonical.version}` : "未选择"}>
            <div className="max-w-[180px] lg:max-w-none">
              <ArtifactThumb
                jobId={job.id}
                relativePath={currentCanonical?.artifact?.relativePath ?? null}
                alt="current persona reference"
              />
            </div>
          </SimpleSection>

          <SimpleSection title="提示词卡" subtitle={latestPromptCard ? `v${latestPromptCard.version}` : "未创建"}>
            {latestPromptCard ? (
              <div className="space-y-2 text-sm text-zinc-300">
                <div className="line-clamp-4 break-words">{latestPromptCard.finalPromptDraft}</div>
                <div className="text-xs text-zinc-500">{formatDate(latestPromptCard.createdAt)}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
                暂无提示词卡
              </div>
            )}
          </SimpleSection>

          <SimpleSection title="最新训练" subtitle={latestTraining ? latestTraining.status : "未开始"}>
            {latestTraining ? (
              <dl>
                <InfoRow label="状态" value={<StatusPill value={latestTraining.status} />} />
                <InfoRow label="步数" value={`${latestTraining.currentStep ?? 0} / ${latestTraining.targetSteps ?? "-"}`} />
                <InfoRow label="LoRA hash" value={latestTraining.finalSha256 ?? "-"} />
              </dl>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
                暂无训练任务
              </div>
            )}
          </SimpleSection>
        </div>
      </div>
    </JobPageShell>
  );
}

function NavButton({ href, label, muted = false }: { href: string; label: string; muted?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-between gap-3 rounded-lg border px-3 text-sm transition ${
        muted
          ? "border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06]"
          : "border-sky-500/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
      }`}
    >
      {label}
      <ArrowRight className="size-4" />
    </Link>
  );
}

function buildMechanicalMissingItems(input: {
  sourceImageCount: number;
  hasCurrentCanonical: boolean;
  hasPromptCard: boolean;
  sectionCount: number;
  incompleteSectionCount: number;
  keptImageCount: number;
  hasDatasetRevision: boolean;
  hasTrainingRun: boolean;
}) {
  const items: string[] = [];
  if (input.sourceImageCount === 0) items.push("缺少初始参考图");
  if (!input.hasCurrentCanonical) items.push("缺少当前人设参考图");
  if (!input.hasPromptCard) items.push("缺少提示词卡");
  if (input.sectionCount === 0) items.push("缺少训练集模块");
  if (input.incompleteSectionCount > 0) items.push(`${input.incompleteSectionCount} 个训练集模块未达到 keep 目标`);
  if (input.keptImageCount === 0) items.push("缺少保留的候选训练图");
  if (!input.hasDatasetRevision) items.push("缺少训练集版本");
  if (!input.hasTrainingRun) items.push("缺少训练任务");
  return items;
}
