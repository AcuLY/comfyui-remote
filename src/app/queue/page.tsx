import { QueuePageClient } from "./queue-page-client";
import { getQueueRunsPage, getRunningRuns, getFailedRuns, getTrashItems } from "@/lib/server-data";

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

  return (
    <QueuePageClient
      initialQueueRuns={queuePage.runs}
      initialQueuePagination={queuePage.pagination}
      initialRunningRuns={runningRuns}
      initialFailedRuns={failedRuns}
      initialTrashItems={trashItems}
    />
  );
}
