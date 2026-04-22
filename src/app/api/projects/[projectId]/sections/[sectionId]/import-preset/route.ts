import { fail, ok } from "@/lib/api-response";
import { importPresetToSection } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sectionId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
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
    const result = await importPresetToSection(sectionId, presetId, variantId, groupBindingId);
    if (!result) {
      return fail("Preset not found", 404);
    }
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to import preset", 500);
  }
}
