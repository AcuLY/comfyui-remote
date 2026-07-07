"use client";

import { Clock3, Loader2, Pause, Play, Shield, Trash2, XCircle } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import type { CensoringProgressItem, RunningRun } from "@/lib/types";
import { CensoringProgressCard } from "./queue-censoring-progress-card";

type QueueRunningTabProps = {
  runningRuns: RunningRun[];
  censoringProgress: CensoringProgressItem[];
  isPending: boolean;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onClearActiveRuns: () => void;
  onPauseRun: (runId: string) => void;
  onResumeRun: (runId: string) => void;
  onCancelRun: (runId: string) => void;
  onCancelCensoring: (projectId: string) => void;
  onPauseCensoring: (projectId: string) => void;
  onResumeCensoring: (projectId: string) => void;
};

function RunProgressView({ run }: { run: RunningRun }) {
  const progress = run.progress;
  const percent = progress ? Math.round(Math.max(0, Math.min(100, progress.percent))) : 0;
  const isQueued = run.status === "queued";
  const statusText = progress
    ? progress.percent >= 100
      ? "采样完成，正在收尾"
      : `采样 ${progress.currentStep}/${progress.totalSteps}`
    : isQueued
      ? "等待 ComfyUI 调度"
      : "等待采样日志";
  const metaItems = progress
    ? [
        progress.elapsed ? `已用 ${progress.elapsed}` : null,
        progress.remaining ? `剩余 ${progress.remaining}` : null,
        progress.rate,
        progress.stage > 1 ? `阶段 ${progress.stage}` : null,
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="min-w-0 truncate text-zinc-400">{statusText}</span>
        <span className={`shrink-0 font-mono ${progress ? "text-amber-200" : "text-zinc-500"}`}>
          {progress ? `${percent}%` : "--"}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={progress ? "ComfyUI 采样进度" : statusText}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress ? percent : undefined}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress
              ? "bg-amber-300"
              : isQueued
                ? "bg-zinc-700"
                : "animate-pulse bg-zinc-500"
          }`}
          style={{ width: progress ? `${percent}%` : isQueued ? "0%" : "12%" }}
        />
      </div>
      {metaItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-500">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function QueueRunningTab({
  runningRuns,
  censoringProgress,
  isPending,
  onPauseAll,
  onResumeAll,
  onClearActiveRuns,
  onPauseRun,
  onResumeRun,
  onCancelRun,
  onCancelCensoring,
  onPauseCensoring,
  onResumeCensoring,
}: QueueRunningTabProps) {
  return (
    <SectionCard title="运行中" subtitle="自动每 5 秒刷新。">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {runningRuns.some((r) => r.status === "queued" || r.status === "running") && (
          <button
            type="button"
            disabled={isPending}
            onClick={onPauseAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40"
          >
            <Pause className="size-3.5" /> 全部暂停
          </button>
        )}
        {runningRuns.some((r) => r.status === "paused") && (
          <button
            type="button"
            disabled={isPending}
            onClick={onResumeAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Play className="size-3.5" /> 全部恢复
          </button>
        )}
        <button
          type="button"
          disabled={isPending || runningRuns.length === 0}
          onClick={onClearActiveRuns}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> 清空运行中队列
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
        {runningRuns.length === 0 && (
          <div className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center text-sm text-zinc-500 md:col-span-2">
            暂无运行中的项目
          </div>
        )}
        {runningRuns.map((run) => (
          <div
            key={run.id}
            id={`run-${run.id}`}
            className={`w-full rounded-xl border p-3 md:max-w-[500px] ${
              run.status === "paused"
                ? "border-amber-500/20 bg-amber-500/[0.03]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{run.projectTitle}</div>
                <div className="mt-1 text-xs text-zinc-400">{run.projectTitle}：{run.sectionName}</div>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] ${
                run.status === "paused"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                  : run.status === "running"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                    : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
              }`}>
                {run.status === "paused" ? (
                  <>
                    <Pause className="mr-1 inline size-3" />
                    已暂停
                  </>
                ) : (
                  <>
                    <Loader2 className={`mr-1 inline size-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                    {run.status === "running" ? "运行中" : "排队中"}
                  </>
                )}
              </span>
            </div>
            {run.status !== "paused" && <RunProgressView run={run} />}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-3 text-xs text-zinc-400">
                <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <Clock3 className="mb-1 size-3.5" />
                  {run.startedAt}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {run.status === "paused" ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onResumeRun(run.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <Play className="size-3" /> 恢复
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onPauseRun(run.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <Pause className="size-3" /> 暂停
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onCancelRun(run.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <XCircle className="size-3" /> 取消
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {censoringProgress.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Shield className="size-3.5 text-amber-400" />
            <span>打码任务</span>
          </div>
          {censoringProgress.map((item) => (
            <CensoringProgressCard
              key={item.projectId}
              item={item}
              onCancel={onCancelCensoring}
              onPause={onPauseCensoring}
              onResume={onResumeCensoring}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
