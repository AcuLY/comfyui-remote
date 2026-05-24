import { notFound } from "next/navigation";

import {
  getCharacterLoraJobReport,
  getCharacterLoraTrainingJob,
} from "@/lib/actions/character-lora-training";
import {
  CANONICAL_VIEW_SPECS,
  getCanonicalViewLabel,
} from "@/lib/character-lora-canonical-views";
import {
  ArtifactThumb,
  ImageStrip,
  InfoRow,
  JobPageShell,
  SimpleSection,
  StatusPill,
  compactId,
  formatDate,
} from "../shared-ui";
import { SourceImageUploader } from "../source-image-uploader";
import { WorkflowActionForm } from "../workflow-action-form";
import {
  enqueueCanonicalAction,
  registerManualCanonicalAction,
  rejectCanonicalAction,
  rerunCanonicalAction,
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
  const manualSourceImages = report.sourceImages;
  const selectedCanonical = report.canonicalVersions.filter((version) => version.status === "selected").length;
  const rejectedCanonical = report.canonicalVersions.filter((version) => version.status === "rejected").length;
  const canonicalRuns = report.generationRuns.filter((run) => run.kind === "canonical");
  const canonicalRunIds = new Set(canonicalRuns.map((run) => run.id));
  const canonicalTasks = report.workerTasks.filter(
    (task) => task.workerType === "image_generation" && task.targetType === "generationRun" && canonicalRunIds.has(task.targetId),
  );
  const canonicalTaskByRunId = new Map(canonicalTasks.map((task) => [task.targetId, task]));
  const activeCanonicalTasks = canonicalTasks.filter((task) => task.status === "queued" || task.status === "running");
  const failedCanonicalTasks = canonicalTasks.filter((task) => task.status === "failed");
  const latestCanonicalRun = canonicalRuns.at(-1) ?? null;

  return (
    <JobPageShell
      job={job}
      currentPath="persona-reference"
      title={`${job.characterName} / 人设参考图`}
      description="上传源图、发起人设图生成，并选择当前训练使用的人设参考图。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SimpleSection title="上传源图" subtitle="项目创建后可继续补充参考源图">
            <SourceImageUploader uploadAction={uploadSourceImageAction.bind(null, job.id)} />
          </SimpleSection>

          <SimpleSection title="初始参考图" subtitle={`${report.sourceImages.length} 张`}>
            <ImageStrip jobId={job.id} images={report.sourceImages} emptyLabel="暂无初始参考图" />
          </SimpleSection>

          <SimpleSection title="生成人设图" subtitle={report.sourceImages.length > 0 ? "使用选中的源图分别入队生成正面/背面/左侧/右侧四张 canonical" : "需要先上传源图"}>
            <WorkflowActionForm
              action={enqueueCanonicalAction.bind(null, job.id)}
              submitLabel="入队生成四视图人设图"
              pendingLabel="正在入队"
              successMessage="四视图人设图任务已入队"
              disabled={report.sourceImages.length === 0}
              className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
              buttonClassName="inline-flex h-9 items-center rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {report.sourceImages.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {report.sourceImages.map((image) => (
                    <label key={image.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-300">
                      <input name="sourceImageIds" value={image.id} type="checkbox" className="size-3.5 accent-sky-500" />
                      <span className="font-mono text-zinc-500">{compactId(image.id)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  阻塞：当前项目没有源图，无法入队 canonical 生成。
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-zinc-400">
                  生成器
                  <select name="provider" defaultValue="openai-codex" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400">
                    <option value="openai-codex">openai-codex</option>
                    <option value="mock-local">mock-local</option>
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  负面提示词
                  <input name="negativePrompt" placeholder="可选" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
                </label>
              </div>
              <label className="block text-xs text-zinc-400">
                角色描述（可选，建议先由 AI 草拟提示词卡从原始参考图提取）
                <textarea name="characterDescription" rows={5} placeholder="粘贴从原始参考图提取的细致角色描述：发型、眼睛、服装、配色、鞋袜、配饰、非对称细节..." className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
              </label>
              <label className="block text-xs text-zinc-400">
                成品提示词（可选）
                <textarea name="finalPromptDraft" rows={4} placeholder="例如：rabbitbluerosechar, bunny ears, long light blue hair...；会拼接到每个角度的生图提示词中" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
              </label>
              <label className="block text-xs text-zinc-400">
                视觉提示补充
                <textarea name="visualPrompt" rows={3} placeholder="留空使用默认四视图人设图生成提示；这里填写的补充会应用到四条任务" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
              </label>
            </WorkflowActionForm>
          </SimpleSection>

          <SimpleSection title="人设图任务状态" subtitle={`${canonicalRuns.length} 个 generation run / ${canonicalTasks.length} 个 worker task`}>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">最新 run</div>
                <div className="mt-1 font-mono text-zinc-100">{compactId(latestCanonicalRun?.id)}</div>
                <div className="mt-1">{latestCanonicalRun ? <StatusPill value={latestCanonicalRun.status} /> : "-"}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">进行中任务</div>
                <div className="mt-1 text-xl font-semibold text-white">{activeCanonicalTasks.length}</div>
                <div className="mt-1 text-zinc-500">queued/running worker tasks</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-500">失败任务</div>
                <div className="mt-1 text-xl font-semibold text-white">{failedCanonicalTasks.length}</div>
                <div className="mt-1 text-zinc-500">failed worker tasks</div>
              </div>
            </div>
            {canonicalRuns.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-zinc-500">
                暂无人设图生成任务。入队后这里会显示 run / worker task / lease / heartbeat。
              </div>
            ) : (
              <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
                {[...canonicalRuns].reverse().map((run) => {
                  const task = canonicalTaskByRunId.get(run.id);
                  return (
                    <div key={run.id} className="grid gap-2 p-3 text-xs text-zinc-400 md:grid-cols-[0.85fr_0.85fr_1fr_1fr]">
                      <div className="min-w-0">
                        <div className="font-mono text-zinc-100">{compactId(run.id)}</div>
                        <div className="mt-1 text-sky-200">{getCanonicalViewLabel(run.canonicalView)}</div>
                        <div className="mt-1"><StatusPill value={run.status} /></div>
                        <div className="mt-1">{formatDate(run.createdAt)}</div>
                      </div>
                      <div className="min-w-0 break-words">
                        <div className="text-zinc-200">{run.provider}</div>
                        <div>{run.imageModel ?? run.hostModel ?? "-"}</div>
                        <div>request {compactId(run.requestArtifactId)}</div>
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

          <SimpleSection title="人设图候选" subtitle={`${report.canonicalVersions.length} 个版本，${selectedCanonical} selected / ${rejectedCanonical} rejected`}>
            {report.canonicalVersions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
                暂无人设图候选
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {report.canonicalVersions.map((version) => {
                  const artifact = version.artifact;
                  const canRerun = Boolean(artifact?.id && artifact.relativePath && artifact.sha256);
                  return (
                    <div key={version.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <ArtifactThumb jobId={job.id} relativePath={artifact?.relativePath} alt={version.id} />
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-zinc-200">v{version.version}</span>
                        <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">{getCanonicalViewLabel(version.canonicalView)}</span>
                        <StatusPill value={version.id === job.currentCanonicalVersionId ? "当前" : version.status} />
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">{compactId(version.id)}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <form action={selectCanonicalAction.bind(null, job.id, version.id)}>
                          <button disabled={version.id === job.currentCanonicalVersionId || version.status === "rejected"} className="h-8 w-full rounded-md bg-sky-500 px-2 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                            选用
                          </button>
                        </form>
                        <form action={rejectCanonicalAction.bind(null, job.id, version.id)}>
                          <button disabled={version.id === job.currentCanonicalVersionId || version.status === "rejected"} className="h-8 w-full rounded-md border border-rose-500/30 px-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                            拒绝
                          </button>
                        </form>
                      </div>
                      <WorkflowActionForm
                        action={rerunCanonicalAction.bind(null, job.id)}
                        submitLabel="基于此人设图重生"
                        pendingLabel="重生入队中"
                        successMessage="人设图重生任务已入队"
                        disabled={!canRerun}
                        className="mt-2 space-y-2 rounded-lg border border-sky-400/20 bg-sky-500/10 p-2"
                        buttonClassName="h-8 w-full rounded-md bg-sky-500 px-2 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <input type="hidden" name="provider" value="openai-codex" />
                        <input type="hidden" name="canonicalView" value={version.canonicalView ?? ""} />
                        <input type="hidden" name="artifactId" value={artifact?.id ?? ""} />
                        <input type="hidden" name="relativePath" value={artifact?.relativePath ?? ""} />
                        <input type="hidden" name="sha256" value={artifact?.sha256 ?? ""} />
                        <textarea name="userInstruction" rows={3} required placeholder="自然语言说明要调整的地方：表情、角度、细节、配色..." className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs leading-5 text-zinc-200 outline-none transition focus:border-sky-400" />
                        <input name="negativePrompt" placeholder="负面提示词（可选）" className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200 outline-none transition focus:border-sky-400" />
                      </WorkflowActionForm>
                    </div>
                  );
                })}
              </div>
            )}
          </SimpleSection>
        </div>

        <div className="space-y-4">
          <SimpleSection title="当前人设图" subtitle={currentCanonical ? `v${currentCanonical.version}` : "缺失"}>
            <dl>
              <InfoRow label="版本" value={currentCanonical ? `v${currentCanonical.version}` : "缺失"} />
              <InfoRow label="状态" value={currentCanonical ? <StatusPill value={currentCanonical.status} /> : "缺失"} />
              <InfoRow label="角度" value={getCanonicalViewLabel(currentCanonical?.canonicalView)} />
              <InfoRow label="创建时间" value={formatDate(currentCanonical?.createdAt)} />
              <InfoRow label="备注" value={currentCanonical?.notes ?? "-"} />
            </dl>
          </SimpleSection>

          <SimpleSection title="手动登记人设图" subtitle={manualSourceImages.length > 0 ? "从已上传参考图创建 canonical" : "需先上传参考图"}>
            <form action={registerManualCanonicalAction.bind(null, job.id)} className="space-y-3">
              {manualSourceImages.length === 0 ? (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  阻塞：请先上传一张可作为人设图的参考图。
                </div>
              ) : (
                <label className="block text-xs text-zinc-400">
                  源图
                  <select name="sourceImageId" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400">
                    {manualSourceImages.map((image) => (
                      <option key={image.id} value={image.id}>{compactId(image.id)}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-xs text-zinc-400">
                角度
                <select name="canonicalView" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400">
                  <option value="">未标注</option>
                  {CANONICAL_VIEW_SPECS.map((view) => (
                    <option key={view.key} value={view.key}>{view.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                备注
                <textarea name="notes" rows={3} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
              </label>
              <button disabled={manualSourceImages.length === 0} className="h-9 rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                登记为人设图
              </button>
            </form>
          </SimpleSection>
        </div>
      </div>
    </JobPageShell>
  );
}
