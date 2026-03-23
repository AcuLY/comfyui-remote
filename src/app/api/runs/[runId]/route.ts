import { fail, ok } from "@/lib/api-response";
import { getRunReviewGroup, mapReviewError } from "@/server/services/review-service";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;

  try {
    const data = await getRunReviewGroup(runId);
    return ok(data);
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
