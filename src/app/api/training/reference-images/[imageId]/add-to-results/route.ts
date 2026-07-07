import { fail, failFromError, ok } from "@/lib/api-response";
import {
  addTrainingReferenceImageToResults,
  mapTrainingReferenceImageMutationError,
} from "@/server/services/training/project-actions-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { imageId } = await params;
    const data = await addTrainingReferenceImageToResults(imageId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingReferenceImageMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
