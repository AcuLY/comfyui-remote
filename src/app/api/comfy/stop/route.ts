/**
 * POST /api/comfy/stop
 *
 * Stop the ComfyUI process. Protected by auth middleware.
 */

import { fail, ok } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export async function POST() {
  const manager = getComfyProcessManager();
  const result = await manager.stop();

  if (!result.ok) {
    return fail(result.message, 400);
  }

  return ok({ message: result.message });
}
