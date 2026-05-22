"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { createCharacterLoraTrainingJob } from "@/lib/actions/character-lora-training";
import type { CharacterLoraGpuLock, CharacterLoraJobList, CharacterLoraJobSummary } from "./types";

type Props = {
  jobList: CharacterLoraJobList;
  gpuLock: CharacterLoraGpuLock;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  canonical_pending: "标准图",
  prompt_pending: "提示词",
  section_generating: "分镜生成",
  reviewing: "审核",
  dataset_ready: "数据集",
  training_queued: "训练排队",
  training_running: "训练中",
  trained: "已训练",
  benchmarking: "基准测试",
  benchmark_review: "基准审核",
  promotion_ready: "待发布",
  promoted: "已发布",
  failed: "失败",
  cancelled: "已取消",
  archived: "归档",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

function readJsonObject(value: string, fallback: Record<string, unknown>) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("训练范围必须是 JSON object");
  }

  return parsed as Record<string, unknown>;
}

export function CharacterLoraTrainingClient({ jobList, gpuLock }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trainingScope, setTrainingScope] = useState("{\n  \"purpose\": \"character_identity\"\n}");
  const [query, setQuery] = useState("");

  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return jobList.jobs;
    }

    return jobList.jobs.filter((job) =>
      [job.characterName, job.triggerToken, job.slug, job.baseCheckpointName ?? ""]
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

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      try {
        const characterName = String(formData.get("characterName") ?? "").trim();
        const triggerToken = String(formData.get("triggerToken") ?? "").trim();
        const baseCheckpointName = String(formData.get("baseCheckpointName") ?? "").trim();
        const baseCheckpointPath = String(formData.get("baseCheckpointPath") ?? "").trim();

        const job = await createCharacterLoraTrainingJob({
          characterName,
          triggerToken,
          trainingScope: readJsonObject(trainingScope, { purpose: "character_identity" }),
          captionStrategy: String(formData.get("captionStrategy") ?? "controllable_identity").trim(),
          phase: "setup",
          baseCheckpointName: baseCheckpointName || null,
          baseCheckpointPath: baseCheckpointPath || null,
          baseCheckpointHash: null,
          baseFamily: null,
          createdBy: null,
        });

        toast.success("训练任务已创建", { description: job.characterName });
        router.push(`/character-lora-training/${job.id}`);
        router.refresh();
      } catch (error) {
        toast.error("创建失败", { description: getErrorMessage(error) });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <StatChip label="任务" value={jobList.total} tone="accent" />
        <StatChip label="草稿" value={statusCounts.draft ?? 0} />
        <StatChip label="训练中" value={(statusCounts.training_queued ?? 0) + (statusCounts.training_running ?? 0)} tone="warn" />
        <StatChip label="已发布" value={statusCounts.promoted ?? 0} />
        <StatChip label="GPU 锁" value={gpuLock.current ? "占用" : "空闲"} tone={gpuLock.current ? "warn" : "default"} />
      </div>

      {gpuLock.current ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 truncate">
            当前锁定：{gpuLock.current.taskType} / {gpuLock.current.ownerId}
          </span>
        </div>
      ) : null}

      <SectionCard title="新建训练任务" subtitle="先建立角色任务，再进入详情页补 source、canonical、prompt、section。">
        <form action={handleCreate} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-2">
          <label className="grid gap-1 text-xs text-zinc-400">
            角色名
            <input
              name="characterName"
              required
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：Tangtang"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Trigger
            <input
              name="triggerToken"
              required
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：tangtang"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Base checkpoint 名称
            <input
              name="baseCheckpointName"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="可选"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Base checkpoint 路径
            <input
              name="baseCheckpointPath"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="训练入队前必须填写"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Caption 策略
            <input
              name="captionStrategy"
              defaultValue="controllable_identity"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400 lg:row-span-2">
            Training scope JSON
            <textarea
              value={trainingScope}
              onChange={(event) => setTrainingScope(event.target.value)}
              className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-sky-400"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建并进入
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="任务列表"
        subtitle={`${visibleJobs.length} / ${jobList.total}`}
        actions={
          <div className="flex min-w-0 flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-48 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-sky-400"
              placeholder="过滤角色 / trigger / checkpoint"
            />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        }
      >
        {visibleJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
            暂无训练任务
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1fr_44px] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500">
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
      className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1fr_44px] items-center gap-2 px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.04]"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-white">{job.characterName}</span>
        <span className="mt-1 block truncate font-mono text-[11px] text-zinc-500">{job.triggerToken} / {job.slug}</span>
      </span>
      <span className="min-w-0">
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300">
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
        <span className="mt-1 block truncate text-[11px] text-zinc-500">{job.phase ?? "-"}</span>
      </span>
      <span className="text-xs text-zinc-400">
        src {job.counts.sourceImages} / img {job.counts.candidateImages}
      </span>
      <span className="min-w-0 truncate text-xs text-zinc-500">
        {formatDate(job.updatedAt)}
      </span>
      <span className="flex justify-end text-zinc-500">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
