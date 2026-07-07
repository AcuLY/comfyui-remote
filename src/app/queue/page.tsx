import { QueuePageClient } from "./queue-page-client";
import {
  getCensoringQueueData,
  getFailedRuns,
  getQueueRunsPage,
  getRunningRuns,
  getTrashItems,
} from "@/lib/server-data";

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
  const [queuePage, runningRuns, failedRuns, trashPageData, censoringQueueData] = await Promise.all([
    getQueueRunsPage({ page: readPage(page) }),
    getRunningRuns(),
    getFailedRuns(),
    getTrashItems({ page: readPage(trashPage) }),
    getCensoringQueueData(),
  ]);

  return (
    <QueuePageClient
      initialQueueRuns={queuePage.runs}
      initialQueuePagination={queuePage.pagination}
      initialRunningRuns={runningRuns}
      initialFailedRuns={failedRuns}
      initialTrashItems={trashPageData.items}
      initialTrashPagination={trashPageData.pagination}
      initialCensoringProgress={censoringQueueData.censoringProgress}
      initialCensoringHistory={censoringQueueData.censoringHistory}
    />
  );
}
