import { prisma } from "@/lib/prisma";
import { trainingWorkerTaskFailRequestSchema } from "@/lib/training/schemas";
import { TrainingWorkerTaskError } from "@/server/worker/training/task-errors";
import {
  getGenerationWorkerTaskId,
  getTrainingRunWorkerTaskId,
} from "@/server/worker/training/task-id";
import { serializeWorkerTask } from "@/server/worker/training/task-serialization";
import { findWorkerTargetByTaskId } from "@/server/worker/training/target-discovery";

export async function failTrainingRunWorkerTarget(trainingRunId: string, input: unknown = {}) {
  const payload = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return failTrainingWorkerTask(getTrainingRunWorkerTaskId(trainingRunId), {
    errorSummary: typeof payload.errorSummary === "string" && payload.errorSummary.trim()
      ? payload.errorSummary.trim()
      : "训练任务失败",
  });
}

export async function failGenerationTaskWorkerTarget(taskId: string, input: unknown = {}) {
  const payload = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return failTrainingWorkerTask(getGenerationWorkerTaskId(taskId), {
    errorSummary: typeof payload.errorSummary === "string" && payload.errorSummary.trim()
      ? payload.errorSummary.trim()
      : "生成任务失败",
  });
}

export async function failTrainingWorkerTask(taskId: string, input: unknown) {
  const parsed = trainingWorkerTaskFailRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingWorkerTaskError("Invalid training worker fail request", 400, {
      issues: parsed.error.issues,
    });
  }
  const target = await findWorkerTargetByTaskId(taskId);
  if (!target) return null;
  const now = new Date();

  if (target.workerType === "image_generation") {
    await prisma.trainingGenerationTask.update({
      where: { id: target.id },
      data: {
        errorMessage: parsed.data.errorSummary,
        finishedAt: now,
        status: "failed",
        sectionRuns: {
          updateMany: {
            where: {},
            data: {
              errorMessage: parsed.data.errorSummary,
              finishedAt: now,
              status: "failed",
            },
          },
        },
      },
    });
  } else if (target.workerType === "dataset_freeze") {
    await prisma.trainingDatasetRevision.update({
      where: { id: target.id },
      data: {
        status: "failed",
      },
    });
  } else {
    await prisma.trainingRun.update({
      where: { id: target.id },
      data: {
        errorMessage: parsed.data.errorSummary,
        finishedAt: now,
        status: "failed",
      },
    });
  }

  return serializeWorkerTask(target, {
    errorSummary: parsed.data.errorSummary,
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.providerError ?? null,
    status: "failed",
  });
}
