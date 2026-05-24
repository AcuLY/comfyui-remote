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
import { enqueueSectionRunAction, reviewCandidateAction, updateCaptionAction } from "../../workflow-actions";

export const dynamic = "force-dynamic";

async function enqueueSectionRunFormAction(sectionId: string, jobId: string, formData: FormData): Promise<void> {
  "use server";

  await enqueueSectionRunAction(sectionId, jobId, formData);
}

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
  const blockingReasons = [
    !section.canonicalVersionId ? "模块未绑定 canonical lineage" : null,
    !section.promptCardVersionId ? "模块未绑定 prompt card lineage" : null,
    section.status === "paused" ? "模块已暂停" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const canGenerate = blockingReasons.length === 0;

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
          <form action={enqueueSectionRunFormAction.bind(null, section.id, job.id)} className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            {!canGenerate ? (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                阻塞：{blockingReasons.join("；")}
              </div>
            ) : null}
            <label className="block text-xs text-zinc-400">
              生成器
              <select name="provider" defaultValue="openai-codex" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400">
                <option value="openai-codex">openai-codex</option>
                <option value="mock-local">mock-local</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              本轮生成指令
              <textarea name="userInstruction" rows={4} placeholder="补充角度、姿势、构图或修正要求" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
            </label>
            <label className="block text-xs text-zinc-400">
              负面提示词
              <input name="negativePrompt" placeholder="可选" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400" />
            </label>
            <button disabled={!canGenerate} className="h-9 rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              入队生成本模块
            </button>
          </form>
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
    </JobPageShell>
  );
}
