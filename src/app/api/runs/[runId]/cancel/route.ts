import { fail, ok } from "@/lib/api-response";
import { cancelRun } from "@/lib/actions";

type RouteContext = { params: Promise<{ runId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  try {
    const result = await cancelRun(runId);
    if (!result.ok) return fail(result.error ?? "Failed to cancel run", 400);
    return ok({ success: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}
