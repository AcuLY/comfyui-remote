import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { getJobDetail } from "@/lib/server-data";
import { JobDetailActions, PositionRunButton } from "./job-detail-actions";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);
  if (!job) notFound();

  return (
    <div className="space-y-4">
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
                <div>
                  <div className="text-sm font-semibold text-white">{position.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    batch {position.batchSize ?? "—"} · {position.aspectRatio ?? "—"} · {position.latestRunStatus ?? "no runs"}
                  </div>
                </div>
                <PositionRunButton positionId={position.id} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
