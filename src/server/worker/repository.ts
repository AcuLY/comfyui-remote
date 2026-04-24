import { Prisma } from "@/generated/prisma";
import { JobStatus, RunStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { WorkerRunSnapshot } from "@/server/worker/types";

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
  images?: Array<{
    filePath: string;
    thumbPath: string | null;
    width: number | null;
    height: number | null;
    fileSize: bigint | null;
  }>;
};

function serializeWorkerRunSnapshot(run: WorkerRunRecord): WorkerRunSnapshot {
  return {
    runId: run.id,
    runIndex: run.runIndex,
    status: run.status,
    workflowId: run.project.slug,
    comfyApiUrl: env.comfyApiUrl,
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

async function updateProjectStatus(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const activeRuns = await tx.run.groupBy({
    by: ["status"],
    where: {
      projectId: projectId,
      status: { in: [RunStatus.queued, RunStatus.running] },
    },
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
  } else {
    const latestRunIds = (
      await tx.projectSection.findMany({
        where: {
          projectId: projectId,
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
        where: {
          id: { in: latestRunIds },
        },
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

  const updatedProject = await tx.project.update({
    where: { id: projectId },
    data: { status: nextStatus },
    select: { status: true },
  });

  return updatedProject.status;
}

export async function listQueuedWorkerRuns(limit = 10): Promise<WorkerRunSnapshot[]> {
  const runs = await db.run.findMany({
    where: {
      status: RunStatus.queued,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    include: workerRunInclude,
  });

  return runs.map(serializeWorkerRunSnapshot);
}

export async function getWorkerRun(runId: string): Promise<WorkerRunSnapshot | null> {
  const run = await db.run.findUnique({
    where: { id: runId },
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

    if (input.status === RunStatus.done && input.images !== undefined) {
      await tx.imageResult.deleteMany({
        where: {
          runId: runId,
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

    const completedRun = await tx.run.updateMany({
      where: {
        id: runId,
        status: { in: [RunStatus.running, RunStatus.queued] },
      },
      data,
    });

    if (completedRun.count === 0) {
      throw new Error("WORKER_RUN_NOT_RUNNING");
    }

    const finalizedRun = await tx.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        outputDir: true,
        comfyPromptId: true,
        projectId: true,
      },
    });

    if (!finalizedRun) {
      throw new Error("WORKER_RUN_NOT_FOUND");
    }

    await updateProjectStatus(tx, finalizedRun.projectId);

    return {
      runId: finalizedRun.id,
      status: finalizedRun.status,
      startedAt: finalizedRun.startedAt?.toISOString() ?? null,
      finishedAt: finalizedRun.finishedAt?.toISOString() ?? null,
      errorMessage: finalizedRun.errorMessage,
      outputDir: finalizedRun.outputDir,
      comfyPromptId: finalizedRun.comfyPromptId,
    };
  });
}
