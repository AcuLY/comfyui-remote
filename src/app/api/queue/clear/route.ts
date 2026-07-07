import { fail, ok } from "@/lib/api-response";
import { clearRuns } from "@/lib/actions/run-lifecycle";

export async function POST() {
  try {
    const result = await clearRuns();

    if (!result.ok) {
      return fail(result.error ?? "Failed to clear runs", 500, { count: result.count });
    }

    return ok({ clearedCount: result.count });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to clear runs", 500);
  }
}
