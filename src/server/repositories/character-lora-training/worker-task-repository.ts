import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type {
  CharacterLoraDatasetFreezeTaskPayload,
  CharacterLoraImageGenerationOutput,
  CharacterLoraPromptCardDraftTaskPayload,
  CharacterLoraTrainingCompleteOutput,
} from "@/server/character-lora-training/contracts";

import { createFrozenCharacterLoraDatasetRevisionInTx } from "./dataset-repository";
import {
  asJsonRecord,
  buildDefaultCaption,
  countWorkerTasks,
  extractCompletionStep,
  extractTrainingProgressUpdate,
  hasCancelRequested,
  latestIsoDate,
  oldestIsoDate,
  refreshSectionCounts,
  toInputJsonValue,
} from "./helpers";
import {
  serializeDatasetRevision,
  serializeGenerationRun,
  serializeTrainingRun,
  serializeWorkerTask,
} from "./serializers";
import {
  GENERATION_RUN_SUMMARY_SELECT,
  TRAINING_RUN_SELECT,
  WORKER_TASK_SELECT,
  type CharacterLoraDatasetRevisionCreateInput,
} from "./types";

export async function createCharacterLoraDatasetFreezeWorkerTask(input: {
  jobId: string;
  revisionId: string;
  taskPayload: CharacterLoraDatasetFreezeTaskPayload;
}) {
  const task = await db.$transaction(async (tx) => {
    const created = await tx.characterLoraWorkerTask.create({
      data: {
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.dataset_freeze,
        targetType: "datasetRevision",
        targetId: input.revisionId,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
      },
      select: WORKER_TASK_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        phase: "dataset",
        failureSummary: null,
      },
      select: { id: true },
    });

    return created;
  });

  return serializeWorkerTask(task);
}

export async function createCharacterLoraPromptCardDraftWorkerTask(input: {
  taskId: string;
  jobId: string;
  taskPayload: CharacterLoraPromptCardDraftTaskPayload;
}) {
  const task = await db.$transaction(async (tx) => {
    const created = await tx.characterLoraWorkerTask.create({
      data: {
        id: input.taskId,
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.prompt_card_draft,
        targetType: "promptCardDraft",
        targetId: input.taskId,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
        progressJson: toInputJsonValue({
          status: "queued",
          provider: input.taskPayload.request.provider,
          sourceImageIds: input.taskPayload.request.sourceImageIds,
          canonicalVersionIds: input.taskPayload.request.canonicalVersionIds,
        }),
      },
      select: WORKER_TASK_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        phase: "prompt_card",
        failureSummary: null,
      },
      select: { id: true },
    });

    return created;
  });

  return serializeWorkerTask(task);
}

