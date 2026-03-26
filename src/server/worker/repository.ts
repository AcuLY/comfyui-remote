import { Prisma } from "@/generated/prisma";
import { JobStatus, RunStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { WorkerRunSnapshot } from "@/server/worker/types";

const workerRunInclude = {
  completeJob: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
  completeJobPosition: {
    select: {
      id: true,
      name: true,
      positionTemplate: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.PositionRunInclude;

type WorkerRunRecord = Prisma.PositionRunGetPayload<{
  include: typeof workerRunInclude;
}>;

type CompleteWorkerRunInput = {
  status: "done" | "failed";
  errorMessage?: string | null;
  comfyPromptId?: string | null;
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
    workflowId: run.completeJob.slug,
    comfyApiUrl: env.comfyApiUrl,
    outputDir: run.outputDir,
    resolvedConfigSnapshot: run.resolvedConfigSnapshot,
    job: {
      id: run.completeJob.id,
      title: run.completeJob.title,
      slug: run.completeJob.slug,
    },
    position: {
      id: run.completeJobPosition.id,
      name: run.completeJobPosition.name ?? run.completeJobPosition.positionTemplate?.name ?? `section`,
      slug: run.completeJobPosition.positionTemplate?.slug ?? "unknown",
    },
  };
}

async function updateCompleteJobStatus(
  tx: Prisma.TransactionClient,
  jobId: string,
) {
  const activeRuns = await tx.positionRun.groupBy({
    by: ["status"],
    where: {
      completeJobId: jobId,
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
      await tx.completeJobPosition.findMany({
        where: {
          completeJobId: jobId,
          enabled: true,
          latestRunId: { not: null },
        },
        select: {
          latestRunId: true,
        },
      })
    )
      .map((position) => position.latestRunId)
      .filter((runId): runId is string => runId !== null);

    if (latestRunIds.length > 0) {
      const latestRuns = await tx.positionRun.findMany({
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

  const updatedJob = await tx.completeJob.update({
    where: { id: jobId },
    data: { status: nextStatus },
    select: { status: true },
  });

  return updatedJob.status;
}

export async function listQueuedWorkerRuns(limit = 10): Promise<WorkerRunSnapshot[]> {
  const runs = await db.positionRun.findMany({
    where: {
      status: RunStatus.queued,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    include: workerRunInclude,
  });

  return runs.map(serializeWorkerRunSnapshot);
}

export async function completeWorkerRun(
  runId: string,
  input: CompleteWorkerRunInput,
) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const finishedAt = new Date();
    const data: Prisma.PositionRunUpdateManyMutationInput = {
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

    if (input.outputDir !== undefined) {
      data.outputDir = input.outputDir;
    }

    if (input.status === RunStatus.done && input.images !== undefined) {
      await tx.imageResult.deleteMany({
        where: {
          positionRunId: runId,
        },
      });

      if (input.images.length > 0) {
        await tx.imageResult.createMany({
          data: input.images.map((image) => ({
            positionRunId: runId,
            filePath: image.filePath,
            thumbPath: image.thumbPath,
            width: image.width,
            height: image.height,
            fileSize: image.fileSize,
          })),
        });
      }
    }

    const completedRun = await tx.positionRun.updateMany({
      where: {
        id: runId,
        status: RunStatus.running,
      },
      data,
    });

    if (completedRun.count === 0) {
      throw new Error("WORKER_RUN_NOT_RUNNING");
    }

    const finalizedRun = await tx.positionRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        outputDir: true,
        comfyPromptId: true,
        completeJobId: true,
      },
    });

    if (!finalizedRun) {
      throw new Error("WORKER_RUN_NOT_FOUND");
    }

    await updateCompleteJobStatus(tx, finalizedRun.completeJobId);

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
