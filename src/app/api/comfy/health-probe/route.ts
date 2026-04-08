/**
 * POST /api/comfy/health-probe
 *
 * Manually trigger a health check against the ComfyUI API and return the result.
 */

import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export async function POST(_request: NextRequest) {
  const manager = getComfyProcessManager();
  const result = await manager.probeHealth();
  return ok(result);
}
