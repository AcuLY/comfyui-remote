import { fail, failFromError, ok } from "@/lib/api-response";
import {
  getTrainingSceneDescriptionPreset,
  deleteTrainingSceneDescriptionPreset,
  mapTrainingPresetError,
  updateTrainingSceneDescriptionPreset,
} from "@/server/services/training/preset-service";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const data = await getTrainingSceneDescriptionPreset(presetId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { presetId } = await context.params;

  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await updateTrainingSceneDescriptionPreset(presetId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const data = await deleteTrainingSceneDescriptionPreset(presetId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
