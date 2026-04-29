import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { updatePreset, deletePreset } from "@/lib/actions";
import { getPresetById } from "@/server/services/preset-query-service";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const preset = await getPresetById(presetId, includeInactive);
    if (!preset) return fail("Preset not found", 404);
    return ok(preset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const body = await request.json();
    const result = await updatePreset(presetId, body);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    await deletePreset(presetId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
