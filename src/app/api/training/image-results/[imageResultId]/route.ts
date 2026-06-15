import { fail, ok } from "@/lib/api-response";
import {
  deleteManagedTrainingImageResult,
  mapTrainingProjectError,
  mapTrainingGenerationRunMutationError,
  updateTrainingImageResult,
} from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imageResultId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};

  try {
    const { imageResultId } = await params;
    const data = await updateTrainingImageResult(imageResultId, {
      reviewStatus: typeof payload.reviewStatus === "string" ? String(payload.reviewStatus) : undefined,
      captionDraft: typeof payload.captionDraft === "string" ? payload.captionDraft : null,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imageResultId: string }> },
) {
  try {
    const { imageResultId } = await params;
    const data = await deleteManagedTrainingImageResult(imageResultId);
    if (!data) {
      return fail("Training image result not found", 404, { imageResultId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
