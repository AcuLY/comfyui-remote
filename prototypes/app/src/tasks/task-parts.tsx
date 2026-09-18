import { Button } from "primereact/button";
import { Tag } from "primereact/tag";

import type { PrototypeTask, PrototypeTaskStatus } from "../data";

const STATUS_LABELS: Record<PrototypeTaskStatus, string> = {
  running: "执行中",
  submitted: "已提交",
  queued: "未提交",
  paused: "已暂停",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export function taskStatusLabel(task: PrototypeTask) {
  if (task.module === "training" && task.status === "queued") return "等待中";
  return STATUS_LABELS[task.status];
}

const STATUS_SEVERITY: Record<PrototypeTaskStatus, "success" | "info" | "warning" | "danger" | undefined> = {
  running: "success",
  submitted: "warning",
  queued: "info",
  paused: undefined,
  done: "success",
  failed: "danger",
  cancelled: undefined,
};

export function StatusTag({ task, className }: { task: PrototypeTask; className?: string }) {
  return <Tag value={taskStatusLabel(task)} rounded severity={STATUS_SEVERITY[task.status]} className={className} />;
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
          <Button size="small" icon="pi pi-pause" label="暂停" aria-label="暂停" onClick={onPause} />
        ) : null}
        <Button size="small" text severity="secondary" icon="pi pi-times" label="取消" aria-label="取消" onClick={onCancel} />
      </>
    );
  }
  if (task.status === "submitted" || task.status === "queued") {
    return (
      <Button size="small" text severity="secondary" icon="pi pi-times" label="取消" aria-label="取消" onClick={onCancel} />
    );
  }
  if (task.status === "paused") {
    return (
      <Button size="small" icon="pi pi-play" label="恢复" aria-label="恢复" onClick={onResumeOrRetry} />
    );
  }
  if (task.status === "failed" || task.status === "cancelled") {
    return (
      <Button size="small" icon="pi pi-replay" label={retryLabel(task)} aria-label={retryLabel(task)} onClick={onResumeOrRetry} />
    );
  }
  return null;
}
