import { notFound } from "next/navigation";

import {
  getCharacterLoraJobReport,
  getCharacterLoraTrainingJob,
} from "@/lib/actions/character-lora-training";
import {
  CANONICAL_VIEW_SPECS,
  getEffectiveCanonicalViewLabel,
  getCanonicalViewLabel,
  groupCanonicalVersionsByView,
} from "@/lib/character-lora-canonical-views";
import {
  ArtifactThumbCompact,
  InfoRow,
  JobPageShell,
  SimpleSection,
  StatusPill,
  compactId,
  formatDate,
} from "../shared-ui";
import { SourceImageUploader } from "../source-image-uploader";
import { PersonaReferenceClient } from "../persona-reference-client";
import {
  registerManualCanonicalAction,
  rejectCanonicalAction,
  selectCanonicalAction,
  uploadSourceImageAction,
} from "../workflow-actions";

export const dynamic = "force-dynamic";

export default async function PersonaReferencePage({
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

  const report = await getCharacterLoraJobReport(jobId);
  const currentCanonical = report.canonicalVersions.find((version) => version.id === job.currentCanonicalVersionId) ?? null;
  const selectedCanonical = report.canonicalVersions.filter((version) => version.status === "selected").length;
  const rejectedCanonical = report.canonicalVersions.filter((version) => version.status === "rejected").length;
  const canonicalRuns = report.generationRuns.filter((run) => run.kind === "canonical");
  const canonicalRunIds = new Set(canonicalRuns.map((run) => run.id));
  const canonicalTasks = report.workerTasks.filter(
    (task) => task.workerType === "image_generation" && task.targetType === "generationRun" && canonicalRunIds.has(task.targetId),
  );
  const activeCanonicalTasks = canonicalTasks.filter((task) => task.status === "queued" || task.status === "running");
  const failedCanonicalTasks = canonicalTasks.filter((task) => task.status === "failed");
  const canonicalVersionsByView = groupCanonicalVersionsByView(report.canonicalVersions);
  const manualSourceImages = report.sourceImages;

  return (
    <JobPageShell
      job={job}
      currentPath="persona-reference"
      title={`${job.characterName} / 人设参考图`}
      description="上传源图、发起人设图生成，并选择当前训练使用的人设参考图。"
    >
      {/* Compact source section */}
      <SimpleSection
        title="源图"
        subtitle={`${report.sourceImages.length} 张参考图`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <SourceImageUploader uploadAction={uploadSourceImageAction.bind(null, job.id)} />
          </div>
          {report.sourceImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:max-w-[240px]">
              {report.sourceImages.map((image) => (
                <div key={image.id} className="size-12 flex-none overflow-hidden rounded-md border border-white/10">
                  <ArtifactThumbCompact jobId={job.id} relativePath={image.relativePath} alt={compactId(image.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </SimpleSection>

      {/* Main content: view panels + sidebar */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Client component with rerun panel + view panels */}
        <PersonaReferenceClient
          candidatesByView={canonicalVersionsByView}
          sourceImages={report.sourceImages}
          jobId={job.id}
          currentCanonicalVersionId={job.currentCanonicalVersionId}
          selectAction={selectCanonicalAction.bind(null, job.id)}
          rejectAction={rejectCanonicalAction.bind(null, job.id)}
        />

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Current canonical info */}
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
            <h3 className="mb-2 text-xs font-semibold text-zinc-200">当前人设图</h3>
            <dl className="space-y-0">
              <InfoRow label="版本" value={currentCanonical ? `v${currentCanonical.version}` : "缺失"} />
              <InfoRow label="状态" value={currentCanonical ? <StatusPill value={currentCanonical.status} /> : "缺失"} />
              <InfoRow label="角度" value={getEffectiveCanonicalViewLabel(currentCanonical?.canonicalView)} />
              <InfoRow label="创建时间" value={formatDate(currentCanonical?.createdAt)} />
            </dl>
          </div>

          {/* Task status (collapsible) */}
          <details className="rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-zinc-200">
              任务状态
              <span className="ml-2 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
                {activeCanonicalTasks.length} 进行中 / {failedCanonicalTasks.length} 失败
              </span>
            </summary>
            <div className="space-y-2 border-t border-white/[0.06] px-2.5 py-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-white/10 bg-black/20 p-2 text-zinc-300">
                  <div className="text-zinc-500">进行中</div>
                  <div className="mt-0.5 text-lg font-semibold text-white">{activeCanonicalTasks.length}</div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 p-2 text-zinc-300">
                  <div className="text-zinc-500">失败</div>
                  <div className="mt-0.5 text-lg font-semibold text-white">{failedCanonicalTasks.length}</div>
                </div>
              </div>
              {canonicalRuns.length > 0 && (
                <div className="max-h-48 divide-y divide-white/[0.06] overflow-y-auto rounded-md border border-white/10 text-[10px]">
                  {[...canonicalRuns].reverse().slice(0, 6).map((run) => (
                      <div key={run.id} className="px-2 py-1.5 text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-zinc-200">{compactId(run.id)}</span>
                          <StatusPill value={run.status} />
                          <span className="text-sky-300">{getCanonicalViewLabel(run.canonicalView)}</span>
                        </div>
                        <div className="mt-0.5">{formatDate(run.createdAt)}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </details>

          {/* Manual register (collapsible) */}
          <details className="rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-zinc-200">
              手动登记人设图
            </summary>
            <div className="border-t border-white/[0.06] px-2.5 py-2">
              <form action={registerManualCanonicalAction.bind(null, job.id)} className="space-y-2">
                {manualSourceImages.length === 0 ? (
                  <div className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                    请先上传参考图
                  </div>
                ) : (
                  <label className="block text-[11px] text-zinc-400">
                    源图
                    <select name="sourceImageId" className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-sky-400">
                      {manualSourceImages.map((image) => (
                        <option key={image.id} value={image.id}>{compactId(image.id)}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-[11px] text-zinc-400">
                  角度
                  <select name="canonicalView" className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-sky-400">
                    <option value="">未标注</option>
                    {CANONICAL_VIEW_SPECS.map((view) => (
                      <option key={view.key} value={view.key}>{view.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] text-zinc-400">
                  备注
                  <textarea name="notes" rows={2} className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-sky-400" />
                </label>
                <button disabled={manualSourceImages.length === 0} className="h-7 rounded-md bg-emerald-500 px-2.5 text-[11px] font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                  登记
                </button>
              </form>
            </div>
          </details>

          {/* Stats summary */}
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-[11px] text-zinc-400">
            <div className="flex items-center justify-between">
              <span>总候选</span>
              <span className="text-zinc-200">{report.canonicalVersions.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>已选用</span>
              <span className="text-emerald-300">{selectedCanonical}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>已拒绝</span>
              <span className="text-rose-300">{rejectedCanonical}</span>
            </div>
          </div>
        </div>
      </div>
    </JobPageShell>
  );
}
