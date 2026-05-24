import { fail, ok } from "@/lib/api-response";
import { pauseAllRuns } from "@/lib/actions/run";

const QUEUE_API_PAUSE_SOURCE = "api-pause-active";

export async function POST() {
  try {
    const result = await pauseAllRuns({ source: QUEUE_API_PAUSE_SOURCE });

    if (!result.ok) {
      return fail(result.error ?? "Failed to pause active runs", 500, {
        count: result.count,
        runIds: result.runIds,
        batchId: result.batchId,
      });
    }

    return ok({
      pausedCount: result.count,
      runIds: result.runIds,
      batchId: result.batchId,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to pause active runs", 500);
  }
}
