import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  TRAINING_WORKER_TYPES,
  trainingWorkerTaskCompleteRequestSchema,
  trainingWorkerTaskFailRequestSchema,
  trainingWorkerTaskHeartbeatRequestSchema,
  trainingWorkerTaskLeaseRequestSchema,
} from "@/lib/training/schemas";

const GENERATION_WORKER_TASK_PREFIX = "training-generation-worker-task-";
const DATASET_WORKER_TASK_PREFIX = "training-dataset-worker-task-";
const TRAINING_WORKER_TASK_PREFIX = "training-run-worker-task-";

type TrainingWorkerType = (typeof TRAINING_WORKER_TYPES)[number];
type WorkerTargetType = "generationRun" | "datasetRevision" | "trainingRun";

type WorkerTarget = {
  id: string;
  projectId: string;
  status: string;
  targetType: WorkerTargetType;
  workerType: TrainingWorkerType;
};

type SerializedWorkerTaskInput = {
  errorSummary?: string | null;
  leaseOwner?: string | null;
  progressJson?: unknown;
  status?: "running" | "succeeded" | "failed";
};

export class TrainingWorkerTaskError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingWorkerTaskError";
    this.status = status;
    this.details = details;
  }
}

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || typeof value === "undefined") return {};
  if (typeof value === "object") return value as Prisma.InputJsonValue;
  return { value } as Prisma.InputJsonValue;
}

function getWorkerTaskPrefix(workerType: TrainingWorkerType) {
  if (workerType === "training") return TRAINING_WORKER_TASK_PREFIX;
  if (workerType === "dataset_freeze") return DATASET_WORKER_TASK_PREFIX;
  return GENERATION_WORKER_TASK_PREFIX;
}

function getWorkerTaskId(target: WorkerTarget) {
  return `${getWorkerTaskPrefix(target.workerType)}${target.id}`;
}

function parseWorkerTaskId(taskId: string): { targetId: string; targetType: WorkerTargetType; workerType: TrainingWorkerType } | null {
  if (taskId.startsWith(GENERATION_WORKER_TASK_PREFIX)) {
    return {
      targetId: taskId.slice(GENERATION_WORKER_TASK_PREFIX.length),
      targetType: "generationRun",
      workerType: "image_generation",
    };
  }
  if (taskId.startsWith(DATASET_WORKER_TASK_PREFIX)) {
    return {
      targetId: taskId.slice(DATASET_WORKER_TASK_PREFIX.length),
      targetType: "datasetRevision",
      workerType: "dataset_freeze",
    };
  }
  if (taskId.startsWith(TRAINING_WORKER_TASK_PREFIX)) {
    return {
      targetId: taskId.slice(TRAINING_WORKER_TASK_PREFIX.length),
      targetType: "trainingRun",
      workerType: "training",
    };
  }
  return null;
}

function getGenerationWorkerTaskId(taskId: string) {
  return `${GENERATION_WORKER_TASK_PREFIX}${taskId}`;
}

function getTrainingRunWorkerTaskId(trainingRunId: string) {
  return `${TRAINING_WORKER_TASK_PREFIX}${trainingRunId}`;
}

function workerTypeForTargetType(targetType: string): TrainingWorkerType | null {
  if (targetType === "generationRun") return "image_generation";
  if (targetType === "datasetRevision") return "dataset_freeze";
  if (targetType === "trainingRun") return "training";
  return null;
}

