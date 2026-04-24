import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { reorderGroupMembers } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const body = await request.json();
    const { ids } = body;
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderGroupMembers(groupId, ids);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
