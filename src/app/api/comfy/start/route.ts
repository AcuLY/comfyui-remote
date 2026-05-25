/**
 * POST /api/comfy/start
 *
 * Start the ComfyUI process. Protected by auth middleware.
 */

import { fail, ok } from "@/lib/api-response";
import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export async function POST() {
  try {
    const manager = getComfyProcessManager();
    const result = await manager.start();

    if (!result.ok) {
      return fail(result.message, 400);
    }

    return ok({ message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}
