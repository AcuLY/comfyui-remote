import { fail, ok } from "@/lib/api-response";
import { clearActiveRuns } from "@/lib/actions";

export async function POST() {
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
