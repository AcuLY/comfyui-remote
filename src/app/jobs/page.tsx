import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getJobs } from "@/lib/server-data";
import type { JobCard } from "@/lib/types";
import { JobCopyButton, JobRunButton } from "./[jobId]/job-run-controls";

function formatLatestRunLine(job: JobCard) {
  if (!job.latestRunAt || !job.latestRunStatus) {
    return "最近运行：暂无";
  }

  const reviewSummary =
    typeof job.latestRunPendingCount === "number" && typeof job.latestRunTotalCount === "number"
      ? ` · 审核 ${job.latestRunPendingCount}/${job.latestRunTotalCount} pending`
      : "";

  return `最近运行：${job.latestRunStatus} · ${job.latestRunAt}${reviewSummary}`;
}

function formatPositionLine(job: JobCard) {
  if (typeof job.enabledPositionCount === "number") {
    return `${job.enabledPositionCount}/${job.positionCount} 个启用 position`;
  }

  return `${job.positionCount} 个 position`;
}

export default async function JobsPage() {
  const jobs = await getJobs();
  return (
    <div className="space-y-4">
      <PageHeader title="大任务" description="管理 Character、场景、风格与 position 组合。" />
      <SectionCard title="任务列表" subtitle="支持复制任务、运行整组、运行单个 position。">
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
              <div className="mt-3 space-y-1 text-xs text-zinc-500">
                <div>最近更新：{job.updatedAt}</div>
                <div>{formatPositionLine(job)}</div>
                <div>{formatLatestRunLine(job)}</div>
              </div>
              <div className="mt-4 grid gap-2 text-xs md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Link
                  href={`/jobs/${job.id}/edit`}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200"
                >
                  编辑
                </Link>
                <JobCopyButton jobId={job.id} />
                <div className="md:col-span-2">
                  <JobRunButton jobId={job.id} />
                </div>
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
