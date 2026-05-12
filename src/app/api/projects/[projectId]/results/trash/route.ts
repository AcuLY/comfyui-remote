import { fail, ok } from "@/lib/api-response";
import { trashProjectImages } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    return fail("projectId is required", 400);
  }

  try {
    const data = await trashProjectImages(normalizedProjectId);
    return ok(data);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return fail("Project not found", 404);
    }

    return fail("Failed to trash project images", 500, String(error));
  }
}
