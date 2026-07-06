import { fail, failFromError, ok } from "@/lib/api-response";
import { importPresetToSection, removeImportedPresetFromSection } from "@/lib/actions";
import { readJsonBody } from "@/server/http/request-json";
import { assertSectionBelongsToProject, mapPromptBlockError } from "@/server/services/prompt-block-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await readJsonBody(request) as Record<string, unknown> | null;
  } catch (error) {
    return failFromError(error);
  }

  const presetId = body?.presetId;
  const variantId = body?.variantId;
  const groupBindingId = body?.groupBindingId as string | undefined;

  if (!presetId || typeof presetId !== "string") {
    return fail("presetId is required", 400);
  }
  if (!variantId || typeof variantId !== "string") {
    return fail("variantId is required", 400);
  }

  try {
    await assertSectionBelongsToProject(projectId, sectionId);
    const result = await importPresetToSection(sectionId, presetId, variantId, groupBindingId);
    if (!result) {
      return fail("Preset not found", 404);
    }
    return ok(result);
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    if (mapped.status !== 500) return fail(mapped.message, mapped.status, mapped.details);
    return fail(error instanceof Error ? error.message : "Failed to import preset", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await readJsonBody(request) as Record<string, unknown> | null;
  } catch (error) {
    return failFromError(error);
  }

  const bindingId = body?.bindingId;
  if (!bindingId || typeof bindingId !== "string") {
    return fail("bindingId is required", 400);
  }

  try {
    await assertSectionBelongsToProject(projectId, sectionId);
    const result = await removeImportedPresetFromSection(sectionId, bindingId);
    if (!result) {
      return fail("Imported preset binding not found", 404);
    }
    return ok(result);
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    if (mapped.status !== 500) return fail(mapped.message, mapped.status, mapped.details);
    return fail(error instanceof Error ? error.message : "Failed to remove imported preset", 500);
  }
}
