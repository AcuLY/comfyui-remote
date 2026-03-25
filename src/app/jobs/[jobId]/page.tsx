import Link from "next/link";
import { ArrowLeft, Layers, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { getJobDetail, getJobRevisions } from "@/lib/server-data";
import { JobDetailActions, PositionRunButton } from "./job-detail-actions";
import { RevisionHistory } from "./revision-history";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const [job, revisions] = await Promise.all([
    getJobDetail(jobId),
    getJobRevisions(jobId),
  ]);
  if (!job) notFound();

  return (
    <div className="space-y-4">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回任务列表
      </Link>
      <SectionCard title={job.title} subtitle={`${job.characterName} · ${job.sceneName} · ${job.styleName}`}>
        <JobDetailActions jobId={job.id} />
      </SectionCard>

      <SectionCard title="参数概览" subtitle="结果侧与任务侧都默认编辑当前大任务配置。">
        <div className="space-y-3 text-sm text-zinc-300">
          <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Character prompt</div><div className="mt-1">{job.characterPrompt}</div></div>
          {job.scenePrompt && <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Scene prompt</div><div className="mt-1">{job.scenePrompt}</div></div>}
          {job.stylePrompt && <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Style prompt</div><div className="mt-1">{job.stylePrompt}</div></div>}
          <Link
            href={`/jobs/${jobId}/edit`}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
          >
            <SlidersHorizontal className="size-4" /> 编辑当前大任务参数
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="Position 列表" subtitle="支持只运行某一节，不必先改参数。">
        <div className="space-y-3">
          {job.positions.map((position) => (
            <div key={position.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">{position.name}</div>
                    {position.promptBlockCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                        <Layers className="size-3" />
                        {position.promptBlockCount} blocks
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    batch {position.batchSize ?? "—"} · {position.aspectRatio ?? "—"} · {position.latestRunStatus ?? "no runs"}
                  </div>
                </div>
                <PositionRunButton positionId={position.id} />
              </div>
              <Link
                href={`/jobs/${jobId}/positions/${position.id}/blocks`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.08]"
              >
                <Layers className="size-3.5" />
                提示词块
              </Link>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="修订历史" subtitle="每次编辑参数前自动保存快照，点击展开查看。">
        <RevisionHistory revisions={revisions} jobId={job.id} />
      </SectionCard>
    </div>
  );
}
