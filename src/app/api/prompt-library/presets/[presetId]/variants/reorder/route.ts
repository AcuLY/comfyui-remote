import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { reorderPresetVariants } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const body = await request.json();
    const { ids } = body;
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderPresetVariants(presetId, ids);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
