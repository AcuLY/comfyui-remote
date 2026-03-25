import { QueuePageClient } from "./queue-page-client";
import { getQueueRuns, getRunningRuns } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [queueRuns, runningRuns] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
  ]);

  return <QueuePageClient initialQueueRuns={queueRuns} initialRunningRuns={runningRuns} />;
}
