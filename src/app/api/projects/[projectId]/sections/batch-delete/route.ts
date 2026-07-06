import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import { deleteProjectSections, mapProjectError } from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const result = await deleteProjectSections(projectId, body);
    return ok(result);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
