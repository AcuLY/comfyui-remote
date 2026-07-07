import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { updatePresetGroup, deletePresetGroup, type PresetGroupInput } from "@/lib/actions/preset-group";
import { getPresetGroup } from "@/lib/server-data";
import { readJsonBody } from "@/server/http/request-json";

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
    return failFromError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const body = await readJsonBody(request) as Partial<PresetGroupInput>;
    const result = await updatePresetGroup(groupId, body);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    await deletePresetGroup(groupId);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
