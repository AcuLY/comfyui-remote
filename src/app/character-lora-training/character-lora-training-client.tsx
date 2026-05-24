"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";

import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import type { CharacterLoraJobList, CharacterLoraJobSummary } from "./types";

type Props = {
  jobList: CharacterLoraJobList;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  canonical_pending: "人设图",
  prompt_pending: "提示词",
  section_generating: "训练集生成",
  reviewing: "审核",
  dataset_ready: "数据集",
  training_queued: "训练排队",
  training_running: "训练中",
  trained: "已训练",
  benchmarking: "训练后处理",
  benchmark_review: "训练后处理",
  promotion_ready: "已训练",
  promoted: "已训练",
  failed: "失败",
  cancelled: "已取消",
  archived: "归档",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CharacterLoraTrainingClient({ jobList }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return jobList.jobs;

    return jobList.jobs.filter((job) =>
      [job.characterName, job.triggerToken, job.slug]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [jobList.jobs, query]);

  const statusCounts = useMemo(() => {
    return jobList.jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [jobList.jobs]);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip label="训练项目" value={jobList.total} tone="accent" />
          <StatChip label="草稿" value={statusCounts.draft ?? 0} />
          <StatChip label="训练中" value={(statusCounts.training_queued ?? 0) + (statusCounts.training_running ?? 0)} tone="warn" />
          <StatChip label="已完成" value={statusCounts.trained ?? 0} />
        </div>
        <Link
          href="/character-lora-training/new"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 sm:w-auto"
        >
          <Plus className="size-4" />
          新建训练项目
        </Link>
      </div>

      <SectionCard
        title="训练项目"
        subtitle={`${visibleJobs.length} / ${jobList.total}`}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-sky-400 sm:h-8 sm:w-56"
              placeholder="过滤项目名 / trigger"
            />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-1 rounded-lg border border-white/10 px-2 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-60 sm:h-8 sm:w-auto"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        }
      >
        {visibleJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
            暂无训练项目
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden rounded-lg border border-white/10">
            <div className="hidden grid-cols-[1.4fr_0.9fr_0.8fr_1fr_44px] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500 sm:grid">
              <span>角色</span>
              <span>状态</span>
              <span>素材</span>
              <span>更新时间</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {visibleJobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function JobRow({ job }: { job: CharacterLoraJobSummary }) {
  return (
    <Link
      href={`/character-lora-training/${job.id}`}
      className="grid min-w-0 gap-2 px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.04] sm:grid-cols-[1.4fr_0.9fr_0.8fr_1fr_44px] sm:items-center"
    >
      <span className="min-w-0">
        <span className="block break-words font-medium text-white sm:truncate">{job.characterName}</span>
        <span className="mt-1 block break-all font-mono text-[11px] text-zinc-500 sm:truncate">
          {job.triggerToken} / {job.slug}
        </span>
      </span>
      <span className="min-w-0">
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300">
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
        <span className="mt-1 block break-words text-[11px] text-zinc-500 sm:truncate">{job.phase ?? "-"}</span>
      </span>
      <span className="text-xs text-zinc-400">
        src {job.counts.sourceImages} / img {job.counts.candidateImages}
      </span>
      <span className="min-w-0 break-words text-xs text-zinc-500 sm:truncate">{formatDate(job.updatedAt)}</span>
      <span className="hidden justify-end text-zinc-500 sm:flex">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
