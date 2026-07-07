import { fail, failFromError, ok } from "@/lib/api-response";
import {
  cascadeDeleteTrainingSceneDescriptionPreset,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { presetId } = await params;
    const data = await cascadeDeleteTrainingSceneDescriptionPreset(presetId, {
      confirm: body.confirm === true,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
