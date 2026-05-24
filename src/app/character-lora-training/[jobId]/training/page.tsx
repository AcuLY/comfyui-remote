import { notFound } from "next/navigation";

import {
  getCharacterLoraWorkerQueueStatus,
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
import { WorkflowActionForm } from "../workflow-action-form";
import { cancelTrainingAction, enqueueTrainingAction } from "../workflow-actions";

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

  const [datasetRevisions, trainingRuns, queueStatus] = await Promise.all([
    listCharacterLoraDatasetRevisions(jobId),
    listCharacterLoraTrainingRuns(jobId),
    getCharacterLoraWorkerQueueStatus(),
  ]);
  const latestRevision = datasetRevisions.at(-1) ?? null;
  const latestRun = trainingRuns[0] ?? null;
  const doneRuns = trainingRuns.filter((run) => run.status === "done");
  const activeRun = trainingRuns.find((run) => run.status === "queued" || run.status === "running") ?? null;
  const blockingReasons = [
    !latestRevision ? "没有数据集版本" : null,
    latestRevision && latestRevision.status !== "frozen" ? `最新数据集版本不是 frozen（当前 ${latestRevision.status}）` : null,
    !job.baseCheckpointPath ? "缺少 baseCheckpointPath" : null,
    !job.trainingTemplateSnapshot ? "缺少训练配置快照" : null,
    activeRun ? `已有 ${activeRun.status} 训练任务 ${compactId(activeRun.id)}` : null,
  ].filter((reason): reason is string => Boolean(reason));
  const nonBlockingWarnings = [
    !job.baseCheckpointHash ? "checkpoint hash 未计算；训练会继续使用 checkpoint path。" : null,
    !job.baseFamily ? "base family 未填写；训练配置将使用模板默认值。" : null,
  ].filter((warning): warning is string => Boolean(warning));
  const canStart = Boolean(latestRevision) && blockingReasons.length === 0;

  return (
    <JobPageShell
      job={job}
      currentPath="training"
      title={`${job.characterName} / 训练执行`}
      description="选择已冻结训练集，显式入队训练并跟踪输出状态。"
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
            <InfoRow label="版本状态" value={latestRevision ? <StatusPill value={latestRevision.status} /> : "缺失"} />
            <InfoRow label="base checkpoint" value={job.baseCheckpointName ?? "-"} />
            <InfoRow label="checkpoint path" value={job.baseCheckpointPath ?? "-"} />
            <InfoRow label="checkpoint hash" value={job.baseCheckpointHash ?? "未计算"} />
            <InfoRow label="训练方案" value={readTrainingTemplateName(job.trainingTemplateSnapshot)} />
            <InfoRow label="预计步数" value={readTargetSteps(job.trainingTemplateSnapshot)} />
            <InfoRow label="队列状态" value={`${queueStatus.totals.queued ?? 0} queued / ${queueStatus.totals.running ?? 0} running`} />
          </dl>
          {latestRevision ? (
            <WorkflowActionForm
              action={enqueueTrainingAction.bind(null, latestRevision.id, job.id)}
              submitLabel="开始训练"
              pendingLabel="正在入队"
              successMessage="训练任务已入队"
              disabled={!canStart}
              className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
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
                  训练输入已就绪，点击按钮后才会入队训练。
                </div>
              )}
              {nonBlockingWarnings.length > 0 ? (
                <div className="rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                  <div className="font-medium">非阻塞提示</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {nonBlockingWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <label className="block text-xs text-zinc-400">
                config profile
                <select name="configProfile" defaultValue="standard" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400">
                  <option value="conservative">conservative</option>
                  <option value="standard">standard</option>
                  <option value="strong">strong</option>
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                队列策略
                <select name="queuePolicy" defaultValue="reject_when_busy" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400">
                  <option value="reject_when_busy">忙时拒绝</option>
                  <option value="queue_when_busy">忙时排队</option>
                  <option value="ignore_busy">忽略忙碌</option>
                </select>
              </label>
            </WorkflowActionForm>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                阻塞：没有数据集版本。
              </div>
              <button disabled className="h-9 w-full cursor-not-allowed rounded-md bg-emerald-500 px-3 text-xs font-medium text-white opacity-50">
                开始训练
              </button>
            </div>
          )}
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
                  <ProgressBar current={run.currentStep ?? 0} target={run.targetSteps ?? null} />
                  <dl>
                    <InfoRow label="训练集" value={compactId(run.datasetRevisionId)} />
                    <InfoRow label="步数" value={`${run.currentStep ?? 0} / ${run.targetSteps ?? "-"}`} />
                    <InfoRow label="进度" value={formatPercent(run.currentStep, run.targetSteps)} />
                    <InfoRow label="LoRA hash" value={run.finalSha256 ?? "-"} />
                    <InfoRow label="输出目录" value={run.outputDir ?? "-"} />
                    <InfoRow label="更新时间" value={formatDate(run.updatedAt)} />
                  </dl>
                  {run.status === "queued" || run.status === "running" ? (
                    <WorkflowActionForm
                      action={cancelTrainingAction.bind(null, run.id, job.id)}
                      submitLabel="取消"
                      pendingLabel="取消中"
                      successMessage="训练任务已取消"
                      confirmMessage={`确认取消训练任务 ${compactId(run.id)}？`}
                      className="mt-3 grid gap-2"
                      buttonClassName="h-8 rounded-md border border-rose-500/30 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <input name="reason" placeholder="取消原因" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-zinc-200 outline-none transition focus:border-sky-400" />
                    </WorkflowActionForm>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SimpleSection>
      </div>
    </JobPageShell>
  );
}

function ProgressBar({ current, target }: { current: number; target: number | null }) {
  const percent = target && target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function formatPercent(current: number | null | undefined, target: number | null | undefined) {
  if (!target || target <= 0) return "-";
  return `${Math.min(100, Math.round(((current ?? 0) / target) * 100))}%`;
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
