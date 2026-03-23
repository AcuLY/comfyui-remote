import { fail, ok } from "@/lib/api-response";
import { copyJob, mapJobError } from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await copyJob(jobId);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
