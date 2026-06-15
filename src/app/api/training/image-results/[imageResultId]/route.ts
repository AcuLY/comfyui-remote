import { fail, ok } from "@/lib/api-response";
import {
  deleteManagedTrainingImageResult,
  mapTrainingProjectError,
  updateManagedTrainingImageResult,
} from "@/server/services/training/project-service";
import {
  mapLegacyTrainingGenerationError,
  reviewLegacyTrainingImages,
  updateLegacyTrainingImageCaption,
} from "@/server/services/training/legacy-compat-service";

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
    const managed = await updateManagedTrainingImageResult(imageResultId, {
      reviewStatus: typeof payload.reviewStatus === "string" ? String(payload.reviewStatus) : undefined,
      captionDraft: typeof payload.captionDraft === "string" ? payload.captionDraft : null,
    });
    if (managed) {
      return ok(managed);
    }
    const operations: unknown[] = [];

    if (typeof payload.captionDraft === "string") {
      operations.push(updateLegacyTrainingImageCaption(imageResultId, { captionDraft: payload.captionDraft }));
    }

    if (typeof payload.reviewStatus === "string") {
      operations.push(reviewLegacyTrainingImages({
        images: [
          {
            imageId: imageResultId,
            reviewStatus: payload.reviewStatus,
          },
        ],
      }));
    }

    if (operations.length === 0) {
      return fail("At least one supported field is required", 400, {
        supportedFields: ["captionDraft", "reviewStatus"],
      });
    }

    const data = await Promise.all(operations);
    return ok(data.length === 1 ? data[0] : data);
  } catch (error) {
    const mapped = mapLegacyTrainingGenerationError(error);
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
