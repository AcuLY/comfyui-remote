/**
 * POST /api/comfy/restart
 *
 * Restart the ComfyUI process. Protected by auth middleware.
 * Also resets the max-restart counter so manual restart always works.
 */

import { fail, ok } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export async function POST() {
  try {
    const manager = getComfyProcessManager();
    manager.resetMaxRestarts();
    const result = await manager.restart();

    if (!result.ok) {
      return fail(result.message, 400);
    }

    return ok({ message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}
