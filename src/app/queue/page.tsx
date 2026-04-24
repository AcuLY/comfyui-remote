import { QueuePageClient } from "./queue-page-client";
import { getQueueRuns, getRunningRuns, getFailedRuns, getTrashItems } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [queueRuns, runningRuns, failedRuns, trashItems] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
    getFailedRuns(),
    getTrashItems(),
  ]);

  return (
    <QueuePageClient
      initialQueueRuns={queueRuns}
      initialRunningRuns={runningRuns}
      initialFailedRuns={failedRuns}
      initialTrashItems={trashItems}
    />
  );
}
