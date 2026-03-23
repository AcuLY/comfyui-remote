import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { runWorkerPass } from "@/server/worker/index";

const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 10;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isLoopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function parseLimit(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("limit");

  if (value === null) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new Error(`"limit" must be an integer between 1 and ${MAX_LIMIT}.`);
  }

  return parsed;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isLoopbackHost(request.nextUrl.hostname)) {
    return fail("Local worker pass trigger is only available from localhost.", 403);
  }

  let limit = DEFAULT_LIMIT;

  try {
    limit = parseLimit(request);
  } catch (error) {
    return fail("Invalid worker pass request.", 400, formatError(error));
  }

  try {
    const data = await runWorkerPass(limit);
    return ok(data);
  } catch (error) {
    return fail("Failed to run local worker pass.", 500, formatError(error));
  }
}
