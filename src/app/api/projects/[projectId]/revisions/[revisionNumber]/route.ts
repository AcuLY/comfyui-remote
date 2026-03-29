import { fail, ok } from "@/lib/api-response";
import { getProjectRevision } from "@/server/services/revision-service";
import { mapProjectError } from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string; revisionNumber: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId, revisionNumber } = await context.params;
  const normalizedProjectId = projectId.trim();
  const parsedRevisionNumber = parseInt(revisionNumber, 10);

  if (!normalizedProjectId) {
    return fail("projectId is required", 400);
  }

  if (isNaN(parsedRevisionNumber) || parsedRevisionNumber < 1) {
    return fail("revisionNumber must be a positive integer", 400);
  }

  try {
    const revision = await getProjectRevision(normalizedProjectId, parsedRevisionNumber);

    if (!revision) {
      return fail("Revision not found", 404);
    }

    return ok(revision);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
