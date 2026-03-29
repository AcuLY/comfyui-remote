import { fail, ok } from "@/lib/api-response";
import { getProjectAgentContext } from "@/server/repositories/project-repository";
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
    const data = await getProjectAgentContext(normalizedProjectId);
    return ok(data);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
