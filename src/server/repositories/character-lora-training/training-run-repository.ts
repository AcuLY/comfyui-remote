import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraTrainingTaskPayload } from "@/server/character-lora-training/contracts";

import { extractTargetSteps, toInputJsonValue } from "./helpers";
import { serializeGpuTaskLock, serializeTrainingRun } from "./serializers";
import {
  GPU_TASK_LOCK_SELECT,
  JOB_SUMMARY_SELECT,
  DATASET_REVISION_SELECT,
  TRAINING_RUN_SELECT,
} from "./types";

export async function listCharacterLoraTrainingRuns(jobId: string) {
  const runs = await db.characterLoraTrainingRun.findMany({
    where: { jobId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: TRAINING_RUN_SELECT,
  });

  return runs.map(serializeTrainingRun);
}

export async function getCharacterLoraTrainingRun(trainingRunId: string) {
  const run = await db.characterLoraTrainingRun.findUnique({
    where: { id: trainingRunId },
    select: TRAINING_RUN_SELECT,
  });

  return run ? serializeTrainingRun(run) : null;
}

export async function getCharacterLoraTrainingRunWithFinalArtifact(trainingRunId: string) {
  return db.characterLoraTrainingRun.findUnique({
    where: { id: trainingRunId },
    select: {
      id: true,
      jobId: true,
      datasetRevisionId: true,
      status: true,
      finalSafetensorsArtifactId: true,
      finalSha256: true,
      job: { select: JOB_SUMMARY_SELECT },
      datasetRevision: { select: DATASET_REVISION_SELECT },
    },
  });
}

export async function cancelCharacterLoraTrainingRun(input: {
  trainingRunId: string;
  reason?: string | null;
  requestedBy?: string | null;
  cancelSignalArtifact?: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  } | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const run = await tx.characterLoraTrainingRun.findUnique({
      where: { id: input.trainingRunId },
      select: TRAINING_RUN_SELECT,
    });

    if (!run) {
      return null;
    }

    const cancelSummary = {
      cancelRequested: true,
      reason: input.reason ?? null,
      requestedBy: input.requestedBy ?? null,
      cancelSignalPath: input.cancelSignalArtifact?.relativePath ?? null,
    };

    let cancelArtifactId: string | null = null;
    if (input.cancelSignalArtifact) {
      const artifact = await tx.characterLoraArtifact.create({
        data: {
          jobId: run.jobId,
          kind: "training_log",
          relativePath: input.cancelSignalArtifact.relativePath,
          absolutePath: input.cancelSignalArtifact.absolutePath,
          sha256: input.cancelSignalArtifact.sha256,
          byteSize: input.cancelSignalArtifact.byteSize,
          mimeType: "application/json",
          redactionLevel: "path_only",
          metadata: input.cancelSignalArtifact.metadata,
        },
        select: { id: true },
      });
      cancelArtifactId = artifact.id;
    }

    if (run.status === CharacterLoraRunStatus.queued) {
      await tx.characterLoraWorkerTask.updateMany({
        where: {
          targetType: "trainingRun",
          targetId: run.id,
          status: CharacterLoraRunStatus.queued,
        },
        data: {
          status: CharacterLoraRunStatus.cancelled,
          finishedAt: new Date(),
          progressJson: toInputJsonValue(cancelSummary),
          errorSummary: input.reason ?? "Training run cancelled before lease",
        },
      });

      await tx.characterLoraTrainingRun.update({
        where: { id: run.id },
        data: {
          status: CharacterLoraRunStatus.cancelled,
          cancelRequestedAt: new Date(),
          finishedAt: new Date(),
          lossSnapshot: toInputJsonValue({
            ...cancelSummary,
            cancelSignalArtifactId: cancelArtifactId,
          }),
        },
        select: { id: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.cancelled,
          phase: "training",
          failureSummary: input.reason ?? "Training run cancelled before lease",
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
    } else if (run.status === CharacterLoraRunStatus.running) {
      await tx.characterLoraWorkerTask.updateMany({
        where: {
          targetType: "trainingRun",
          targetId: run.id,
          status: CharacterLoraRunStatus.running,
        },
        data: {
          progressJson: toInputJsonValue(cancelSummary),
          heartbeatAt: new Date(),
        },
      });

      await tx.characterLoraTrainingRun.update({
        where: { id: run.id },
        data: {
          cancelRequestedAt: new Date(),
          lossSnapshot: toInputJsonValue({
            ...cancelSummary,
            cancelSignalArtifactId: cancelArtifactId,
          }),
        },
        select: { id: true },
      });
    }

    const refreshedRun = await tx.characterLoraTrainingRun.findUnique({
      where: { id: run.id },
      select: TRAINING_RUN_SELECT,
    });

    return refreshedRun;
  });

  return result ? serializeTrainingRun(result) : null;
}

export async function createCharacterLoraTrainingRunWithTask(input: {
  trainingRunId: string;
  jobId: string;
  datasetRevisionId: string;
  launcher: string;
  resolvedConfig: Prisma.InputJsonValue;
  outputDir: string;
  configArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  };
  dryRunSummaryArtifact?: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  } | null;
  taskPayload: CharacterLoraTrainingTaskPayload;
  gpuLockMetadata: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const configArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: input.jobId,
        kind: "training_config",
        relativePath: input.configArtifact.relativePath,
        absolutePath: input.configArtifact.absolutePath,
        sha256: input.configArtifact.sha256,
        byteSize: input.configArtifact.byteSize,
        mimeType: "application/toml",
        redactionLevel: "path_only",
        metadata: input.configArtifact.metadata,
      },
      select: { id: true },
    });

    const dryRunSummaryArtifact = input.dryRunSummaryArtifact
      ? await tx.characterLoraArtifact.create({
          data: {
            jobId: input.jobId,
            kind: "training_config",
            relativePath: input.dryRunSummaryArtifact.relativePath,
            absolutePath: input.dryRunSummaryArtifact.absolutePath,
            sha256: input.dryRunSummaryArtifact.sha256,
            byteSize: input.dryRunSummaryArtifact.byteSize,
            mimeType: "application/json",
            redactionLevel: "path_only",
            metadata: input.dryRunSummaryArtifact.metadata,
          },
          select: { id: true },
        })
      : null;

    const targetSteps = extractTargetSteps(input.resolvedConfig);
    const run = await tx.characterLoraTrainingRun.create({
      data: {
        id: input.trainingRunId,
        jobId: input.jobId,
        datasetRevisionId: input.datasetRevisionId,
        status: CharacterLoraRunStatus.queued,
        launcher: input.launcher,
        resolvedConfig: input.resolvedConfig,
        configArtifactId: configArtifact.id,
        dryRunSummaryArtifactId: dryRunSummaryArtifact?.id ?? null,
        outputDir: input.outputDir,
        targetSteps,
      },
      select: TRAINING_RUN_SELECT,
    });

    const task = await tx.characterLoraWorkerTask.create({
      data: {
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.training,
        targetType: "trainingRun",
        targetId: run.id,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
      },
      select: { id: true },
    });

    const gpuLock = await tx.gpuTaskLock.create({
      data: {
        taskType: "training",
        ownerType: "character_lora_training_run",
        ownerId: run.id,
        status: "active",
        metadata: input.gpuLockMetadata,
      },
      select: GPU_TASK_LOCK_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.training_queued,
        phase: "training",
        selectedDatasetRevisionId: input.datasetRevisionId,
        failureSummary: null,
      },
      select: { id: true },
    });

    return { run, taskId: task.id, gpuLock };
  });

  return {
    trainingRun: serializeTrainingRun(result.run),
    workerTaskId: result.taskId,
    gpuTaskLock: serializeGpuTaskLock(result.gpuLock),
  };
}
