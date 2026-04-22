import { fail, ok } from "@/lib/api-response";
import { reorderSections } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const sectionIds = body?.sectionIds;
  if (!Array.isArray(sectionIds) || !sectionIds.every((id) => typeof id === "string")) {
    return fail("sectionIds must be a string array", 400);
  }

  try {
    await reorderSections(projectId, sectionIds as string[]);
    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to reorder sections", 500);
  }
}
