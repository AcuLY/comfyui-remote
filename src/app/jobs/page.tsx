import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getJobs } from "@/lib/server-data";
import { JobActions } from "./job-actions";

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
        >
          <Plus className="size-4" /> 创建新任务
        </Link>
      </div>
      <SectionCard title="大任务" subtitle="支持复制任务、运行整组、运行单个 position。">
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{job.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{job.characterName} · {job.sceneName} · {job.styleName}</div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{job.status}</span>
              </div>
              <div className="mt-3 text-xs text-zinc-500">最近更新：{job.updatedAt} · {job.positionCount} 个 position</div>
              <div className="mt-4">
                <JobActions jobId={job.id} />
              </div>
              <div className="mt-3 flex justify-end">
                <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1 text-xs text-sky-300">查看详情 <Sparkles className="size-3.5" /></Link>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
