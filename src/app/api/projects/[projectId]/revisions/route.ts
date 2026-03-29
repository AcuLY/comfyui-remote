import { fail, ok } from "@/lib/api-response";
import { listProjectRevisions } from "@/server/services/revision-service";
import { mapProjectError } from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    return fail("projectId is required", 400);
  }

  try {
    const revisions = await listProjectRevisions(normalizedProjectId);
    return ok(revisions);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
