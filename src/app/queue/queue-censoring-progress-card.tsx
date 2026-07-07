"use client";

import type { CensoringProgressItem } from "@/lib/types";

type CensoringProgressCardProps = {
  item: CensoringProgressItem;
  onCancel: (projectId: string) => void;
  onPause: (projectId: string) => void;
  onResume: (projectId: string) => void;
};

export function CensoringProgressCard({
  item,
  onCancel,
  onPause,
  onResume,
}: CensoringProgressCardProps) {
  const percent = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
  const isPaused = item.paused > 0 && item.queued === 0 && item.running === 0;

  return (
    <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-200">{item.projectTitle}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            已完成 {item.done} · 运行中 {item.running} · 队列中 {item.queued}
            {item.paused > 0 && <span className="text-sky-400"> · 已暂停 {item.paused}</span>}
            {item.failed > 0 && <span className="text-rose-400"> · 失败 {item.failed}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isPaused ? (
            <button
              type="button"
              onClick={() => onResume(item.projectId)}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 transition hover:bg-emerald-500/20"
            >
              继续
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPause(item.projectId)}
              className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 transition hover:bg-sky-500/20"
            >
              暂停
            </button>
          )}
          <button
            type="button"
            onClick={() => onCancel(item.projectId)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"
          >
            取消
          </button>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-400">
            {isPaused ? "已暂停" : "打码进度"} {item.done}/{item.total}
          </span>
          <span className="font-mono text-amber-200">{percent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isPaused ? "bg-sky-400" : "bg-amber-400"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
