import { fail, ok } from "@/lib/api-response";
import { cancelProjectRuns } from "@/lib/actions";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  try {
    const count = await cancelProjectRuns(projectId);
    return ok({ cancelledCount: count });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}
