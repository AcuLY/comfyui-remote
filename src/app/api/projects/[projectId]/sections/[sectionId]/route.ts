import { fail, ok } from "@/lib/api-response";
import { deleteSection } from "@/lib/actions";
import { mapProjectError, updateProjectSection } from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await updateProjectSection(projectId, sectionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { sectionId } = await context.params;

  try {
    await deleteSection(sectionId);
    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to delete section", 500);
  }
}
