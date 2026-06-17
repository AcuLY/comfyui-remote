import { fail, ok } from "@/lib/api-response";
import {
  addTrainingReferenceImageToResults,
  mapTrainingReferenceImageMutationError,
} from "@/server/services/training/project-actions-service";

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
    const data = await addTrainingReferenceImageToResults(imageId, payload);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingReferenceImageMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
