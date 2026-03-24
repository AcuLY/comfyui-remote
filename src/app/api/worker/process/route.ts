/**
 * POST /api/worker/process
 *
 * Manually trigger the worker to process queued PositionRuns.
 * Accepts optional `limit` query param (default 5, max 10).
 *
 * This is a local-only development endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { runWorkerPass } from "@/server/worker/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max((body.limit as number) ?? 5, 1), 10);

    const report = await runWorkerPass(limit);
    return NextResponse.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
