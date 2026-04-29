import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getQueueRunsPage, getRunningRuns, getFailedRuns } from "@/lib/server-data";
import { recoverStaleRuns } from "@/server/services/run-executor";

function readPositiveInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const page = readPositiveInteger(request.nextUrl.searchParams.get("page"));
  const pageSize = readPositiveInteger(request.nextUrl.searchParams.get("pageSize"));
  const [queuePage, runningRuns, failedRuns] = await Promise.all([
    getQueueRunsPage({ page, pageSize }),
    getRunningRuns(),
    getFailedRuns(),
  ]);

  // Auto-recover: if there are active runs (queued/running) that may not
  // be polled (e.g. after server restart), resume polling for them.
  if (runningRuns.length > 0) {
    recoverStaleRuns().catch(() => {});
  }

  return NextResponse.json({
    queueRuns: queuePage.runs,
    queuePagination: queuePage.pagination,
    runningRuns,
    failedRuns,
  });
}
