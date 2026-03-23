import { fail, ok } from "@/lib/api-response";
import { mapJobError, updateJobPosition } from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string; jobPositionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { jobId, jobPositionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await updateJobPosition(jobId, jobPositionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
