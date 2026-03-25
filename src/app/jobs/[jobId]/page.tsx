import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { getJobDetail, getJobRevisions } from "@/lib/server-data";
import { JobDetailActions } from "./job-detail-actions";
import { AddSectionButton } from "./section-actions";
import { RevisionHistory } from "./revision-history";
import { SectionList } from "./section-list";

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

      <SectionCard title="小节列表" subtitle="拖动排序、点击名称重命名。每个小节对应一次完整生图的参数集合，可独立运行。">
        <div className="space-y-3">
          {job.positions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
              暂无小节，点击下方按钮添加
            </div>
          ) : (
            <SectionList jobId={job.id} sections={job.positions} />
          )}
          <AddSectionButton jobId={job.id} />
        </div>
      </SectionCard>

      <SectionCard title="修订历史" subtitle="每次编辑参数前自动保存快照，点击展开查看。">
        <RevisionHistory revisions={revisions} jobId={job.id} />
      </SectionCard>
    </div>
  );
}
