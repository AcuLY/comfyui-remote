import { fail, ok } from "@/lib/api-response";
import { listJobRevisions } from "@/server/services/revision-service";
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
    const revisions = await listJobRevisions(normalizedJobId);
    return ok(revisions);
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