function serializeWorkerTask(target: WorkerTarget, input: SerializedWorkerTaskInput = {}) {
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

function mapGenerationTaskToTarget(row: {
  id: string;
  status: string;
  trainingProjectId: string;
}): WorkerTarget {
  return {
    id: row.id,
    projectId: row.trainingProjectId,
    status: row.status,
    targetType: "generationRun",
    workerType: "image_generation",
  };
}

function mapDatasetRevisionToTarget(row: {
  id: string;
  status: string;
  trainingProjectId: string;
}): WorkerTarget {
  return {
    id: row.id,
    projectId: row.trainingProjectId,
    status: row.status,
    targetType: "datasetRevision",
    workerType: "dataset_freeze",
  };
}

function mapTrainingRunToTarget(row: {
  id: string;
  status: string;
  trainingProjectId: string;
}): WorkerTarget {
  return {
    id: row.id,
    projectId: row.trainingProjectId,
    status: row.status,
    targetType: "trainingRun",
    workerType: "training",
  };
}

async function countWorkerTargets(workerType: TrainingWorkerType, status: "queued" | "running") {
  if (workerType === "image_generation") {
    return prisma.trainingGenerationTask.count({
      where: {
        generationKind: "image_generation",
        status,
      },
    });
  }
  if (workerType === "dataset_freeze") {
    return prisma.trainingDatasetRevision.count({
      where: {
        status: status === "queued" ? "draft" : "freezing",
      },
    });
  }
  return prisma.trainingRun.count({
    where: {
      status,
    },
  });
}

async function findRunningWorkerTarget(workerType: TrainingWorkerType, targetId?: string, targetType?: string) {
  if (workerType === "image_generation") {
    if (targetType && targetType !== "generationRun") return null;
    const row = await prisma.trainingGenerationTask.findFirst({
      where: {
        generationKind: "image_generation",
        id: targetId,
        status: "running",
      },
      orderBy: {
        updatedAt: "asc",
      },
    });
    return row ? mapGenerationTaskToTarget(row) : null;
  }
  if (workerType === "dataset_freeze") {
    if (targetType && targetType !== "datasetRevision") return null;
    const row = await prisma.trainingDatasetRevision.findFirst({
      where: {
        id: targetId,
        status: "freezing",
      },
      orderBy: {
        updatedAt: "asc",
      },
    });
    return row ? mapDatasetRevisionToTarget(row) : null;
  }
  if (targetType && targetType !== "trainingRun") return null;
  const row = await prisma.trainingRun.findFirst({
    where: {
      id: targetId,
      status: "running",
    },
    orderBy: {
      updatedAt: "asc",
    },
  });
  return row ? mapTrainingRunToTarget(row) : null;
}

async function findQueuedWorkerTarget(workerType: TrainingWorkerType, targetId?: string, targetType?: string) {
  if (workerType === "image_generation") {
    if (targetType && targetType !== "generationRun") return null;
    const row = await prisma.trainingGenerationTask.findFirst({
      where: {
        generationKind: "image_generation",
        id: targetId,
        status: "queued",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return row ? mapGenerationTaskToTarget(row) : null;
  }
  if (workerType === "dataset_freeze") {
    if (targetType && targetType !== "datasetRevision") return null;
    const row = await prisma.trainingDatasetRevision.findFirst({
      where: {
        id: targetId,
        status: "draft",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return row ? mapDatasetRevisionToTarget(row) : null;
  }
  if (targetType && targetType !== "trainingRun") return null;
  const row = await prisma.trainingRun.findFirst({
    where: {
      id: targetId,
      status: "queued",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return row ? mapTrainingRunToTarget(row) : null;
}

async function markWorkerTargetRunning(target: WorkerTarget, leaseOwner?: string | null) {
  const now = new Date();
  if (target.workerType === "image_generation") {
    const updated = await prisma.trainingGenerationTask.update({
      where: { id: target.id },
      data: {
        paramsJson: {
          ...(leaseOwner ? { leaseOwner } : {}),
        },
        startedAt: now,
        status: "running",
        sectionRuns: {
          updateMany: {
            where: {},
            data: {
              startedAt: now,
              status: "running",
            },
          },
        },
      },
    });
    return mapGenerationTaskToTarget(updated);
  }
  if (target.workerType === "dataset_freeze") {
    const updated = await prisma.trainingDatasetRevision.update({
      where: { id: target.id },
      data: {
        status: "freezing",
      },
    });
    return mapDatasetRevisionToTarget(updated);
  }
  const updated = await prisma.trainingRun.update({
    where: { id: target.id },
    data: {
      progressJson: {
        ...(leaseOwner ? { leaseOwner } : {}),
      },
      startedAt: now,
      status: "running",
    },
  });
  return mapTrainingRunToTarget(updated);
}

async function findWorkerTargetByTaskId(taskId: string) {
  const parsed = parseWorkerTaskId(taskId);
  if (!parsed) return null;
  if (parsed.workerType === "image_generation") {
    const row = await prisma.trainingGenerationTask.findUnique({
      where: { id: parsed.targetId },
    });
    return row ? mapGenerationTaskToTarget(row) : null;
  }
  if (parsed.workerType === "dataset_freeze") {
    const row = await prisma.trainingDatasetRevision.findUnique({
      where: { id: parsed.targetId },
    });
    return row ? mapDatasetRevisionToTarget(row) : null;
  }
  const row = await prisma.trainingRun.findUnique({
    where: { id: parsed.targetId },
  });
  return row ? mapTrainingRunToTarget(row) : null;
}

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
      metadata: input.metadata === undefined ? undefined : normalizeJson(input.metadata),
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
      metadata: input.metadata === undefined ? Prisma.JsonNull : normalizeJson(input.metadata),
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
            metadata: normalizeJson({ index, purpose: "generation_output" }),
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
            metadata: normalizeJson({ index, purpose: "generation_output" }),
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
      progressJson: normalizeJson(data.metadataSummary ?? data),
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

export async function leaseNextTrainingWorkerTask(input: unknown) {
  const parsed = trainingWorkerTaskLeaseRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingWorkerTaskError("Invalid training worker lease request", 400, {
      issues: parsed.error.issues,
    });
  }

  const running = await findRunningWorkerTarget(
    parsed.data.workerType,
    parsed.data.targetId,
    parsed.data.targetType,
  );
  if (running) {
    return serializeWorkerTask(running, {
      leaseOwner: parsed.data.leaseOwner ?? null,
    });
  }

  if (await countWorkerTargets(parsed.data.workerType, "running") > 0) {
    return null;
  }

  const queued = await findQueuedWorkerTarget(
    parsed.data.workerType,
    parsed.data.targetId,
    parsed.data.targetType,
  );
  if (!queued) return null;

  const target = await markWorkerTargetRunning(queued, parsed.data.leaseOwner ?? null);
  return serializeWorkerTask(target, {
    leaseOwner: parsed.data.leaseOwner ?? null,
  });
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
        progressJson: normalizeJson(progressJson),
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

export async function heartbeatTrainingWorkerTask(taskId: string, input: unknown = {}) {
  const parsed = trainingWorkerTaskHeartbeatRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingWorkerTaskError("Invalid training worker heartbeat request", 400, {
      issues: parsed.error.issues,
    });
  }
  const target = await findWorkerTargetByTaskId(taskId);
  if (!target) return null;

  if (target.workerType === "image_generation") {
    await prisma.trainingGenerationTask.update({
      where: { id: target.id },
      data: {
        paramsJson: normalizeJson({
          heartbeatAt: new Date().toISOString(),
          leaseOwner: parsed.data.leaseOwner ?? null,
          progressJson: parsed.data.progressJson ?? null,
        }),
      },
    });
  } else if (target.workerType === "training") {
    await prisma.trainingRun.update({
      where: { id: target.id },
      data: {
        currentStep: typeof parsed.data.progressJson?.currentStep === "number" ? parsed.data.progressJson.currentStep : undefined,
        progressJson: normalizeJson(parsed.data.progressJson ?? {}),
        schedulerMessage: typeof parsed.data.progressJson?.phase === "string" ? parsed.data.progressJson.phase : undefined,
        totalSteps: typeof parsed.data.progressJson?.targetSteps === "number" ? parsed.data.progressJson.targetSteps : undefined,
      },
    });
  }

  return serializeWorkerTask(target, {
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.progressJson ?? null,
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

export function mapTrainingWorkerTaskError(error: unknown) {
  if (error instanceof TrainingWorkerTaskError) {
    return {
      details: error.details,
      message: error.message,
      status: error.status,
    };
  }
  return {
    details: error instanceof Error ? error.message : String(error),
    message: "Unexpected training worker task error",
    status: 500,
  };
}
