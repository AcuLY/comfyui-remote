import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getJobs } from "@/lib/server-data";

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
      <SectionCard title="大任务" subtitle="点击卡片进入详情页，在详情页中编辑参数和管理小节。">
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{job.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{job.characterName} · {job.sceneName} · {job.styleName}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{job.status}</span>
                  <ChevronRight className="size-4 text-zinc-500" />
                </div>
              </div>
              <div className="mt-3 text-xs text-zinc-500">最近更新：{job.updatedAt} · {job.positionCount} 个 position</div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
