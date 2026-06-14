import { fail, ok } from "@/lib/api-response";
import {
  cascadeDeleteTrainingSceneDescriptionPreset,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { presetId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await cascadeDeleteTrainingSceneDescriptionPreset(presetId, {
      confirm: payload.confirm === true,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
