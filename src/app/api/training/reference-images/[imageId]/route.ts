import { fail, failFromError, ok } from "@/lib/api-response";
import {
  deleteTrainingReferenceImage,
  mapTrainingReferenceImageMutationError,
  updateTrainingReferenceImage,
} from "@/server/services/training/project-actions-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};

  try {
    const { imageId } = await params;
    const data = await updateTrainingReferenceImage(imageId, payload);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReferenceImageMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params;
    const data = await deleteTrainingReferenceImage(imageId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReferenceImageMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
