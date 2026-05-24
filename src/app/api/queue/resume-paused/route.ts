import { fail, ok } from "@/lib/api-response";
import { resumeAllRuns } from "@/lib/actions/run";

export async function POST() {
  try {
    const result = await resumeAllRuns();

    if (!result.ok) {
      return fail(result.error ?? "Failed to resume paused runs", 500, { count: result.count });
    }

    return ok({ resumedCount: result.count });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to resume paused runs", 500);
  }
}
