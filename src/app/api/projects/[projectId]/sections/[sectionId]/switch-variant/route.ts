import { fail, ok } from "@/lib/api-response";
import { switchBindingVariant } from "@/lib/actions";
import { assertSectionBelongsToProject, mapPromptBlockError } from "@/server/services/prompt-block-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const bindingId = body?.bindingId;
  const newVariantId = body?.newVariantId;

  if (!bindingId || typeof bindingId !== "string") {
    return fail("bindingId is required", 400);
  }
  if (!newVariantId || typeof newVariantId !== "string") {
    return fail("newVariantId is required", 400);
  }

  try {
    await assertSectionBelongsToProject(projectId, sectionId);
    const result = await switchBindingVariant(sectionId, bindingId, newVariantId);
    if (!result) {
      return fail("Binding or variant not found", 404);
    }
    return ok(result);
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    if (mapped.status !== 500) return fail(mapped.message, mapped.status, mapped.details);
    return fail(error instanceof Error ? error.message : "Failed to switch variant", 500);
  }
}
