import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { updatePresetCategory, deletePresetCategory } from "@/lib/actions/preset-category";
import { getPresetCategoriesWithPresets } from "@/lib/server-data";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    const categories = await getPresetCategoriesWithPresets();
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return fail("Category not found", 404);
    return ok(category);
  } catch (error) {
    return failFromError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    const body = await readJsonBody(request);
    const result = await updatePresetCategory(categoryId, body);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    await deletePresetCategory(categoryId);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
