import { fail, ok } from "@/lib/api-response";
import {
  deleteTrainingSceneDescriptionCategory,
  mapTrainingPresetError,
  updateTrainingSceneDescriptionCategory,
} from "@/server/services/training/preset-service";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { categoryId } = await context.params;
    const data = await updateTrainingSceneDescriptionCategory(categoryId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { categoryId } = await context.params;
    const data = await deleteTrainingSceneDescriptionCategory(categoryId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
