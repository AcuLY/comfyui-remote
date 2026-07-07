/**
 * GET /api/worker/status
 *
 * Returns current queue and ComfyUI connectivity stats.
 */

import { fail, ok } from "@/lib/api-response";
import { checkComfyUIReachability } from "@/server/services/comfyui-service";
import { getActiveComfyTarget } from "@/server/services/comfy-target";
import { getGenerationWorkerRunStatus } from "@/server/worker/repository";

export async function GET() {
  try {
    const target = getActiveComfyTarget();
    const [runStatus, comfyReachability] = await Promise.all([
      getGenerationWorkerRunStatus(),
      checkComfyUIReachability(),
    ]);

    return ok({
      comfyui: {
        reachable: comfyReachability.reachable,
        url: target.apiUrl,
        targetId: target.id,
        targetMode: target.mode,
      },
      queue: runStatus.queue,
      recentDone: runStatus.recentDone,
      recentFailed: runStatus.recentFailed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("Failed to load queue status", 500, message);
  }
}
