import { fail, ok } from "@/lib/api-response";
import { getJobRevision } from "@/server/services/revision-service";
import { mapJobError } from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string; revisionNumber: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId, revisionNumber } = await context.params;
  const normalizedJobId = jobId.trim();
  const parsedRevisionNumber = parseInt(revisionNumber, 10);

  if (!normalizedJobId) {
    return fail("jobId is required", 400);
  }

  if (isNaN(parsedRevisionNumber) || parsedRevisionNumber < 1) {
    return fail("revisionNumber must be a positive integer", 400);
  }

  try {
    const revision = await getJobRevision(normalizedJobId, parsedRevisionNumber);

    if (!revision) {
      return fail("Revision not found", 404);
    }

    return ok(revision);
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
