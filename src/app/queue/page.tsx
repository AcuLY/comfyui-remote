import { QueuePageClient } from "./queue-page-client";
import { getQueueRunsPage, getRunningRuns, getFailedRuns, getTrashItems } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function readPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  const [queuePage, runningRuns, failedRuns, trashItems] = await Promise.all([
    getQueueRunsPage({ page: readPage(page) }),
    getRunningRuns(),
    getFailedRuns(),
    getTrashItems(),
  ]);

  // Get censoring progress
  const activeCensoringProjects = await prisma.censoringTask.groupBy({
    by: ["projectId"],
    where: { status: { in: ["queued", "running", "paused"] } },
  });

  let censoringProgress: Array<{
    projectId: string;
    projectTitle: string;
    total: number;
    done: number;
    running: number;
    queued: number;
    failed: number;
    paused: number;
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

    for (const pid of projectIds) {
      const counts = { total: 0, done: 0, running: 0, queued: 0, failed: 0, paused: 0 };
      for (const group of taskCounts) {
        if (group.projectId !== pid) continue;
        const c = group._count._all;
        counts.total += c;
        if (group.status === "done") counts.done = c;
        else if (group.status === "running") counts.running = c;
        else if (group.status === "queued") counts.queued = c;
        else if (group.status === "failed") counts.failed = c;
        else if (group.status === "paused") counts.paused = c;
      }
      censoringProgress.push({
        projectId: pid,
        projectTitle: projectMap.get(pid) ?? "Unknown",
        ...counts,
      });
    }
  }

  return (
    <QueuePageClient
      initialQueueRuns={queuePage.runs}
      initialQueuePagination={queuePage.pagination}
      initialRunningRuns={runningRuns}
      initialFailedRuns={failedRuns}
      initialTrashItems={trashItems}
      initialCensoringProgress={censoringProgress}
    />
  );
}
