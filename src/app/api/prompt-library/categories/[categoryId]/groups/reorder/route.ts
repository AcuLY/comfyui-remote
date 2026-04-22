import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { reorderPresetGroups } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  await context.params;

  try {
    const body = await request.json();
    const { ids } = body;
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderPresetGroups(ids);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
