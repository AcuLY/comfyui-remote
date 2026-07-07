import { Prisma } from "@/generated/prisma";
import { JobStatus, RunStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { WorkerRunSnapshot } from "@/server/worker/types";
import { getActiveComfyApiUrl } from "@/server/services/comfy-target";

const workerRunInclude = {
  project: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
  projectSection: {
    select: {
      id: true,
      name: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.RunInclude;

type WorkerRunRecord = Prisma.RunGetPayload<{
  include: typeof workerRunInclude;
}>;

type CompleteWorkerRunInput = {
  status: "done" | "failed";
  errorMessage?: string | null;
  comfyPromptId?: string | null;
  executionMeta?: Record<string, unknown> | null;
  submittedPrompt?: Record<string, unknown> | null;
  outputDir?: string | null;
  comfyOutputSubfolder?: string | null;
  images?: Array<{
    filePath: string;
    thumbPath: string | null;
    width: number | null;
    height: number | null;
    fileSize: bigint | null;
  }>;
};

export type GenerationWorkerRunStatus = {
  queue: {
    queued: number;
    running: number;
  };
  recentDone: Array<{
    id: string;
    projectTitle: string;
    sectionName: string;
    imagesCount: number;
    finishedAt: Date | null;
  }>;
  recentFailed: Array<{
    id: string;
    projectTitle: string;
    error: string | null;
    finishedAt: Date | null;
  }>;
};

function buildGenerationRunWhere(where: Prisma.RunWhereInput = {}): Prisma.RunWhereInput {
  return {
    AND: [
      where,
      { project: buildGenerationProjectWhere() },
    ],
  };
}

function serializeWorkerRunSnapshot(run: WorkerRunRecord): WorkerRunSnapshot {
  return {
    runId: run.id,
    runIndex: run.runIndex,
    status: run.status,
    workflowId: run.project.slug,
    comfyApiUrl: getActiveComfyApiUrl(),
    outputDir: run.outputDir,
    resolvedConfigSnapshot: run.resolvedConfigSnapshot,
    project: {
      id: run.project.id,
      title: run.project.title,
      slug: run.project.slug,
    },
    section: {
      id: run.projectSection.id,
      name: run.projectSection.name ?? `section_${run.projectSection.sortOrder + 1}`,
      slug: `section_${run.projectSection.sortOrder + 1}`,
    },
  };
}

export async function getGenerationWorkerRunStatus(): Promise<GenerationWorkerRunStatus> {
  const [queuedCount, runningCount, recentDone, recentFailed] = await Promise.all([
    db.run.count({ where: buildGenerationRunWhere({ status: RunStatus.queued }) }),
    db.run.count({ where: buildGenerationRunWhere({ status: RunStatus.running }) }),
    db.run.findMany({
      where: buildGenerationRunWhere({ status: RunStatus.done }),
      orderBy: { finishedAt: "desc" },
      take: 5,
      include: {
        project: { select: { title: true } },
        projectSection: { select: { name: true, sortOrder: true } },
        _count: { select: { images: true } },
      },
    }),
    db.run.findMany({
      where: buildGenerationRunWhere({ status: RunStatus.failed }),
      orderBy: { finishedAt: "desc" },
      take: 5,
      include: {
        project: { select: { title: true } },
      },
    }),
  ]);

  return {
    queue: {
      queued: queuedCount,
      running: runningCount,
    },
    recentDone: recentDone.map((run) => ({
      id: run.id,
      projectTitle: run.project.title,
      sectionName: run.projectSection.name ?? `section_${run.projectSection.sortOrder + 1}`,
      imagesCount: run._count.images,
      finishedAt: run.finishedAt,
    })),
    recentFailed: recentFailed.map((run) => ({
      id: run.id,
      projectTitle: run.project.title,
      error: run.errorMessage,
      finishedAt: run.finishedAt,
    })),
  };
}

async function updateProjectStatus(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const activeRuns = await tx.run.groupBy({
    by: ["status"],
    where: buildGenerationRunWhere({
      projectId: projectId,
      status: { in: [RunStatus.queued, RunStatus.running, RunStatus.paused] },
    }),
    _count: {
      _all: true,
    },
  });

  const activeRunCountByStatus = new Map(
    activeRuns.map((entry) => [entry.status, entry._count._all]),
  );

  let nextStatus: JobStatus = JobStatus.draft;

  if ((activeRunCountByStatus.get(RunStatus.running) ?? 0) > 0) {
    nextStatus = JobStatus.running;
  } else if ((activeRunCountByStatus.get(RunStatus.queued) ?? 0) > 0) {
    nextStatus = JobStatus.queued;
  } else if ((activeRunCountByStatus.get(RunStatus.paused) ?? 0) > 0) {
    nextStatus = JobStatus.queued;
  } else {
    const latestRunIds = (
      await tx.projectSection.findMany({
        where: {
          projectId: projectId,
          project: buildGenerationProjectWhere({ id: projectId }),
          enabled: true,
          latestRunId: { not: null },
        },
        select: {
          latestRunId: true,
        },
      })
    )
      .map((s) => s.latestRunId)
      .filter((runId): runId is string => runId !== null);

    if (latestRunIds.length > 0) {
      const latestRuns = await tx.run.findMany({
        where: buildGenerationRunWhere({
          id: { in: latestRunIds },
        }),
        select: {
          status: true,
        },
      });

      const doneCount = latestRuns.filter((run) => run.status === RunStatus.done).length;
      const failedCount = latestRuns.filter(
        (run) => run.status === RunStatus.failed || run.status === RunStatus.cancelled,
      ).length;

      if (doneCount === latestRuns.length) {
        nextStatus = JobStatus.done;
      } else if (failedCount === latestRuns.length) {
        nextStatus = JobStatus.failed;
      } else if (doneCount > 0 && failedCount > 0) {
        nextStatus = JobStatus.partial_done;
      } else if (failedCount > 0) {
        nextStatus = JobStatus.failed;
      }
    }
  }

  const updatedProject = await tx.project.updateMany({
    where: buildGenerationProjectWhere({ id: projectId }),
    data: { status: nextStatus },
  });

  return updatedProject.count > 0 ? nextStatus : null;
}

export async function listQueuedWorkerRuns(limit = 10): Promise<WorkerRunSnapshot[]> {
  const runs = await db.run.findMany({
    where: {
      status: RunStatus.queued,
      project: buildGenerationProjectWhere(),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    include: workerRunInclude,
  });

  return runs.map(serializeWorkerRunSnapshot);
}

export async function getWorkerRun(runId: string): Promise<WorkerRunSnapshot | null> {
  const run = await db.run.findFirst({
    where: buildGenerationRunWhere({ id: runId }),
    include: workerRunInclude,
  });

  return run ? serializeWorkerRunSnapshot(run) : null;
}

export async function completeWorkerRun(
  runId: string,
  input: CompleteWorkerRunInput,
) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const finishedAt = new Date();
    const data: Prisma.RunUpdateManyMutationInput = {
      status: input.status,
      finishedAt,
      errorMessage:
        input.status === RunStatus.failed
          ? input.errorMessage ?? "Worker pass failed"
          : null,
    };

    if (input.comfyPromptId !== undefined) {
      data.comfyPromptId = input.comfyPromptId;
    }

    if (input.executionMeta !== undefined && input.executionMeta !== null) {
      data.executionMeta = input.executionMeta as object;
    }

    if (input.submittedPrompt !== undefined && input.submittedPrompt !== null) {
      data.submittedPrompt = input.submittedPrompt as object;
    }

    if (input.outputDir !== undefined) {
      data.outputDir = input.outputDir;
    }

    if (input.comfyOutputSubfolder !== undefined) {
      data.comfyOutputSubfolder = input.comfyOutputSubfolder;
    }

    const completedRun = await tx.run.updateMany({
      where: buildGenerationRunWhere({
        id: runId,
        status: { in: [RunStatus.running, RunStatus.queued] },
      }),
      data,
    });

    if (completedRun.count === 0) {
      throw new Error("WORKER_RUN_NOT_RUNNING");
    }

    if (input.status === RunStatus.done && input.images !== undefined) {
      await tx.imageResult.deleteMany({
        where: {
          runId: runId,
          run: { project: buildGenerationProjectWhere() },
        },
      });

      if (input.images.length > 0) {
        await tx.imageResult.createMany({
          data: input.images.map((image) => ({
            runId: runId,
            filePath: image.filePath,
            thumbPath: image.thumbPath,
            width: image.width,
            height: image.height,
            fileSize: image.fileSize,
          })),
        });
      }
    }

    const finalizedRun = await tx.run.findFirst({
      where: buildGenerationRunWhere({ id: runId }),
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        outputDir: true,
        comfyPromptId: true,
        projectId: true,
        projectSectionId: true,
      },
    });

    if (!finalizedRun) {
      throw new Error("WORKER_RUN_NOT_FOUND");
    }

    await updateProjectStatus(tx, finalizedRun.projectId);

    // Update latestRunId to reflect the most recently completed run
    await tx.projectSection.updateMany({
      where: {
        id: finalizedRun.projectSectionId,
        project: buildGenerationProjectWhere({ id: finalizedRun.projectId }),
      },
      data: { latestRunId: runId },
    });

    return {
      runId: finalizedRun.id,
      status: finalizedRun.status,
      startedAt: finalizedRun.startedAt?.toISOString() ?? null,
      finishedAt: finalizedRun.finishedAt?.toISOString() ?? null,
      errorMessage: finalizedRun.errorMessage,
      outputDir: finalizedRun.outputDir,
      comfyPromptId: finalizedRun.comfyPromptId,
    };
  }, { timeout: 15000 });
}
