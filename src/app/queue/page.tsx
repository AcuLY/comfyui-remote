import { QueuePageClient } from "./queue-page-client";
import { getQueueRunsPage, getRunningRuns, getFailedRuns, getTrashItems } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";
import { toImageUrl } from "@/lib/image-url";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";

export const dynamic = "force-dynamic";

function readPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; trashPage?: string | string[] }>;
}) {
  const { page, trashPage } = await searchParams;
  const [queuePage, runningRuns, failedRuns, trashPageData] = await Promise.all([
    getQueueRunsPage({ page: readPage(page) }),
    getRunningRuns(),
    getFailedRuns(),
    getTrashItems({ page: readPage(trashPage) }),
  ]);

  // Get censoring progress
  const activeCensoringProjects = await prisma.censoringTask.groupBy({
    by: ["projectId"],
    where: {
      status: { in: ["queued", "running", "paused"] },
      project: buildGenerationProjectWhere(),
    },
  });

  const censoringProgress: Array<{
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
      where: buildGenerationProjectWhere({ id: { in: projectIds } }),
      select: { id: true, title: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p.title]));
    const visibleProjectIds = projects.map((p) => p.id);

    const taskCounts = await prisma.censoringTask.groupBy({
      by: ["projectId", "status"],
      where: {
        projectId: { in: visibleProjectIds },
        project: buildGenerationProjectWhere(),
      },
      _count: { _all: true },
    });

    for (const pid of visibleProjectIds) {
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

  // Get censoring history — last 50 done/failed tasks
  const censoringHistoryRaw = await prisma.censoringTask.findMany({
    where: {
      status: { in: ["done", "failed"] },
      project: buildGenerationProjectWhere(),
    },
    orderBy: { finishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      project: { select: { id: true, title: true } },
      imageResult: { select: { id: true, thumbPath: true, filePath: true, censoredThumbPath: true } },
    },
  });

  const censoringHistory = censoringHistoryRaw.map((t) => ({
    id: t.id,
    status: t.status,
    errorMessage: t.errorMessage,
    createdAt: t.createdAt.toISOString(),
    startedAt: t.startedAt?.toISOString() ?? null,
    finishedAt: t.finishedAt?.toISOString() ?? null,
    projectTitle: t.project.title,
    thumbUrl: toImageUrl(t.imageResult.censoredThumbPath ?? t.imageResult.thumbPath ?? t.imageResult.filePath) ?? "",
  }));

  return (
    <QueuePageClient
      initialQueueRuns={queuePage.runs}
      initialQueuePagination={queuePage.pagination}
      initialRunningRuns={runningRuns}
      initialFailedRuns={failedRuns}
      initialTrashItems={trashPageData.items}
      initialTrashPagination={trashPageData.pagination}
      initialCensoringProgress={censoringProgress}
      initialCensoringHistory={censoringHistory}
    />
  );
}
