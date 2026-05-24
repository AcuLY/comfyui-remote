import { notFound } from "next/navigation";

import {
  getCharacterLoraTrainingJob,
  listCharacterLoraDatasetRevisions,
  listCharacterLoraTrainingRuns,
} from "@/lib/actions/character-lora-training";
import {
  InfoRow,
  JobPageShell,
  MetricCard,
  MetricGrid,
  SimpleSection,
  StatusPill,
  compactId,
  formatDate,
} from "../shared-ui";

export const dynamic = "force-dynamic";

export default async function TrainingPage({
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

  const [datasetRevisions, trainingRuns] = await Promise.all([
    listCharacterLoraDatasetRevisions(jobId),
    listCharacterLoraTrainingRuns(jobId),
  ]);
  const latestRevision = datasetRevisions[0] ?? null;
  const latestRun = trainingRuns[0] ?? null;
  const doneRuns = trainingRuns.filter((run) => run.status === "done");

  return (
    <JobPageShell
      job={job}
      currentPath="training"
      title={`${job.characterName} / 训练执行`}
      description="查看训练集版本、训练任务进度和 LoRA 文件输出。"
    >
      <MetricGrid>
        <MetricCard label="训练集版本" value={latestRevision ? `v${latestRevision.version}` : "-"} detail={latestRevision?.status ?? "未确认"} />
        <MetricCard label="训练任务" value={trainingRuns.length} />
        <MetricCard label="完成任务" value={doneRuns.length} />
        <MetricCard label="最新状态" value={latestRun ? <StatusPill value={latestRun.status} /> : "-"} />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SimpleSection title="训练输入" subtitle="普通摘要">
          <dl>
            <InfoRow label="当前训练集版本" value={latestRevision ? `v${latestRevision.version} / ${latestRevision.itemCount} 张` : "缺失"} />
            <InfoRow label="训练方案" value={readTrainingTemplateName(job.trainingTemplateSnapshot)} />
            <InfoRow label="预计步数" value={readTargetSteps(job.trainingTemplateSnapshot)} />
            <InfoRow label="输出" value="LoRA 文件与训练报告" />
          </dl>
        </SimpleSection>

        <SimpleSection title="训练任务" subtitle={`${trainingRuns.length} 个`}>
          {trainingRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
              暂无训练任务
            </div>
          ) : (
            <div className="space-y-3">
              {trainingRuns.map((run) => (
                <div key={run.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-zinc-400">{compactId(run.id)}</span>
                    <StatusPill value={run.status} />
                  </div>
                  <dl>
                    <InfoRow label="训练集" value={compactId(run.datasetRevisionId)} />
                    <InfoRow label="步数" value={`${run.currentStep ?? 0} / ${run.targetSteps ?? "-"}`} />
                    <InfoRow label="LoRA hash" value={run.finalSha256 ?? "-"} />
                    <InfoRow label="输出目录" value={run.outputDir ?? "-"} />
                    <InfoRow label="更新时间" value={formatDate(run.updatedAt)} />
                  </dl>
                </div>
              ))}
            </div>
          )}
        </SimpleSection>
      </div>
    </JobPageShell>
  );
}

function readTrainingTemplateName(value: unknown) {
  if (!value || typeof value !== "object") return "角色 LoRA 默认方案";
  const name = "name" in value ? value.name : null;
  return typeof name === "string" && name.trim() ? name : "角色 LoRA 默认方案";
}

function readTargetSteps(value: unknown) {
  if (!value || typeof value !== "object" || !("trainingDefaults" in value)) return "-";
  const defaults = value.trainingDefaults;
  if (!defaults || typeof defaults !== "object") return "-";
  const profile = "configProfiles" in defaults && defaults.configProfiles && typeof defaults.configProfiles === "object"
    ? defaults.configProfiles
    : null;
  const ordinary = profile && "ordinary" in profile && profile.ordinary && typeof profile.ordinary === "object"
    ? profile.ordinary
    : null;
  const steps = ordinary && "targetSteps" in ordinary ? ordinary.targetSteps : null;
  return typeof steps === "number" ? `约 ${steps} steps` : "-";
}
