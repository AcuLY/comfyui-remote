import { fail, ok } from "@/lib/api-response";
import { deleteProject } from "@/lib/actions";
import { getProjectDetail } from "@/server/repositories/project-repository";
import { mapProjectError, updateProject } from "@/server/services/project-service";

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
    const data = await getProjectDetail(normalizedProjectId);
    return ok(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return fail("Project not found", 404);
    }

    return fail(
      "Failed to load project detail",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await updateProject(projectId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    await deleteProject(projectId);
    return ok({ success: true });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to delete project",
      500,
    );
  }
}
