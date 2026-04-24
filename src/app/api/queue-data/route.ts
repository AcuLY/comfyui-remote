import { NextResponse } from "next/server";
import { getQueueRuns, getRunningRuns, getFailedRuns } from "@/lib/server-data";
import { recoverStaleRuns } from "@/server/services/run-executor";

export async function GET() {
  const [queueRuns, runningRuns, failedRuns] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
    getFailedRuns(),
  ]);

  // Auto-recover: if there are active runs (queued/running) that may not
  // be polled (e.g. after server restart), resume polling for them.
  if (runningRuns.length > 0) {
    recoverStaleRuns().catch(() => {});
  }

  return NextResponse.json({ queueRuns, runningRuns, failedRuns });
}
