import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updatePresetCategory, deletePresetCategory } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    const body = await request.json();
    const result = await updatePresetCategory(categoryId, body);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    await deletePresetCategory(categoryId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
