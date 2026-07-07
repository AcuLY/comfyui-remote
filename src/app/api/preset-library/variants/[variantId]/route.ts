import { NextRequest } from "next/server";
import { failFromError, ok } from "@/lib/api-response";
import { updatePresetVariant, deletePresetVariant, type PresetVariantInput } from "@/lib/actions/preset-variant-crud";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ variantId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { variantId } = await context.params;

  try {
    const body = await readJsonBody(request);
    const result = await updatePresetVariant(variantId, body as Partial<PresetVariantInput>);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { variantId } = await context.params;

  try {
    await deletePresetVariant(variantId);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
