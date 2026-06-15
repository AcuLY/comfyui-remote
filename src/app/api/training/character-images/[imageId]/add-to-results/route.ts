import { fail, ok } from "@/lib/api-response";
import { addManagedTrainingReferenceImageToResults } from "@/server/services/training/project-service";
import {
  getLegacyTrainingReferenceImage,
  mapLegacyTrainingReferenceImageError,
  registerLegacyTrainingReferenceImageAsResult,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { imageId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const managedResult = await addManagedTrainingReferenceImageToResults(imageId, {
      reviewStatus: typeof payload.reviewStatus === "string" ? payload.reviewStatus : undefined,
      captionDraft: typeof payload.captionDraft === "string" ? payload.captionDraft : null,
    });
    if (managedResult) {
      return ok(managedResult, { status: 201 });
    }
    const sourceImage = await getLegacyTrainingReferenceImage(imageId);

    if (!sourceImage) {
      return fail("Training reference image not found", 404);
    }

    const data = await registerLegacyTrainingReferenceImageAsResult({
      jobId: sourceImage.jobId,
      sourceImageId: imageId,
      reviewStatus: typeof payload.reviewStatus === "string" ? payload.reviewStatus as never : undefined,
      captionDraft: typeof payload.captionDraft === "string" ? payload.captionDraft : null,
    });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapLegacyTrainingReferenceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
