import { fail, failFromError, ok } from "@/lib/api-response";
import {
  deleteTrainingImageResultRecord,
  mapTrainingGenerationOutputError,
  patchTrainingImageResultRecord,
} from "@/server/services/training/generation-output-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imageResultId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};

  try {
    const { imageResultId } = await params;
    const data = await patchTrainingImageResultRecord(imageResultId, {
      reviewStatus: typeof payload.reviewStatus === "string" ? String(payload.reviewStatus) : undefined,
      captionDraft: typeof payload.captionDraft === "string" ? payload.captionDraft : null,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationOutputError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imageResultId: string }> },
) {
  try {
    const { imageResultId } = await params;
    const data = await deleteTrainingImageResultRecord(imageResultId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationOutputError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
