import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { WorkerRunSnapshot } from "@/server/worker/types";

export async function listQueuedWorkerRuns(limit = 10): Promise<WorkerRunSnapshot[]> {
  const runs = await db.positionRun.findMany({
    where: {
      status: "queued",
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    include: {
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
          positionTemplate: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  return runs.map((run) => ({
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
      name: run.completeJobPosition.positionTemplate.name,
      slug: run.completeJobPosition.positionTemplate.slug,
    },
  }));
}
