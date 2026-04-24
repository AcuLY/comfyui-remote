import { NextResponse } from "next/server";
import { getQueueRuns, getRunningRuns, getFailedRuns } from "@/lib/server-data";
import { executeQueuedRuns } from "@/server/services/run-executor";

export async function GET() {
  const [queueRuns, runningRuns, failedRuns] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
    getFailedRuns(),
  ]);

  // Auto-trigger executor if there are queued runs but none running
  if (queueRuns.length > 0 && runningRuns.length === 0) {
    executeQueuedRuns().catch(() => {});
  }

  return NextResponse.json({ queueRuns, runningRuns, failedRuns });
}
