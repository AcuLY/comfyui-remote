import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TRAINING_WORKER_TYPES } from "@/lib/training/schemas";
import { leaseNextTrainingWorkerTask } from "@/server/worker/training/leasing";
import { TrainingWorkerTaskError } from "@/server/worker/training/task-errors";
import { normalizeWorkerTaskJson } from "@/server/worker/training/task-json";
import {
  workerTypeForTargetType,
  type TrainingWorkerType,
} from "@/server/worker/training/task-id";
import { serializeWorkerTask } from "@/server/worker/training/task-serialization";
import {
  countWorkerTargets,
  mapTrainingRunToTarget,
} from "@/server/worker/training/target-discovery";

export async function getTrainingWorkerQueueStatus() {
  const byWorkerType = {
    image_generation: {
      queued: await countWorkerTargets("image_generation", "queued"),
      running: await countWorkerTargets("image_generation", "running"),
      targetType: "generationRun",
      totalActive: 0,
    },
    dataset_freeze: {
      queued: await countWorkerTargets("dataset_freeze", "queued"),
      running: await countWorkerTargets("dataset_freeze", "running"),
      targetType: "datasetRevision",
      totalActive: 0,
    },
    training: {
      queued: await countWorkerTargets("training", "queued"),
      running: await countWorkerTargets("training", "running"),
      targetType: "trainingRun",
      totalActive: 0,
    },
  } satisfies Record<TrainingWorkerType, {
    queued: number;
    running: number;
    targetType: string;
    totalActive: number;
  }>;

  for (const workerType of TRAINING_WORKER_TYPES) {
    byWorkerType[workerType].totalActive = byWorkerType[workerType].queued + byWorkerType[workerType].running;
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

export async function tickTrainingWorkerScheduler(input: unknown = {}) {
  const target = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const targetId = typeof target.targetId === "string" && target.targetId.trim() ? target.targetId.trim() : undefined;
  const targetType = typeof target.targetType === "string" && target.targetType.trim() ? target.targetType.trim() : undefined;

  if (targetId || targetType) {
    if (!targetId || !targetType) {
      throw new TrainingWorkerTaskError("targetType and targetId must be provided together", 400);
    }
    const workerType = workerTypeForTargetType(targetType);
    if (!workerType) {
      throw new TrainingWorkerTaskError("Unsupported training scheduler target type", 400, { targetType });
    }
    return leaseNextTrainingWorkerTask({
      leaseOwner: "training-scheduler",
      targetId,
      targetType,
      workerType,
    });
  }

  for (const workerType of TRAINING_WORKER_TYPES) {
    const task = await leaseNextTrainingWorkerTask({
      leaseOwner: "training-scheduler",
      workerType,
    });
    if (task) return task;
  }
  return null;
}

export async function progressTrainingRunWorkerTarget(trainingRunId: string, input: unknown = {}) {
  const payload = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const currentStep = typeof payload.currentStep === "number" ? payload.currentStep : undefined;
  const targetSteps = typeof payload.targetSteps === "number" ? payload.targetSteps : undefined;
  const schedulerMessage = typeof payload.schedulerMessage === "string" && payload.schedulerMessage.trim()
    ? payload.schedulerMessage.trim()
    : undefined;
  const progressJson = {
    ...(currentStep === undefined ? {} : { currentStep }),
    ...(targetSteps === undefined ? {} : { targetSteps }),
    ...(schedulerMessage === undefined ? {} : { phase: schedulerMessage }),
  };

  try {
    const updated = await prisma.trainingRun.update({
      where: { id: trainingRunId },
      data: {
        currentStep,
        progressJson: normalizeWorkerTaskJson(progressJson),
        schedulerMessage,
        startedAt: new Date(),
        status: "running",
        totalSteps: targetSteps,
      },
    });
    return {
      ...serializeWorkerTask(mapTrainingRunToTarget(updated), {
        progressJson,
        status: "running",
      }),
      currentStep: updated.currentStep,
      schedulerMessage: updated.schedulerMessage,
      targetSteps: updated.totalSteps,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
