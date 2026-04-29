import { fail, ok } from "@/lib/api-response";
import { clearRuns } from "@/lib/actions";

export async function POST() {
  const result = await clearRuns();

  if (!result.ok) {
    return fail(result.error ?? "Failed to clear runs", 500, { count: result.count });
  }

  return ok({ clearedCount: result.count });
}
