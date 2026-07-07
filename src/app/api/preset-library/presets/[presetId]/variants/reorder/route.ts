import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { reorderPresetVariants } from "@/lib/actions/preset-variant-crud";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const body = await readJsonBody(request) as { ids?: unknown };
    const { ids } = body;
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderPresetVariants(presetId, ids);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
