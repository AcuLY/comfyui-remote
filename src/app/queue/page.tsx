import { QueuePageClient } from "./queue-page-client";
import { getQueueRuns, getRunningRuns, getFailedRuns } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [queueRuns, runningRuns, failedRuns] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
    getFailedRuns(),
  ]);

  return (
    <QueuePageClient
      initialQueueRuns={queueRuns}
      initialRunningRuns={runningRuns}
      initialFailedRuns={failedRuns}
    />
  );
}
