import { getWorkerTaskId } from "@/server/worker/training/task-id";
import type { WorkerTarget } from "@/server/worker/training/target-discovery";

export type SerializedWorkerTaskInput = {
  errorSummary?: string | null;
  leaseOwner?: string | null;
  progressJson?: unknown;
  status?: "running" | "succeeded" | "failed";
};

export function serializeWorkerTask(target: WorkerTarget, input: SerializedWorkerTaskInput = {}) {
  const now = new Date().toISOString();
  return {
    id: getWorkerTaskId(target),
    jobId: target.projectId,
    workerType: target.workerType,
    targetType: target.targetType,
    targetId: target.id,
    status: input.status ?? "running",
    payload: {
      projectId: target.projectId,
      taskType: target.workerType,
    },
    leaseOwner: input.leaseOwner ?? null,
    leaseExpiresAt: null,
    attemptCount: 1,
    progressJson: input.progressJson ?? null,
    startedAt: target.status === "running" ? now : null,
    heartbeatAt: input.progressJson ? now : null,
    finishedAt: input.status === "succeeded" || input.status === "failed" ? now : null,
    errorSummary: input.errorSummary ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
