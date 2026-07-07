import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  TRAINING_WORKER_TYPES,
  trainingWorkerTaskCompleteRequestSchema,
  trainingWorkerTaskFailRequestSchema,
} from "@/lib/training/schemas";
import { leaseNextTrainingWorkerTask } from "@/server/worker/training/leasing";
import { TrainingWorkerTaskError } from "@/server/worker/training/task-errors";
import { normalizeWorkerTaskJson } from "@/server/worker/training/task-json";
import {
  getGenerationWorkerTaskId,
  getTrainingRunWorkerTaskId,
  workerTypeForTargetType,
  type TrainingWorkerType,
} from "@/server/worker/training/task-id";
import { serializeWorkerTask } from "@/server/worker/training/task-serialization";
import {
  countWorkerTargets,
  findWorkerTargetByTaskId,
  mapTrainingRunToTarget,
  type WorkerTarget,
} from "@/server/worker/training/target-discovery";

export { heartbeatTrainingWorkerTask } from "@/server/worker/training/heartbeat";
export { leaseNextTrainingWorkerTask } from "@/server/worker/training/leasing";
export { TrainingWorkerTaskError, mapTrainingWorkerTaskError } from "@/server/worker/training/task-errors";

async function writeArtifact(input: {
  metadata?: unknown;
  mimeType?: string | null;
  projectId: string;
  relativePath: string;
  role: string;
  sha256?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  return prisma.trainingArtifact.upsert({
    where: {
      trainingProjectId_storageKey: {
        trainingProjectId: input.projectId,
        storageKey: input.relativePath,
      },
    },
    update: {
      filePath: input.relativePath,
      lifecycleStatus: "active",
      metadata: input.metadata === undefined ? undefined : normalizeWorkerTaskJson(input.metadata),
      mimeType: input.mimeType ?? undefined,
      sha256: input.sha256 ?? undefined,
      storageRole: input.role,
      width: input.width ?? undefined,
      height: input.height ?? undefined,
    },
    create: {
      trainingProjectId: input.projectId,
      storageKey: input.relativePath,
      filePath: input.relativePath,
      lifecycleStatus: "active",
      metadata: input.metadata === undefined ? Prisma.JsonNull : normalizeWorkerTaskJson(input.metadata),
      mimeType: input.mimeType ?? null,
      sha256: input.sha256 ?? null,
      storageRole: input.role,
      width: input.width ?? null,
      height: input.height ?? null,
    },
  });
}

async function completeGenerationTarget(target: WorkerTarget, output: unknown) {
  const task = await prisma.trainingGenerationTask.findUnique({
    where: { id: target.id },
    include: {
      sectionRuns: true,
    },
  });
  if (!task) return;

  const now = new Date();
  if (output && typeof output === "object" && !Array.isArray(output) && Array.isArray((output as { images?: unknown }).images)) {
    const images = (output as { images: Array<Record<string, unknown>> }).images;
    const sectionRun = task.sectionRuns[0] ?? null;
    await prisma.$transaction(async (tx) => {
      for (const [index, image] of images.entries()) {
        const relativePath = typeof image.relativePath === "string" ? image.relativePath : "";
        if (!relativePath) continue;
        const sha256 = typeof image.sha256 === "string" ? image.sha256 : createHash("sha256").update(relativePath).digest("hex");
        const artifact = await tx.trainingArtifact.upsert({
          where: {
            trainingProjectId_storageKey: {
              trainingProjectId: task.trainingProjectId,
              storageKey: relativePath,
            },
          },
          update: {
            filePath: relativePath,
            lifecycleStatus: "active",
            metadata: normalizeWorkerTaskJson({ index, purpose: "generation_output" }),
            sha256,
            storageRole: "generation_output",
            width: typeof image.width === "number" ? image.width : undefined,
            height: typeof image.height === "number" ? image.height : undefined,
          },
          create: {
            trainingProjectId: task.trainingProjectId,
            storageKey: relativePath,
            filePath: relativePath,
            lifecycleStatus: "active",
            metadata: normalizeWorkerTaskJson({ index, purpose: "generation_output" }),
            sha256,
            storageRole: "generation_output",
            width: typeof image.width === "number" ? image.width : null,
            height: typeof image.height === "number" ? image.height : null,
          },
        });
        const generationOutput = await tx.trainingGenerationTaskOutput.create({
          data: {
            trainingGenerationTaskId: task.id,
            outputKind: "image",
            artifactId: artifact.id,
            filePath: relativePath,
            targetEntityType: "training_image_result",
          },
        });
        await tx.trainingImageResult.create({
          data: {
            trainingProjectId: task.trainingProjectId,
            trainingCharacterProfileId: sectionRun?.trainingCharacterProfileId ?? null,
            artifactId: artifact.id,
            sourceType: "generation_task",
            trainingSectionRunId: sectionRun?.id ?? null,
            generationTaskOutputId: generationOutput.id,
            reviewStatus: "pending",
            trainingCaption: null,
            filePathSnapshot: relativePath,
            width: typeof image.width === "number" ? image.width : null,
            height: typeof image.height === "number" ? image.height : null,
            sha256,
          },
        });
      }
    });
  }

  await prisma.trainingGenerationTask.update({
    where: { id: task.id },
    data: {
      finishedAt: now,
      status: "done",
      sectionRuns: {
        updateMany: {
          where: {},
          data: {
            finishedAt: now,
            status: "done",
          },
        },
      },
    },
  });
}

async function completeTrainingTarget(target: WorkerTarget, output: unknown) {
  const run = await prisma.trainingRun.findUnique({
    where: { id: target.id },
  });
  if (!run) return;

  const data = output && typeof output === "object" && !Array.isArray(output) ? output as Record<string, unknown> : {};
  const finalArtifactInput = data.finalSafetensorsArtifact && typeof data.finalSafetensorsArtifact === "object" && !Array.isArray(data.finalSafetensorsArtifact)
    ? data.finalSafetensorsArtifact as Record<string, unknown>
    : null;
  const logArtifactInput = data.trainingLogArtifact && typeof data.trainingLogArtifact === "object" && !Array.isArray(data.trainingLogArtifact)
    ? data.trainingLogArtifact as Record<string, unknown>
    : null;
  const finalRelativePath = typeof finalArtifactInput?.relativePath === "string" ? finalArtifactInput.relativePath : null;
  const logRelativePath = typeof logArtifactInput?.relativePath === "string" ? logArtifactInput.relativePath : null;
  const finalArtifact = finalRelativePath
    ? await writeArtifact({
      metadata: { purpose: "training_final_lora" },
      projectId: run.trainingProjectId,
      relativePath: finalRelativePath,
      role: "final_lora",
      sha256: typeof finalArtifactInput?.sha256 === "string" ? finalArtifactInput.sha256 : null,
    })
    : null;
  const logArtifact = logRelativePath
    ? await writeArtifact({
      metadata: { purpose: "training_log" },
      mimeType: "text/plain",
      projectId: run.trainingProjectId,
      relativePath: logRelativePath,
      role: "training_log",
      sha256: null,
    })
    : null;
  await prisma.trainingRun.update({
    where: { id: run.id },
    data: {
      finalLoraArtifactId: finalArtifact?.id ?? run.finalLoraArtifactId,
      finishedAt: new Date(),
      progressJson: normalizeWorkerTaskJson(data.metadataSummary ?? data),
      status: "done",
      trainingLogArtifactId: logArtifact?.id ?? run.trainingLogArtifactId,
    },
  });
}

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

export async function completeTrainingRunWorkerTarget(trainingRunId: string, input: unknown = {}) {
  const run = await prisma.trainingRun.findUnique({
    where: { id: trainingRunId },
  });
  if (!run) return null;

  const payload = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const finalArtifactInput = payload.finalSafetensorsArtifact && typeof payload.finalSafetensorsArtifact === "object" && !Array.isArray(payload.finalSafetensorsArtifact)
    ? payload.finalSafetensorsArtifact as Record<string, unknown>
    : null;
  const artifactName = typeof payload.artifactName === "string" && payload.artifactName.trim()
    ? payload.artifactName.trim()
    : `${trainingRunId}.safetensors`;
  const relativePath = typeof finalArtifactInput?.relativePath === "string" && finalArtifactInput.relativePath.trim()
    ? finalArtifactInput.relativePath.trim()
    : typeof payload.artifactRelativePath === "string" && payload.artifactRelativePath.trim()
      ? payload.artifactRelativePath.trim()
      : `data/training/${run.trainingProjectId}/artifacts/${artifactName}`;

  await completeTrainingTarget(mapTrainingRunToTarget(run), {
    elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : undefined,
    finalSafetensorsArtifact: {
      relativePath,
      sha256: typeof finalArtifactInput?.sha256 === "string" ? finalArtifactInput.sha256 : undefined,
    },
    metadataSummary: {
      keyCount: 0,
      summary: {
        artifactName,
      },
    },
  });

  const updated = await prisma.trainingRun.findUnique({
    where: { id: trainingRunId },
  });
  return updated ? serializeWorkerTask(mapTrainingRunToTarget(updated), { status: "succeeded" }) : null;
}

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

export async function completeGenerationTaskWorkerTarget(taskId: string, input: unknown = {}) {
  const payload = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const output = Array.isArray(payload.images)
    ? {
      elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : 0,
      images: payload.images,
      requestRedactedPath: typeof payload.requestRedactedPath === "string" ? payload.requestRedactedPath : `data/training/${taskId}/request.json`,
      responseSummaryPath: typeof payload.responseSummaryPath === "string" ? payload.responseSummaryPath : `data/training/${taskId}/response.json`,
    }
    : undefined;
  return completeTrainingWorkerTask(getGenerationWorkerTaskId(taskId), { output });
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

export async function completeTrainingWorkerTask(taskId: string, input: unknown) {
  const parsed = trainingWorkerTaskCompleteRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingWorkerTaskError("Invalid training worker complete request", 400, {
      issues: parsed.error.issues,
    });
  }
  const target = await findWorkerTargetByTaskId(taskId);
  if (!target) return null;

  if (target.workerType === "image_generation") {
    await completeGenerationTarget(target, parsed.data.output);
  } else if (target.workerType === "training") {
    await completeTrainingTarget(target, parsed.data.output);
  } else if (target.workerType === "dataset_freeze") {
    await prisma.trainingDatasetRevision.update({
      where: { id: target.id },
      data: {
        frozenAt: new Date(),
        status: "ready",
      },
    });
  }

  return serializeWorkerTask(target, {
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.output ?? null,
    status: "succeeded",
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
