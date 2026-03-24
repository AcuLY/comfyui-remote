import { fail, ok } from "@/lib/api-response";
import { enqueueJobPositionRun, mapJobError } from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string; jobPositionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobId, jobPositionId } = await context.params;

  try {
    const data = await enqueueJobPositionRun(jobId, jobPositionId);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
