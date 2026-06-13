import { fail, ok } from "@/lib/api-response";
import { updateManagedTrainingImageResult } from "@/server/services/training/project-service";
import {
  mapCharacterLoraPhase3Error,
  updateCharacterLoraImageCaption,
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

  try {
    const { imageResultId } = await params;
    const managed = await updateManagedTrainingImageResult(imageResultId, {
      captionDraft: typeof body === "object" && body && typeof (body as Record<string, unknown>).captionDraft === "string"
        ? (body as Record<string, string>).captionDraft
        : null,
    });
    if (managed) {
      return ok(managed);
    }
    const data = await updateCharacterLoraImageCaption(imageResultId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
