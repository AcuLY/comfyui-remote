import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updateCategorySortOrders } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

const dimensionMap: Record<string, string> = {
  preset: "positivePromptOrder",
  group: "negativePromptOrder",
  variant: "lora1Order",
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  await context.params;

  try {
    const body = await request.json();
    const { dimension, ids } = body;

    const mappedDimension = dimensionMap[dimension];
    if (!mappedDimension) {
      return fail('dimension must be "preset", "group", or "variant"', 400);
    }
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }

    await updateCategorySortOrders(
      mappedDimension as "positivePromptOrder" | "negativePromptOrder" | "lora1Order" | "lora2Order",
      ids,
    );
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
