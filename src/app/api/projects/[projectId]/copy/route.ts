import { fail, ok } from "@/lib/api-response";
import { copyProject, mapProjectError } from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const data = await copyProject(projectId);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