export async function leaseNextCharacterLoraWorkerTask(input: {
  workerType: CharacterLoraWorkerType;
  leaseOwner: string;
  leaseExpiresAt: Date;
  targetType?: string;
  targetId?: string;
}) {
  const task = await db.$transaction(async (tx) => {
    const now = new Date();
    const queued = await tx.characterLoraWorkerTask.findFirst({
      where: {
        workerType: input.workerType,
        targetType: input.targetType,
        targetId: input.targetId,
        OR: [
          { status: CharacterLoraRunStatus.queued },
          {
            status: CharacterLoraRunStatus.running,
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: { id: true, targetType: true, targetId: true, status: true },
    });

    if (!queued) {
      return null;
    }

    const claimed = await tx.characterLoraWorkerTask.updateMany({
      where: {
        id: queued.id,
        OR: [
          { status: CharacterLoraRunStatus.queued },
          {
            status: CharacterLoraRunStatus.running,
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      data: {
        status: CharacterLoraRunStatus.running,
        leaseOwner: input.leaseOwner,
        leaseExpiresAt: input.leaseExpiresAt,
        attemptCount: { increment: 1 },
        startedAt: now,
        heartbeatAt: now,
        errorSummary: null,
      },
    });

    if (claimed.count !== 1) {
      return null;
    }

    if (queued.targetType === "generationRun") {
      await tx.characterLoraGenerationRun.updateMany({
        where: {
          id: queued.targetId,
          status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
        },
        data: {
          status: CharacterLoraRunStatus.running,
          startedAt: queued.status === CharacterLoraRunStatus.queued ? now : undefined,
          errorSummary: null,
        },
      });
    }

    if (queued.targetType === "trainingRun") {
      const run = await tx.characterLoraTrainingRun.update({
        where: { id: queued.targetId },
        data: {
          status: CharacterLoraRunStatus.running,
          startedAt: queued.status === CharacterLoraRunStatus.queued ? now : undefined,
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.training_running,
          phase: "training",
          failureSummary: null,
        },
        select: { id: true },
      });
    }

    if (queued.targetType === "benchmarkRun") {
      const run = await tx.characterLoraBenchmarkRun.update({
        where: { id: queued.targetId },
        data: {
          status: CharacterLoraRunStatus.running,
          startedAt: queued.status === CharacterLoraRunStatus.queued ? now : undefined,
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.benchmarking,
          phase: "benchmark",
          failureSummary: null,
        },
        select: { id: true },
      });
    }

    return tx.characterLoraWorkerTask.findUnique({
      where: { id: queued.id },
      select: WORKER_TASK_SELECT,
    });
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function getCharacterLoraWorkerTask(taskId: string) {
  const task = await db.characterLoraWorkerTask.findUnique({
    where: { id: taskId },
    select: WORKER_TASK_SELECT,
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function getCharacterLoraWorkerTaskForTarget(input: {
  targetType: string;
  targetId: string;
}) {
  const task = await db.characterLoraWorkerTask.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: WORKER_TASK_SELECT,
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function getCharacterLoraWorkerQueueStatus() {
  const generatedAt = new Date();
  const tasks = await db.characterLoraWorkerTask.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: WORKER_TASK_SELECT,
  });
  const serializedTasks = tasks.map(serializeWorkerTask);
  const workerTypes = Object.values(CharacterLoraWorkerType);
  const totals = countWorkerTasks(serializedTasks);
  const activeTasks = serializedTasks.filter((task) => task.status === "queued" || task.status === "running");
  const failedTasks = serializedTasks.filter((task) => task.status === "failed");

  return {
    generatedAt: generatedAt.toISOString(),
    runbook: "docs/plans/2026-05-23-character-lora-worker-runbook.md",
    statusEndpoint: "/api/character-lora-training/worker/status",
    supervisorCommand: "cmd /c npm run character-lora:workers",
    mockSupervisorCommand: "cmd /c npm run character-lora:workers:mock",
    totals,
    hasActiveTasks: activeTasks.length > 0,
    hasRunningWorkers: activeTasks.some((task) => task.status === "running" && task.heartbeatAt),
    types: workerTypes.map((workerType) => {
      const typeTasks = serializedTasks.filter((task) => task.workerType === workerType);
      const queuedTasks = typeTasks.filter((task) => task.status === "queued");
      const runningTasks = typeTasks.filter((task) => task.status === "running");
      const expiredRunningTasks = runningTasks.filter((task) => {
        if (!task.leaseExpiresAt) {
          return false;
        }
        return Date.parse(task.leaseExpiresAt) <= generatedAt.getTime();
      });
      const latestHeartbeatAt = latestIsoDate(runningTasks.map((task) => task.heartbeatAt));
      const oldestQueuedAt = oldestIsoDate(queuedTasks.map((task) => task.createdAt));

      return {
        workerType,
        counts: countWorkerTasks(typeTasks),
        queuedCount: queuedTasks.length,
        runningCount: runningTasks.length,
        failedCount: typeTasks.filter((task) => task.status === "failed").length,
        cancelledCount: typeTasks.filter((task) => task.status === "cancelled").length,
        doneCount: typeTasks.filter((task) => task.status === "done").length,
        unleasedQueuedCount: queuedTasks.filter((task) => !task.leaseOwner).length,
        expiredRunningCount: expiredRunningTasks.length,
        activeLeaseOwners: Array.from(new Set(runningTasks.map((task) => task.leaseOwner).filter(Boolean))),
        latestHeartbeatAt,
        oldestQueuedAt,
        oldestQueuedAgeMs: oldestQueuedAt ? generatedAt.getTime() - Date.parse(oldestQueuedAt) : null,
        needsWorker: queuedTasks.length > 0 && runningTasks.length === 0,
        latestTask: typeTasks[0] ?? null,
      };
    }),
    activeTasks,
    failedTasks: failedTasks.slice(0, 25),
    recentTasks: serializedTasks.slice(0, 50),
  };
}

export async function heartbeatCharacterLoraWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  progressJson?: Prisma.InputJsonValue;
}) {
  const task = await db.$transaction(async (tx) => {
    const existing = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!existing || existing.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && existing.leaseOwner !== input.leaseOwner) {
      return null;
    }

    const updated = await tx.characterLoraWorkerTask.update({
      where: { id: input.taskId },
      data: {
        heartbeatAt: new Date(),
        ...(input.leaseExpiresAt ? { leaseExpiresAt: input.leaseExpiresAt } : {}),
        ...(input.progressJson ? { progressJson: input.progressJson } : {}),
      },
      select: WORKER_TASK_SELECT,
    });

    if (updated.targetType === "trainingRun") {
      const progress = extractTrainingProgressUpdate(input.progressJson);
      const run = await tx.characterLoraTrainingRun.update({
        where: { id: updated.targetId },
        data: {
          status: CharacterLoraRunStatus.running,
          currentStep: progress.currentStep,
          targetSteps: progress.targetSteps,
          lossSnapshot: progress.lossSnapshot,
          startedAt: updated.startedAt,
        },
        select: { jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: { status: CharacterLoraJobStatus.training_running, phase: "training" },
        select: { id: true },
      });
    }

    return updated;
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function completeImageGenerationWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  output: CharacterLoraImageGenerationOutput;
  responseSummary: Prisma.InputJsonValue;
  imageArtifacts: Array<{
    relativePath: string;
    absolutePath: string;
    sha256: string;
    width?: number | null;
    height?: number | null;
    byteSize?: bigint | number | null;
    metadata?: Prisma.InputJsonValue | null;
  }>;
  responseSummaryArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  };
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    const run = await tx.characterLoraGenerationRun.findUnique({
      where: { id: task.targetId },
      select: {
        ...GENERATION_RUN_SUMMARY_SELECT,
        job: { select: { triggerToken: true } },
        section: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (!run || task.targetType !== "generationRun") {
      return null;
    }

    const responseArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: run.jobId,
        kind: "provider_payload",
        relativePath: input.responseSummaryArtifact.relativePath,
        absolutePath: input.responseSummaryArtifact.absolutePath,
        sha256: input.responseSummaryArtifact.sha256,
        byteSize: input.responseSummaryArtifact.byteSize,
        mimeType: "application/json",
        redactionLevel: "payload_redacted",
        metadata: input.responseSummaryArtifact.metadata,
      },
      select: { id: true },
    });

    const artifacts = [];
    for (const artifactInput of input.imageArtifacts) {
      artifacts.push(
        await tx.characterLoraArtifact.create({
          data: {
            jobId: run.jobId,
            kind: run.kind === "canonical" ? "canonical_image" : "candidate_image",
            relativePath: artifactInput.relativePath,
            absolutePath: artifactInput.absolutePath,
            sha256: artifactInput.sha256,
            byteSize: artifactInput.byteSize ?? null,
            mimeType: "image/png",
            redactionLevel: "path_only",
            metadata: artifactInput.metadata ?? Prisma.DbNull,
          },
          select: { id: true, relativePath: true, sha256: true, byteSize: true },
        }),
      );
    }

    if (run.kind === "canonical") {
      const previous = await tx.characterLoraCanonicalVersion.findFirst({
        where: { jobId: run.jobId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      let nextVersion = (previous?.version ?? 0) + 1;

      for (const artifact of artifacts) {
        await tx.characterLoraCanonicalVersion.create({
          data: {
            jobId: run.jobId,
            version: nextVersion,
            status: "candidate",
            canonicalView: run.canonicalView,
            sourceRunId: run.id,
            imageArtifactId: artifact.id,
            notes: `worker generated canonical image ${artifact.relativePath}`,
          },
          select: { id: true },
        });
        nextVersion += 1;
      }
    } else {
      for (let index = 0; index < artifacts.length; index += 1) {
        const artifact = artifacts[index];
        const image = input.imageArtifacts[index];
        await tx.characterLoraCandidateImage.create({
          data: {
            jobId: run.jobId,
            sectionId: run.sectionId,
            generationRunId: run.id,
            artifactId: artifact.id,
            filePath: artifact.relativePath,
            sha256: artifact.sha256 ?? image.sha256,
            width: image.width ?? null,
            height: image.height ?? null,
            fileSize: artifact.byteSize,
            reviewStatus: CharacterLoraImageReviewStatus.pending,
            captionDraft: buildDefaultCaption(run.job.triggerToken, run.section?.name ?? null, run.visualPrompt),
          },
          select: { id: true },
        });
      }

      if (run.sectionId) {
        await refreshSectionCounts(tx, [run.sectionId]);
      }

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: { status: CharacterLoraJobStatus.reviewing, phase: "review" },
        select: { id: true },
      });
    }

    await tx.characterLoraGenerationRun.update({
      where: { id: run.id },
      data: {
        status: CharacterLoraRunStatus.done,
        responseSummary: toInputJsonValue({
          ...asJsonRecord(input.responseSummary),
          responseSummaryArtifactId: responseArtifact.id,
        }),
        errorSummary: null,
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    const completedTask = await tx.characterLoraWorkerTask.update({
      where: { id: task.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });

    const refreshedRun = await tx.characterLoraGenerationRun.findUnique({
      where: { id: run.id },
      select: GENERATION_RUN_SUMMARY_SELECT,
    });

    return { task: completedTask, generationRun: refreshedRun };
  });

  return result
    ? {
        task: serializeWorkerTask(result.task),
        generationRun: result.generationRun ? serializeGenerationRun(result.generationRun) : null,
      }
    : null;
}

export async function completeTrainingWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  output: CharacterLoraTrainingCompleteOutput;
  finalArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize?: bigint | number | null;
    metadata?: Prisma.InputJsonValue | null;
  };
  logArtifact?: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize?: bigint | number | null;
    metadata?: Prisma.InputJsonValue | null;
  } | null;
  checkpoints: Array<{
    step: number;
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize?: bigint | number | null;
    metrics?: Prisma.InputJsonValue | null;
  }>;
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    if (task.targetType !== "trainingRun") {
      return null;
    }

    const run = await tx.characterLoraTrainingRun.findUnique({
      where: { id: task.targetId },
      select: { id: true, jobId: true, targetSteps: true },
    });

    if (!run) {
      return null;
    }

    const finalArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: run.jobId,
        kind: "safetensors",
        relativePath: input.finalArtifact.relativePath,
        absolutePath: input.finalArtifact.absolutePath,
        sha256: input.finalArtifact.sha256,
        byteSize: input.finalArtifact.byteSize ?? null,
        mimeType: "application/octet-stream",
        redactionLevel: "path_only",
        metadata: input.finalArtifact.metadata ?? Prisma.DbNull,
      },
      select: { id: true },
    });

    const logArtifact = input.logArtifact
      ? await tx.characterLoraArtifact.create({
          data: {
            jobId: run.jobId,
            kind: "training_log",
            relativePath: input.logArtifact.relativePath,
            absolutePath: input.logArtifact.absolutePath,
            sha256: input.logArtifact.sha256,
            byteSize: input.logArtifact.byteSize ?? null,
            mimeType: "text/plain",
            redactionLevel: "path_only",
            metadata: input.logArtifact.metadata ?? Prisma.DbNull,
          },
          select: { id: true },
        })
      : null;

    for (const checkpoint of input.checkpoints) {
      const checkpointArtifact =
        checkpoint.relativePath === input.finalArtifact.relativePath
          ? finalArtifact
          : await tx.characterLoraArtifact.create({
              data: {
                jobId: run.jobId,
                kind: "safetensors",
                relativePath: checkpoint.relativePath,
                absolutePath: checkpoint.absolutePath,
                sha256: checkpoint.sha256,
                byteSize: checkpoint.byteSize ?? null,
                mimeType: "application/octet-stream",
                redactionLevel: "path_only",
                metadata: checkpoint.metrics ?? Prisma.DbNull,
              },
              select: { id: true },
            });

      await tx.characterLoraTrainingCheckpoint.upsert({
        where: {
          trainingRunId_step: {
            trainingRunId: run.id,
            step: checkpoint.step,
          },
        },
        update: {
          artifactId: checkpointArtifact.id,
          sha256: checkpoint.sha256,
          metrics: checkpoint.metrics ?? Prisma.DbNull,
        },
        create: {
          trainingRunId: run.id,
          step: checkpoint.step,
          artifactId: checkpointArtifact.id,
          sha256: checkpoint.sha256,
          metrics: checkpoint.metrics ?? Prisma.DbNull,
        },
        select: { id: true },
      });
    }

    await tx.characterLoraTrainingRun.update({
      where: { id: run.id },
      data: {
        status: CharacterLoraRunStatus.done,
        logArtifactId: logArtifact?.id ?? null,
        finalSafetensorsArtifactId: finalArtifact.id,
        finalSha256: input.finalArtifact.sha256,
        metadataSummary: toInputJsonValue(input.output.metadataSummary),
        currentStep: extractCompletionStep(input.output),
        targetSteps: run.targetSteps ?? extractCompletionStep(input.output),
        lossSnapshot: toInputJsonValue({
          final: true,
          hashes: input.output.hashes ?? {},
        }),
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: run.jobId },
      data: {
        status: CharacterLoraJobStatus.trained,
        phase: "training",
        failureSummary: null,
      },
      select: { id: true },
    });

    const completedTask = await tx.characterLoraWorkerTask.update({
      where: { id: task.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        progressJson: toInputJsonValue({
          completed: true,
          finalSafetensorsArtifactId: finalArtifact.id,
          finalSha256: input.finalArtifact.sha256,
        }),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });

    await tx.gpuTaskLock.updateMany({
      where: {
        ownerType: "character_lora_training_run",
        ownerId: run.id,
        status: "active",
      },
      data: {
        status: "released",
        releasedAt: new Date(),
      },
    });

    const refreshedRun = await tx.characterLoraTrainingRun.findUnique({
      where: { id: run.id },
      select: TRAINING_RUN_SELECT,
    });

    return { task: completedTask, trainingRun: refreshedRun };
  });

  return result
    ? {
        task: serializeWorkerTask(result.task),
        trainingRun: result.trainingRun ? serializeTrainingRun(result.trainingRun) : null,
      }
    : null;
}

export async function failCharacterLoraWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  errorSummary: string;
  progressJson?: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    const shouldMarkTrainingCancelled =
      task.targetType === "trainingRun" &&
      (input.errorSummary.toLowerCase().includes("cancel") ||
        hasCancelRequested(task.progressJson) ||
        hasCancelRequested(input.progressJson));
    const terminalStatus = shouldMarkTrainingCancelled ? CharacterLoraRunStatus.cancelled : CharacterLoraRunStatus.failed;
    const terminalJobStatus = shouldMarkTrainingCancelled ? CharacterLoraJobStatus.cancelled : CharacterLoraJobStatus.failed;

    await tx.characterLoraWorkerTask.update({
      where: { id: input.taskId },
      data: {
        status: terminalStatus,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        progressJson: input.progressJson ?? task.progressJson ?? Prisma.DbNull,
        errorSummary: input.errorSummary,
      },
      select: { id: true },
    });

    if (task.targetType === "generationRun") {
      const run = await tx.characterLoraGenerationRun.update({
        where: { id: task.targetId },
        data: {
          status: CharacterLoraRunStatus.failed,
          errorSummary: input.errorSummary,
          finishedAt: new Date(),
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.failed,
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });
    }

    if (task.targetType === "trainingRun") {
      const run = await tx.characterLoraTrainingRun.update({
        where: { id: task.targetId },
        data: {
          status: terminalStatus,
          finishedAt: new Date(),
          lossSnapshot: input.progressJson ?? task.progressJson ?? Prisma.DbNull,
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: terminalJobStatus,
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });

      await tx.gpuTaskLock.updateMany({
        where: {
          ownerType: "character_lora_training_run",
          ownerId: run.id,
          status: "active",
        },
        data: {
          status: "released",
          releasedAt: new Date(),
        },
      });
    }

    if (task.targetType === "benchmarkRun") {
      const run = await tx.characterLoraBenchmarkRun.update({
        where: { id: task.targetId },
        data: {
          status: CharacterLoraRunStatus.failed,
          finishedAt: new Date(),
          resultSummary: toInputJsonValue({
            errorSummary: input.errorSummary,
            progressJson: input.progressJson ?? task.progressJson ?? null,
          }),
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.failed,
          phase: "benchmark",
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });

      await tx.gpuTaskLock.updateMany({
        where: {
          ownerType: "character_lora_benchmark_run",
          ownerId: run.id,
          status: "active",
        },
        data: {
          status: "released",
          releasedAt: new Date(),
        },
      });
    }

    if (task.targetType === "datasetRevision") {
      await tx.characterLoraTrainingJob.update({
        where: { id: task.jobId },
        data: {
          status: CharacterLoraJobStatus.failed,
          phase: "dataset",
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });
    }

    return tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });
  });

  return result ? serializeWorkerTask(result) : null;
}

export async function completeDatasetFreezeWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  revision: CharacterLoraDatasetRevisionCreateInput;
  progressJson?: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    if (
      task.workerType !== CharacterLoraWorkerType.dataset_freeze ||
      task.targetType !== "datasetRevision" ||
      task.targetId !== input.revision.revisionId
    ) {
      return null;
    }

    const revision = await createFrozenCharacterLoraDatasetRevisionInTx(tx, input.revision);
    const completedTask = await tx.characterLoraWorkerTask.update({
      where: { id: task.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        progressJson: input.progressJson ?? toInputJsonValue({
          completed: true,
          datasetRevisionId: revision.id,
          version: revision.version,
          itemCount: revision.itemCount,
        }),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });

    return { task: completedTask, revision };
  });

  return result
    ? {
        task: serializeWorkerTask(result.task),
        revision: serializeDatasetRevision(result.revision),
      }
    : null;
}

export async function completePromptCardDraftWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
}) {
  const task = await db.$transaction(async (tx) => {
    const existing = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!existing || existing.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && existing.leaseOwner !== input.leaseOwner) {
      return null;
    }

    if (existing.workerType !== CharacterLoraWorkerType.prompt_card_draft || existing.targetType !== "promptCardDraft") {
      return null;
    }

    return tx.characterLoraWorkerTask.update({
      where: { id: existing.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });
  });

  return task ? serializeWorkerTask(task) : null;
}
