import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { updatePreset, deletePreset, type PresetInput } from "@/lib/actions/preset-variant-crud";
import { getPresetById } from "@/server/services/preset-query-service";
import { readJsonBody } from "@/server/http/request-json";

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
    return failFromError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const body = await readJsonBody(request) as Partial<PresetInput>;
    const result = await updatePreset(presetId, body);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    await deletePreset(presetId);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
