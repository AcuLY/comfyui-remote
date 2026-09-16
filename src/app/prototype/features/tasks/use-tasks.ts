"use client";

import { useCallback, useState } from "react";

import {
  initialPrototypeTasks,
  type PrototypeTask,
  type PrototypeTaskStatus,
} from "../../data";

export const ACTIVE_TASK_STATES: PrototypeTaskStatus[] = ["running", "submitted", "queued"];

export function isTerminalTask(task: PrototypeTask) {
  return ["done", "failed", "cancelled"].includes(task.status);
}

export function taskKindLabel(task: PrototypeTask) {
  if (task.kind === "lora") return "LoRA 训练";
  if (task.kind === "material") return "素材生成";
  return "图片生产";
}

export function taskUnit(task: PrototypeTask) {
  return task.kind === "lora" ? "步" : "张";
}

export const TASK_STATUS_LABELS: Record<PrototypeTaskStatus, string> = {
  running: "执行中",
  submitted: "已提交",
  queued: "未提交",
  paused: "已暂停",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export type TaskActionError = "training-run-blocked" | null;

export function usePrototypeTasks() {
  const [tasks, setTasks] = useState<PrototypeTask[]>(initialPrototypeTasks);

  const setTaskStatus = useCallback((id: string, status: PrototypeTaskStatus) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, status, error: undefined } : task)),
    );
  }, []);

  const pauseTask = useCallback((id: string) => setTaskStatus(id, "paused"), [setTaskStatus]);
  const cancelTask = useCallback((id: string) => setTaskStatus(id, "cancelled"), [setTaskStatus]);

  const resumeOrRetryTask = useCallback(
    (task: PrototypeTask): TaskActionError => {
      if (
        task.kind === "lora"
        && tasks.some((item) => item.kind === "lora" && ACTIVE_TASK_STATES.includes(item.status))
      ) {
        return "training-run-blocked";
      }
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, status: "queued", error: undefined, attempt: (item.attempt ?? 1) + 1 }
            : item,
        ),
      );
      return null;
    },
    [tasks],
  );

  const removeTasks = useCallback((ids: string[]) => {
    setTasks((current) => current.filter((task) => !ids.includes(task.id)));
  }, []);

  return { tasks, pauseTask, cancelTask, resumeOrRetryTask, removeTasks };
}

export type PrototypeTasksState = ReturnType<typeof usePrototypeTasks>;
