import {
  completeLegacyTrainingWorkerTask,
  failLegacyTrainingWorkerTask,
  getLegacyTrainingWorkerQueueStatus,
  heartbeatLegacyTrainingWorkerTask,
  leaseNextLegacyTrainingWorkerTask,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";
import {
  TRAINING_WORKER_TYPES,
  trainingWorkerTaskCompleteRequestSchema,
  trainingWorkerTaskFailRequestSchema,
  trainingWorkerTaskHeartbeatRequestSchema,
  trainingWorkerTaskLeaseRequestSchema,
  type TrainingWorkerType,
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

function createEmptyManagedWorkerTypeStatus() {
  return {
    image_generation: {
      queued: 0,
      running: 0,
      totalActive: 0,
      targetType: "generationRun",
    },
    dataset_freeze: {
      queued: 0,
      running: 0,
      totalActive: 0,
      targetType: "datasetRevision",
    },
    training: {
      queued: 0,
      running: 0,
      totalActive: 0,
      targetType: "trainingRun",
    },
  } satisfies Record<TrainingWorkerType, {
    queued: number;
    running: number;
    targetType: string;
    totalActive: number;
  }>;
}

async function getManagedTrainingWorkerQueueStatus() {
  const byWorkerType = createEmptyManagedWorkerTypeStatus();
  const runs = await listManagedTrainingRuns();

  for (const run of runs) {
    if (run.status !== "queued" && run.status !== "running") continue;

    const workerType = getRunWorkerMetadata(run).workerType;
    const status = byWorkerType[workerType];
    if (run.status === "queued") status.queued += 1;
    if (run.status === "running") status.running += 1;
    status.totalActive += 1;
  }

  return {
    summary: {
      totalActive: TRAINING_WORKER_TYPES.reduce((total, workerType) => total + byWorkerType[workerType].totalActive, 0),
      totalQueued: TRAINING_WORKER_TYPES.reduce((total, workerType) => total + byWorkerType[workerType].queued, 0),
      totalRunning: TRAINING_WORKER_TYPES.reduce((total, workerType) => total + byWorkerType[workerType].running, 0),
    },
    byWorkerType,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const managedQueueStatus = await getManagedTrainingWorkerQueueStatus();

  try {
    const legacyQueueStatus = await getLegacyTrainingWorkerQueueStatus();
    return {
      ...(isRecord(legacyQueueStatus) ? legacyQueueStatus : {}),
      legacyQueueStatus,
      managedQueueStatus,
    };
  } catch (error) {
    const mapped = mapLegacyTrainingGenerationError(error);
    return {
      legacyQueueStatus: {
        details: mapped.details,
        error: mapped.message,
        status: mapped.status,
        unavailable: true,
      },
      managedQueueStatus,
    };
  }
}

export async function leaseNextTrainingWorkerTask(input: unknown) {
  const managedTask = await leaseNextManagedTrainingWorkerTask(input);
  if (managedTask) return managedTask;

  const parsed = trainingWorkerTaskLeaseRequestSchema.safeParse(input);
  if (
    parsed.success
    && parsed.data.targetId?.startsWith("managed-")
    && (parsed.data.targetType === "generationRun" || parsed.data.targetType === "trainingRun")
  ) {
    return null;
  }

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
