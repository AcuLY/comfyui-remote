import { fail, ok } from "@/lib/api-response";
import { archiveProject } from "@/server/services/project-archive-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const result = await archiveProject(projectId);

    if (!result.success) {
      const status = result.message.includes("not found") ? 404 : 409;
      return fail(result.message, status);
    }

    return ok(result);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to archive project",
      500,
    );
  }
}
