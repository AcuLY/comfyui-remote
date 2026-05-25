/**
 * POST /api/comfy/health-probe
 *
 * Manually trigger a health check against the ComfyUI API and return the result.
 */

import { ok, fail } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export async function POST() {
  try {
    const manager = getComfyProcessManager();
    const result = await manager.probeHealth();
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}
