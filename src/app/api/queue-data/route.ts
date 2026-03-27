import { NextResponse } from "next/server";
import { getQueueRuns, getRunningRuns, getFailedRuns } from "@/lib/server-data";

export async function GET() {
  const [queueRuns, runningRuns, failedRuns] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
    getFailedRuns(),
  ]);
  return NextResponse.json({ queueRuns, runningRuns, failedRuns });
}
