import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getJobs } from "@/lib/server-data";
import type { JobListFilters } from "@/lib/server-data";
import type { JobCard } from "@/lib/types";
import { JobCopyButton, JobRunButton } from "./[jobId]/job-run-controls";

type JobsPageSearchParams = Promise<{
  search?: string;
  status?: JobCard["status"];
  enabledOnly?: string;
  hasPending?: string;
}>;

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

const STATUS_OPTIONS: Array<{ value: JobCard["status"] | ""; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "draft", label: "draft" },
  { value: "queued", label: "queued" },
  { value: "running", label: "running" },
  { value: "partial_done", label: "partial_done" },
  { value: "done", label: "done" },
  { value: "failed", label: "failed" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: JobsPageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const filters: JobListFilters = {
    search: resolvedSearchParams.search?.trim() || undefined,
    status: (resolvedSearchParams.status as JobListFilters["status"]) || "",
    enabledOnly: resolvedSearchParams.enabledOnly === "true",
    hasPending: resolvedSearchParams.hasPending === "true",
  };
  const jobs = await getJobs(filters);

  return (
    <div className="space-y-4">
      <PageHeader
        title="大任务"
        description="管理 Character、场景、风格与 position 组合。"
        actions={
          <Link
            href="/jobs/new"
            className="inline-flex items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
          >
            新建任务
          </Link>
        }
      />
      <SectionCard title="任务筛选" subtitle="优先查看特定状态、待审核结果或关键词匹配的任务。">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px_auto_auto_auto] md:items-end">
          <label className="space-y-1.5 text-xs text-zinc-400">
            <span>搜索</span>
            <input
              type="search"
              name="search"
              defaultValue={filters.search}
              placeholder="任务名 / slug / Character / 场景 / 风格"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </label>
          <label className="space-y-1.5 text-xs text-zinc-400">
            <span>状态</span>
            <select
              name="status"
              defaultValue={filters.status}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
            <input type="checkbox" name="enabledOnly" value="true" defaultChecked={filters.enabledOnly} className="size-4" />
            仅看有启用 position
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
            <input type="checkbox" name="hasPending" value="true" defaultChecked={filters.hasPending} className="size-4" />
            仅看待审核
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
            >
              应用筛选
            </button>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300"
            >
              重置
            </Link>
          </div>
        </form>
      </SectionCard>
      <SectionCard title="任务列表" subtitle="支持复制任务、运行整组、运行单个 position。">
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-zinc-400">
              当前筛选下没有任务。
            </div>
          ) : null}
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
