import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { updateCategorySortOrders } from "@/lib/actions";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

const dimensionMap: Record<string, string> = {
  preset: "positivePromptOrder",
  group: "negativePromptOrder",
  variant: "lora1Order",
  lora: "lora2Order",
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  await context.params;

  try {
    const body = await readJsonBody(request) as { dimension?: string; ids?: unknown };
    const { dimension, ids } = body;

    const mappedDimension = dimensionMap[dimension];
    if (!mappedDimension) {
      return fail('dimension must be "preset", "group", "variant", or "lora"', 400);
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
    return failFromError(error, "Unknown error", 400);
  }
}
