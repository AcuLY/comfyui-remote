"use client";

import { Pause, Play, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/design-demo-ui/primitives/button";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";

import type { PrototypeTask, PrototypeTaskStatus } from "../../data";

const BADGE_STATUS: Record<PrototypeTaskStatus, string> = {
  running: "running",
  submitted: "pending",
  queued: "queued",
  paused: "draft",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
};

export function taskStatusLabel(task: PrototypeTask) {
  if (task.module === "training" && task.status === "queued") return "等待中";
  return {
    running: "执行中",
    submitted: "已提交",
    queued: "未提交",
    paused: "已暂停",
    done: "已完成",
    failed: "失败",
    cancelled: "已取消",
  }[task.status];
}

export function statusBadgeFor(task: PrototypeTask) {
  return <StatusBadge status={BADGE_STATUS[task.status]} label={taskStatusLabel(task)} />;
}

export function retryLabel(task: PrototypeTask) {
  if (task.kind === "material") return "补缺重试";
  if (task.kind === "lora") return "重新训练";
  return "重试";
}

export function TaskActions({
  task,
  onPause,
  onCancel,
  onResumeOrRetry,
}: {
  task: PrototypeTask;
  onPause?: () => void;
  onCancel?: () => void;
  onResumeOrRetry?: () => void;
}) {
  if (task.status === "running") {
    return (
      <>
        {task.module === "generation" ? (
          <Button icon={Pause} onClick={onPause} size="sm" ariaLabel="暂停">
            暂停
          </Button>
        ) : null}
        <Button icon={X} onClick={onCancel} size="sm" tone="subtle" ariaLabel="取消">
          取消
        </Button>
      </>
    );
  }
  if (task.status === "submitted" || task.status === "queued") {
    return (
      <Button icon={X} onClick={onCancel} size="sm" tone="subtle" ariaLabel="取消">
        取消
      </Button>
    );
  }
  if (task.status === "paused") {
    return (
      <Button icon={Play} onClick={onResumeOrRetry} size="sm" ariaLabel="恢复">
        恢复
      </Button>
    );
  }
  if (task.status === "failed" || task.status === "cancelled") {
    return (
      <Button icon={RotateCcw} onClick={onResumeOrRetry} size="sm" ariaLabel={retryLabel(task)}>
        {retryLabel(task)}
      </Button>
    );
  }
  return null;
}
