import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updatePresetGroup, deletePresetGroup } from "@/lib/actions";
import { getPresetGroup } from "@/lib/server-data";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const group = await getPresetGroup(groupId);
    if (!group) return fail("Group not found", 404);
    return ok(group);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const body = await request.json();
    const result = await updatePresetGroup(groupId, body);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    await deletePresetGroup(groupId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
