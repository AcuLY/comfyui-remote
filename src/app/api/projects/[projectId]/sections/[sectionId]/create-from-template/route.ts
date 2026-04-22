import { fail, ok } from "@/lib/api-response";
import { createSectionFromTemplate } from "@/lib/actions";

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

  try {
    const id = await createSectionFromTemplate({
      projectId,
      name: body?.name as string | undefined,
      aspectRatio: body?.aspectRatio as string | undefined,
      shortSidePx: body?.shortSidePx as number | undefined,
      extraImports: (body?.extraImports ?? []) as Array<{
        presetId: string;
        variantId: string;
        groupBindingId?: string;
      }>,
      bindingVariantOverrides: (body?.bindingVariantOverrides ?? []) as Array<{
        presetId: string;
        variantId: string;
      }>,
    });
    return ok({ id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to create section from template", 500);
  }
}
