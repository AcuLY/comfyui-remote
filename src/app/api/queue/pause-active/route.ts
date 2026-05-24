import { fail, ok } from "@/lib/api-response";
import { pauseAllRuns } from "@/lib/actions/run";

export async function POST() {
  try {
    const result = await pauseAllRuns();

    if (!result.ok) {
      return fail(result.error ?? "Failed to pause active runs", 500, { count: result.count });
    }

    return ok({ pausedCount: result.count });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to pause active runs", 500);
  }
}
