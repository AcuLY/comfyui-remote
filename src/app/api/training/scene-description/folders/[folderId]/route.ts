import { fail, failFromError, ok } from "@/lib/api-response";
import {
  deleteTrainingSceneDescriptionFolder,
  mapTrainingPresetError,
  updateTrainingSceneDescriptionFolder,
} from "@/server/services/training/preset-service";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { folderId } = await context.params;
    const data = await updateTrainingSceneDescriptionFolder(folderId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const data = await deleteTrainingSceneDescriptionFolder(folderId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
