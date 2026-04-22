import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPresetVariant, resolveVariantContent } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const body = await request.json();

    if (body.action === "resolve") {
      const variantId = body.variantId ?? presetId;
      const result = await resolveVariantContent(variantId);
      return ok(result);
    }

    if (body.action === "create") {
      const result = await createPresetVariant(body);
      return ok(result);
    }

    return fail('action must be "create" or "resolve"', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
