/**
 * POST /api/comfy/stop
 *
 * Stop the ComfyUI process. Only available from localhost.
 */

import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export async function POST(request: NextRequest) {
  if (!LOOPBACK_HOSTS.has(request.nextUrl.hostname.toLowerCase())) {
    return fail("ComfyUI control is only available from localhost.", 403);
  }

  const manager = getComfyProcessManager();
  const result = await manager.stop();

  if (!result.ok) {
    return fail(result.message, 400);
  }

  return ok({ message: result.message });
}
