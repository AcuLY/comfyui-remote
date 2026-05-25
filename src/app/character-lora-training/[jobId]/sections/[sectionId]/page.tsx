import { notFound } from "next/navigation";

import {
  getCharacterLoraJobReport,
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
import { enqueueSectionRunAction, reviewCandidateAction, updateCaptionAction } from "../../workflow-actions";
import { SectionGenerationClient } from "./section-generation-client";

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

  const [sections, candidateImages, report] = await Promise.all([
    listCharacterLoraJobSections(jobId),
    listCharacterLoraCandidateImages(jobId, { sectionId }),
    getCharacterLoraJobReport(jobId),
  ]);
  const section = sections.find((item) => item.id === sectionId);
  if (!section) notFound();

  const keptImages = candidateImages.filter((image) =>
    image.reviewStatus === "keep" || image.reviewStatus === "included_in_training"
  );
  const blockingReasons = [
    !section.canonicalVersionId ? "模块未绑定 canonical lineage" : null,
    !section.promptCardVersionId ? "模块未绑定 prompt card lineage" : null,
    section.status === "paused" ? "模块已暂停" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const canGenerate = blockingReasons.length === 0;
  const sectionGenerationRuns = report.generationRuns.filter((run) => run.sectionId === sectionId);
  const sectionGenerationRunIds = new Set(sectionGenerationRuns.map((run) => run.id));
  const sectionWorkerTasks = report.workerTasks.filter(
    (task) => task.workerType === "image_generation" && task.targetType === "generationRun" && sectionGenerationRunIds.has(task.targetId),
  );
  const taskByRunId = new Map(sectionWorkerTasks.map((task) => [task.targetId, task]));
  const latestSectionRun = sectionGenerationRuns.at(-1) ?? null;
  const activeSectionTasks = sectionWorkerTasks.filter((task) => task.status === "queued" || task.status === "running");
  const failedSectionTasks = sectionWorkerTasks.filter((task) => task.status === "failed");

  return (
    <JobPageShell
      job={job}
      currentPath="sections"
      title={`${job.characterName} / ${section.name}`}
      description="为单个模块发起生成、审核候选图并修订 caption。"
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
          <div className="mt-4">
            <SectionGenerationClient
              candidateImages={candidateImages.map((img) => ({ id: img.id, relativePath: img.relativePath, generationRunId: img.generationRunId, reviewStatus: img.reviewStatus }))}
              jobId={job.id}
              enqueueAction={enqueueSectionRunAction.bind(null, section.id, job.id)}
              rerunAction={enqueueSectionRunAction.bind(null, section.id, job.id)}
              disabled={!canGenerate}
              disabledReason={blockingReasons.length > 0 ? `阻塞：${blockingReasons.join("；")}` : undefined}
            />
          </div>
        </SimpleSection>

        <div className="space-y-4">
          <SimpleSection title="任务状态" subtitle={`${sectionGenerationRuns.length} 个 generation run / ${sectionWorkerTasks.length} 个 worker task`}>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">最新 run</div>
                <div className="mt-1 font-mono text-zinc-100">{compactId(latestSectionRun?.id)}</div>
                <div className="mt-1">{latestSectionRun ? <StatusPill value={latestSectionRun.status} /> : "-"}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">进行中任务</div>
                <div className="mt-1 text-xl font-semibold text-white">{activeSectionTasks.length}</div>
                <div className="mt-1 text-zinc-500">queued/running worker tasks</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">失败任务</div>
                <div className="mt-1 text-xl font-semibold text-white">{failedSectionTasks.length}</div>
                <div className="mt-1 text-zinc-500">failed worker tasks</div>
              </div>
            </div>
            {sectionGenerationRuns.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-zinc-500">
                暂无候选图生成任务。入队后这里会显示 run / worker task / lease / heartbeat。
              </div>
            ) : (
              <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
                {[...sectionGenerationRuns].reverse().map((run) => {
                  const task = taskByRunId.get(run.id);
                  return (
                    <div key={run.id} className="grid gap-2 p-3 text-xs text-zinc-400 md:grid-cols-[0.8fr_0.8fr_1fr_1fr]">
                      <div className="min-w-0">
                        <div className="font-mono text-zinc-100">{compactId(run.id)}</div>
                        <div className="mt-1"><StatusPill value={run.status} /></div>
                        <div className="mt-1">{formatDate(run.createdAt)}</div>
                      </div>
                      <div className="min-w-0 break-words">
                        <div className="text-zinc-200">{run.provider}</div>
                        <div>{run.imageModel ?? run.hostModel ?? "-"}</div>
                        <div>parent {compactId(run.parentRunId)}</div>
                      </div>
                      <div className="min-w-0 break-words">
                        <div className="text-zinc-200">task {compactId(task?.id)}</div>
                        <div>{task ? <StatusPill value={task.status} /> : "未找到 worker task"}</div>
                        <div>attempt {task?.attemptCount ?? 0}</div>
                      </div>
                      <div className="min-w-0 break-words">
                        <div>lease {task?.leaseOwner ?? "-"}</div>
                        <div>heartbeat {formatDate(task?.heartbeatAt)}</div>
                        <div className={task?.errorSummary ? "text-rose-200" : "text-zinc-500"}>{task?.errorSummary ?? "-"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                    <div className="mt-1 break-all font-mono text-[11px] text-zinc-500">run {compactId(image.generationRunId)}</div>
                    <form action={updateCaptionAction.bind(null, job.id, image.id)} className="mt-2 space-y-2">
                      <textarea name="captionDraft" rows={4} defaultValue={image.captionDraft ?? ""} required className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs leading-5 text-zinc-200 outline-none transition focus:border-sky-400" />
                      <button className="h-8 rounded-md border border-white/10 px-2 text-xs text-zinc-200 transition hover:bg-white/[0.06]">
                        保存 caption
                      </button>
                    </form>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <form action={reviewCandidateAction.bind(null, job.id, image.id, "keep")}>
                        <button disabled={image.reviewStatus === "keep" || image.reviewStatus === "included_in_training"} className="h-8 w-full rounded-md bg-emerald-500 px-2 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                          keep
                        </button>
                      </form>
                      <form action={reviewCandidateAction.bind(null, job.id, image.id, "reject")}>
                        <input type="hidden" name="rejectReasons" value="other" />
                        <button disabled={image.reviewStatus === "reject"} className="h-8 w-full rounded-md border border-rose-500/30 px-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                          reject
                        </button>
                      </form>
                      <form action={reviewCandidateAction.bind(null, job.id, image.id, "pending")}>
                        <button disabled={image.reviewStatus === "pending"} className="h-8 w-full rounded-md border border-white/10 px-2 text-xs text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50">
                          pending
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SimpleSection>
        </div>
      </div>
    </JobPageShell>
  );
}
