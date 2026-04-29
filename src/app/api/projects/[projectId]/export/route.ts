import { fail, ok } from "@/lib/api-response";
import { exportProjectImages } from "@/server/services/project-export-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const result = await exportProjectImages(projectId);

    if (!result.success) {
      return fail(result.message, result.message === "Project not found" ? 404 : 409);
    }

    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to export project images", 500);
  }
}
