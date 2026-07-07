import { fail, failFromError, ok } from "@/lib/api-response";
import { reorderSections } from "@/lib/actions/section";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await readJsonBody(request) as Record<string, unknown> | null;
  } catch (error) {
    return failFromError(error);
  }

  const sectionIds = body?.sectionIds;
  if (!Array.isArray(sectionIds) || !sectionIds.every((id) => typeof id === "string")) {
    return fail("sectionIds must be a string array", 400);
  }

  try {
    const result = await reorderSections(projectId, sectionIds as string[]);
    if (!result.ok) {
      return fail(result.message, 409);
    }
    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to reorder sections", 500);
  }
}
