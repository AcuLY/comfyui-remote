import {
  completeLegacyTrainingWorkerTask,
  failLegacyTrainingWorkerTask,
  getLegacyTrainingWorkerQueueStatus,
  heartbeatLegacyTrainingWorkerTask,
  leaseNextLegacyTrainingWorkerTask,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";
import {
  trainingWorkerTaskCompleteRequestSchema,
  trainingWorkerTaskFailRequestSchema,
  trainingWorkerTaskHeartbeatRequestSchema,
  trainingWorkerTaskLeaseRequestSchema,
} from "@/lib/training/schemas";
import { listManagedTrainingRuns } from "@/server/services/training/project-service";
import type { LoraTrainingRun } from "@/features/training/types";

const MANAGED_WORKER_TASK_ID_PREFIX = "managed-worker-task-";

type ManagedWorkerTaskInput = {
  leaseOwner?: string | null;
  progressJson?: unknown;
  status?: "running" | "succeeded" | "failed";
  errorSummary?: string | null;
};

function getRunWorkerMetadata(run: LoraTrainingRun) {
  if (run.kind === "generation") {
    return {
      workerType: "image_generation",
      targetType: "generationRun",
    };
  }

  return {
    workerType: "training",
    targetType: "trainingRun",
  };
}

function getManagedWorkerTaskId(runId: string) {
  return `${MANAGED_WORKER_TASK_ID_PREFIX}${runId}`;
}

function getManagedRunIdFromTaskId(taskId: string) {
  return taskId.startsWith(MANAGED_WORKER_TASK_ID_PREFIX)
    ? taskId.slice(MANAGED_WORKER_TASK_ID_PREFIX.length)
    : null;
}

function serializeManagedWorkerTask(run: LoraTrainingRun, input: ManagedWorkerTaskInput = {}) {
  const metadata = getRunWorkerMetadata(run);
  const now = new Date().toISOString();

  return {
    id: getManagedWorkerTaskId(run.id),
    jobId: run.projectId,
    workerType: metadata.workerType,
    targetType: metadata.targetType,
    targetId: run.id,
    status: input.status ?? "running",
    payload: {
      taskType: metadata.workerType,
      projectId: run.projectId,
      projectTitle: run.projectTitle,
      runKind: run.kind,
    },
    leaseOwner: input.leaseOwner ?? null,
    leaseExpiresAt: null,
    attemptCount: 1,
    progressJson: input.progressJson ?? null,
    startedAt: null,
    heartbeatAt: input.progressJson ? now : null,
    finishedAt: input.status === "succeeded" || input.status === "failed" ? now : null,
    errorSummary: input.errorSummary ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

async function findManagedRunForWorkerTask(
  taskId: string,
  expectedStatus: LoraTrainingRun["status"] | null = "running",
) {
  const runId = getManagedRunIdFromTaskId(taskId);
  if (!runId) return null;

  const runs = await listManagedTrainingRuns();
  const run = runs.find((candidate) => candidate.id === runId);
  if (!run) return null;
  if (expectedStatus && run.status !== expectedStatus) return null;

  return run;
}

async function leaseNextManagedTrainingWorkerTask(input: unknown) {
  const parsed = trainingWorkerTaskLeaseRequestSchema.safeParse(input);
  if (!parsed.success) return null;

  const runs = await listManagedTrainingRuns();
  const run = runs.find((candidate) => {
    if (candidate.status !== "running") return false;

    const metadata = getRunWorkerMetadata(candidate);
    if (metadata.workerType !== parsed.data.workerType) return false;
    if (parsed.data.targetType && metadata.targetType !== parsed.data.targetType) return false;
    if (parsed.data.targetId && candidate.id !== parsed.data.targetId) return false;

    return true;
  });

  if (!run) return null;

  return serializeManagedWorkerTask(run, {
    leaseOwner: parsed.data.leaseOwner ?? null,
  });
}

async function heartbeatManagedTrainingWorkerTask(taskId: string, input: unknown) {
  const parsed = trainingWorkerTaskHeartbeatRequestSchema.safeParse(input);
  if (!parsed.success) return null;

  const run = await findManagedRunForWorkerTask(taskId);
  if (!run) return null;

  return serializeManagedWorkerTask(run, {
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.progressJson ?? null,
  });
}

async function completeManagedTrainingWorkerTask(taskId: string, input: unknown) {
  const parsed = trainingWorkerTaskCompleteRequestSchema.safeParse(input);
  if (!parsed.success) return null;

  const run = await findManagedRunForWorkerTask(taskId, null);
  if (!run) return null;

  return serializeManagedWorkerTask(run, {
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.output ?? null,
    status: "succeeded",
  });
}

async function failManagedTrainingWorkerTask(taskId: string, input: unknown) {
  const parsed = trainingWorkerTaskFailRequestSchema.safeParse(input);
  if (!parsed.success) return null;

  const run = await findManagedRunForWorkerTask(taskId, null);
  if (!run) return null;

  return serializeManagedWorkerTask(run, {
    errorSummary: parsed.data.errorSummary,
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.providerError ?? null,
    status: "failed",
  });
}

export async function getTrainingWorkerQueueStatus() {
  return getLegacyTrainingWorkerQueueStatus();
}

export async function leaseNextTrainingWorkerTask(input: unknown) {
  const managedTask = await leaseNextManagedTrainingWorkerTask(input);
  if (managedTask) return managedTask;

  return leaseNextLegacyTrainingWorkerTask(input);
}

export async function heartbeatTrainingWorkerTask(taskId: string, input: unknown = {}) {
  const managedTask = await heartbeatManagedTrainingWorkerTask(taskId, input);
  if (managedTask) return managedTask;

  return heartbeatLegacyTrainingWorkerTask(taskId, input);
}

export async function completeTrainingWorkerTask(taskId: string, input: unknown) {
  const managedTask = await completeManagedTrainingWorkerTask(taskId, input);
  if (managedTask) return managedTask;

  return completeLegacyTrainingWorkerTask(taskId, input);
}

export async function failTrainingWorkerTask(taskId: string, input: unknown) {
  const managedTask = await failManagedTrainingWorkerTask(taskId, input);
  if (managedTask) return managedTask;

  return failLegacyTrainingWorkerTask(taskId, input);
}

export const mapTrainingWorkerTaskError = mapLegacyTrainingGenerationError;
