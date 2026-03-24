/**
 * GET /api/comfy/status
 *
 * Returns ComfyUI process status, health, uptime, and recent logs.
 */

import { ok } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const manager = getComfyProcessManager();
  return ok(manager.getStatus());
}
