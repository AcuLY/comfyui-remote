import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updatePresetVariant, deletePresetVariant } from "@/lib/actions";
import type { PresetVariantInput } from "@/lib/actions/preset-variant-crud";

type RouteContext = {
  params: Promise<{ variantId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { variantId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const result = await updatePresetVariant(variantId, body as Partial<PresetVariantInput>);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { variantId } = await context.params;

  try {
    await deletePresetVariant(variantId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
