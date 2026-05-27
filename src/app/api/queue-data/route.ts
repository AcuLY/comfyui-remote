import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getQueueRunsPage, getRunningRuns, getFailedRuns, getTrashItems } from "@/lib/server-data";
import { recoverStaleRuns } from "@/server/services/run-executor";
import { prisma } from "@/lib/prisma";

function readPositiveInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const page = readPositiveInteger(request.nextUrl.searchParams.get("page"));
  const pageSize = readPositiveInteger(request.nextUrl.searchParams.get("pageSize"));
  const includeTrash = request.nextUrl.searchParams.get("includeTrash") === "1";
  const [queuePage, runningRuns, failedRuns, trashItems] = await Promise.all([
    getQueueRunsPage({ page, pageSize }),
    getRunningRuns(),
    getFailedRuns(),
    includeTrash ? getTrashItems() : Promise.resolve(null),
  ]);

  // Auto-recover: if there are active runs (queued/running) that may not
  // be polled (e.g. after server restart), resume polling for them.
  if (runningRuns.length > 0) {
    recoverStaleRuns().catch((e) => {
      console.error("recoverStaleRuns failed:", e);
    });
  }

  // Get censoring progress - find projects with active (queued/running) tasks
  const activeCensoringProjects = await prisma.censoringTask.groupBy({
    by: ["projectId"],
    where: { status: { in: ["queued", "running"] } },
  });

  let censoringProgress: Array<{
    projectId: string;
    projectTitle: string;
    total: number;
    done: number;
    running: number;
    queued: number;
    failed: number;
  }> = [];

  if (activeCensoringProjects.length > 0) {
    const projectIds = activeCensoringProjects.map((p) => p.projectId);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, title: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p.title]));

    const taskCounts = await prisma.censoringTask.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    // Aggregate per project
    for (const pid of projectIds) {
      const counts = { total: 0, done: 0, running: 0, queued: 0, failed: 0 };
      for (const group of taskCounts) {
        if (group.projectId !== pid) continue;
        const c = group._count._all;
        counts.total += c;
        if (group.status === "done") counts.done = c;
        else if (group.status === "running") counts.running = c;
        else if (group.status === "queued") counts.queued = c;
        else if (group.status === "failed") counts.failed = c;
      }
      censoringProgress.push({
        projectId: pid,
        projectTitle: projectMap.get(pid) ?? "Unknown",
        ...counts,
      });
    }
  }

  return NextResponse.json({
    queueRuns: queuePage.runs,
    queuePagination: queuePage.pagination,
    runningRuns,
    failedRuns,
    censoringProgress,
    ...(trashItems ? { trashItems } : {}),
  });
}
