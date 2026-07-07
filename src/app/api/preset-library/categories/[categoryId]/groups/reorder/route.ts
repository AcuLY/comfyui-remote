import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { reorderPresetGroups } from "@/lib/actions/preset-group";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;

  try {
    const body = await readJsonBody(request) as { ids?: unknown };
    const { ids } = body;
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderPresetGroups(categoryId, ids);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
