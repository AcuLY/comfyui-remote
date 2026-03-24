/**
 * GET /api/worker/status
 *
 * Returns current worker-relevant stats:
 * - queued run count
 * - running run count
 * - recent completed runs
 * - ComfyUI connectivity status
 */

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

async function pingComfyUI(): Promise<boolean> {
  try {
    const res = await fetch(`${env.comfyApiUrl}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const [queuedCount, runningCount, recentDone, recentFailed, comfyReachable] =
      await Promise.all([
        prisma.positionRun.count({ where: { status: "queued" } }),
        prisma.positionRun.count({ where: { status: "running" } }),
        prisma.positionRun.findMany({
          where: { status: "done" },
          orderBy: { finishedAt: "desc" },
          take: 5,
          select: {
            id: true,
            finishedAt: true,
            completeJob: { select: { title: true } },
            completeJobPosition: {
              select: { positionTemplate: { select: { name: true } } },
            },
            _count: { select: { images: true } },
          },
        }),
        prisma.positionRun.findMany({
          where: { status: "failed" },
          orderBy: { finishedAt: "desc" },
          take: 5,
          select: {
            id: true,
            finishedAt: true,
            errorMessage: true,
            completeJob: { select: { title: true } },
          },
        }),
        pingComfyUI(),
      ]);

    return ok({
      comfyui: {
        reachable: comfyReachable,
        url: env.comfyApiUrl,
      },
      queue: {
        queued: queuedCount,
        running: runningCount,
      },
      recentDone: recentDone.map((r) => ({
        id: r.id,
        jobTitle: r.completeJob.title,
        positionName: r.completeJobPosition.positionTemplate.name,
        imagesCount: r._count.images,
        finishedAt: r.finishedAt,
      })),
      recentFailed: recentFailed.map((r) => ({
        id: r.id,
        jobTitle: r.completeJob.title,
        error: r.errorMessage,
        finishedAt: r.finishedAt,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("Failed to load worker status", 500, message);
  }
}
