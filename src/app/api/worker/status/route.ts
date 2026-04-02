/**
 * GET /api/worker/status
 *
 * Returns current queue and ComfyUI connectivity stats.
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
        prisma.run.count({ where: { status: "queued" } }),
        prisma.run.count({ where: { status: "running" } }),
        prisma.run.findMany({
          where: { status: "done" },
          orderBy: { finishedAt: "desc" },
          take: 5,
          include: {
            project: { select: { title: true } },
            projectSection: { select: { name: true, sortOrder: true } },
            _count: { select: { images: true } },
          },
        }),
        prisma.run.findMany({
          where: { status: "failed" },
          orderBy: { finishedAt: "desc" },
          take: 5,
          include: {
            project: { select: { title: true } },
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
        projectTitle: r.project.title,
        sectionName: r.projectSection.name ?? `section_${r.projectSection.sortOrder + 1}`,
        imagesCount: r._count.images,
        finishedAt: r.finishedAt,
      })),
      recentFailed: recentFailed.map((r) => ({
        id: r.id,
        projectTitle: r.project.title,
        error: r.errorMessage,
        finishedAt: r.finishedAt,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("Failed to load queue status", 500, message);
  }
}
