/**
 * POST /api/comfy/restart
 *
 * Restart the ComfyUI process. Only available from localhost.
 * Also resets the max-restart counter so manual restart always works.
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
  manager.resetMaxRestarts();
  const result = await manager.restart();

  if (!result.ok) {
    return fail(result.message, 400);
  }

  return ok({ message: result.message });
}
