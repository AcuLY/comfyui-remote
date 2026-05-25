"use client";

import { useEffect, useState } from "react";
import { X, Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTaskPanel, type TrackedTask } from "./task-panel-provider";

// ---------------------------------------------------------------------------
// Elapsed time hook
// ---------------------------------------------------------------------------

function useElapsed(since: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!since) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [since]);

  if (!since) return null;

  const elapsed = Math.max(0, now - new Date(since).getTime());
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: TrackedTask["status"] }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full shrink-0",
        status === "queued" && "bg-zinc-500",
        status === "running" && "bg-sky-400 animate-pulse",
        status === "done" && "bg-emerald-400",
        status === "failed" && "bg-rose-400",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<TrackedTask["type"], string> = {
  canonical: "人设图",
  section: "训练集",
  promptCard: "提示词",
};

function TypeBadge({ type }: { type: TrackedTask["type"] }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
      {TYPE_LABELS[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Task card
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  onDismiss,
  dimmed = false,
}: {
  task: TrackedTask;
  onDismiss?: () => void;
  dimmed?: boolean;
}) {
  const elapsed = useElapsed(task.startedAt ?? task.createdAt);

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2",
        "bg-white/[0.02] border border-white/[0.04] transition-colors",
        "hover:bg-white/[0.04]",
        dimmed && "opacity-50",
      )}
    >
      <StatusDot status={task.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-mono text-zinc-300">
            {task.label}
          </span>
          <TypeBadge type={task.type} />
        </div>
        {task.errorSummary && task.status === "failed" && (
          <p className="mt-0.5 truncate text-[10px] text-rose-400/80">
            {task.errorSummary}
          </p>
        )}
      </div>

      {/* Elapsed time */}
      {elapsed && (
        <span className="shrink-0 text-[10px] font-mono tabular-nums text-zinc-500">
          {elapsed}
        </span>
      )}

      {/* Dismiss button (only for done/failed) */}
      {onDismiss && (task.status === "done" || task.status === "failed") && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
          aria-label="关闭"
        >
          <X className="size-3" />
        </button>
      )}

      {/* Check icon for done */}
      {task.status === "done" && !onDismiss && (
        <Check className="size-3 shrink-0 text-emerald-400" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TaskPanelTaskList() {
  const { activeTasks, recentTasks, dismissTask } = useTaskPanel();
  const [recentExpanded, setRecentExpanded] = useState(false);

  if (activeTasks.length === 0 && recentTasks.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-zinc-600">
        暂无任务
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            进行中 ({activeTasks.length})
          </h4>
          <div className="space-y-1">
            {activeTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onDismiss={
                  task.status === "done" || task.status === "failed"
                    ? () => dismissTask(task.taskId)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent tasks */}
      {recentTasks.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setRecentExpanded(!recentExpanded)}
            className="flex w-full items-center gap-1 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            <span>最近完成 ({recentTasks.length})</span>
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                recentExpanded && "rotate-180",
              )}
            />
          </button>
          {recentExpanded && (
            <div className="space-y-1">
              {recentTasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  onDismiss={() => dismissTask(task.taskId)}
                  dimmed
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
