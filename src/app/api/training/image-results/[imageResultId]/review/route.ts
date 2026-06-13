import { fail, ok } from "@/lib/api-response";
import { updateManagedTrainingImageResult } from "@/server/services/training/project-service";
import {
  mapCharacterLoraPhase3Error,
  reviewCharacterLoraImages,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function POST(
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
    });
    if (managed) {
      return ok(managed);
    }
    const data = await reviewCharacterLoraImages({
      images: [
        {
          imageId: imageResultId,
          reviewStatus: payload.reviewStatus,
        },
      ],
    });
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
