/**
 * POST /api/worker/process
 *
 * Manually trigger the worker to process queued PositionRuns.
 * Accepts optional `limit` in the request body (default 5).
 *
 * This is a local-only development endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { processQueuedRuns, processRun } from "@/lib/worker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const runId = body.runId as string | undefined;
    const limit = (body.limit as number) ?? 5;

    if (runId) {
      // Process a specific run
      const result = await processRun(runId);
      return NextResponse.json({ results: [result] });
    }

    // Process all queued runs
    const results = await processQueuedRuns(limit);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
