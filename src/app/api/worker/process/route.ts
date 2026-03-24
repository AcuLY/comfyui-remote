/**
 * POST /api/worker/process
 *
 * Manually trigger the worker to process queued PositionRuns.
 * Accepts optional `limit` as query param or JSON body (default 5, max 10).
 *
 * Security: only accessible from localhost (same as /api/local/worker/pass).
 */

import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { runWorkerPass } from "@/server/worker/index";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isLoopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function clampLimit(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);

  if (isNaN(num) || !Number.isInteger(num)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(num, 1), MAX_LIMIT);
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isLoopbackHost(request.nextUrl.hostname)) {
    return fail("Worker process trigger is only available from localhost.", 403);
  }

  // Accept limit from query string or JSON body
  const queryLimit = request.nextUrl.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;

  if (queryLimit !== null) {
    limit = clampLimit(queryLimit);
  } else {
    try {
      const body = await request.json();
      if (body && typeof body === "object" && "limit" in body) {
        limit = clampLimit(body.limit);
      }
    } catch {
      // No body or invalid JSON — use default
    }
  }

  try {
    const data = await runWorkerPass(limit);
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail("Failed to run worker process.", 500, message);
  }
}
