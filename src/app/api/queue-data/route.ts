import { NextResponse } from "next/server";
import { getQueueRuns, getRunningRuns } from "@/lib/server-data";

export async function GET() {
  const [queueRuns, runningRuns] = await Promise.all([
    getQueueRuns(),
    getRunningRuns(),
  ]);
  return NextResponse.json({ queueRuns, runningRuns });
}
