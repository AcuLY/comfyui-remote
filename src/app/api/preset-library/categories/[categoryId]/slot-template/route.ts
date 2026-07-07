import { NextRequest } from "next/server";
import { failFromError, ok } from "@/lib/api-response";
import { updateCategorySlotTemplate } from "@/lib/actions/preset-category";
import { readJsonBody } from "@/server/http/request-json";

type CategorySlotTemplateInput = Array<{ categoryId: string; label?: string }>;

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    const body = await readJsonBody(request) as { slotTemplate: CategorySlotTemplateInput };
    await updateCategorySlotTemplate(categoryId, body.slotTemplate);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
