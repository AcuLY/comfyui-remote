import { fail, ok } from "@/lib/api-response";
import { getJobAgentContext } from "@/server/repositories/job-repository";
import { mapJobError } from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const normalizedJobId = jobId.trim();

  if (!normalizedJobId) {
    return fail("jobId is required", 400);
  }

  try {
    const data = await getJobAgentContext(normalizedJobId);
    return ok(data);
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
