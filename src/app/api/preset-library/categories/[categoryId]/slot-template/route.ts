import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updateCategorySlotTemplate } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    const body = await request.json();
    await updateCategorySlotTemplate(categoryId, body.slotTemplate);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
