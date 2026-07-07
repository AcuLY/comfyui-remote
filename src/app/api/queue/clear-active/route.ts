import { fail, ok } from "@/lib/api-response";
import { clearActiveRuns } from "@/lib/actions/run-lifecycle";
import {
  createQueueControlProgressStream,
  wantsQueueControlStream,
} from "@/server/services/queue-control-stream";

export async function POST(request: Request) {
  if (wantsQueueControlStream(request)) {
    return createQueueControlProgressStream((onProgress) =>
      clearActiveRuns({ onProgress }),
    );
  }

  try {
    const result = await clearActiveRuns();

    if (!result.ok) {
      return fail(result.error ?? "Failed to clear active runs", 500, { count: result.count });
    }

    return ok({ cancelledCount: result.count });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to clear active runs", 500);
  }
}
