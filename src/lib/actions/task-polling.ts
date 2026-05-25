"use server";

import { getCharacterLoraWorkerTask } from "@/lib/actions/character-lora-training";

export type PollTaskStatusResult = {
  ok: boolean;
  taskId: string;
  status: string;
  workerType: string;
  progress: unknown;
  errorSummary: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
};

export async function pollTaskStatus(jobId: string, taskId: string): Promise<PollTaskStatusResult> {
  try {
    const task = await getCharacterLoraWorkerTask(taskId);

    if (!task || task.jobId !== jobId) {
      return {
        ok: false,
        taskId,
        status: "not_found",
        workerType: "",
        progress: null,
        errorSummary: "Task not found",
        startedAt: null,
        heartbeatAt: null,
        finishedAt: null,
      };
    }

    return {
      ok: true,
      taskId: task.id,
      status: task.status,
      workerType: task.workerType,
      progress: task.progressJson,
      errorSummary: task.errorSummary ?? null,
      startedAt: task.startedAt ?? null,
      heartbeatAt: task.heartbeatAt ?? null,
      finishedAt: task.finishedAt ?? null,
    };
  } catch {
    return {
      ok: false,
      taskId,
      status: "error",
      workerType: "",
      progress: null,
      errorSummary: "Failed to poll task",
      startedAt: null,
      heartbeatAt: null,
      finishedAt: null,
    };
  }
}
