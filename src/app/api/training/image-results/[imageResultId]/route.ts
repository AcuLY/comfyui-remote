import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraPhase3Error,
  reviewCharacterLoraImages,
  updateCharacterLoraImageCaption,
} from "@/server/services/character-lora-training/phase3-service";

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
    const operations: unknown[] = [];

    if (typeof payload.captionDraft === "string") {
      operations.push(updateCharacterLoraImageCaption(imageResultId, { captionDraft: payload.captionDraft }));
    }

    if (typeof payload.reviewStatus === "string") {
      operations.push(reviewCharacterLoraImages({
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
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
