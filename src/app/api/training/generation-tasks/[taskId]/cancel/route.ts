import { fail, ok } from "@/lib/api-response";
import { cancelManagedGenerationRun, mapTrainingProjectError } from "@/server/services/training/project-service";
import {
  cancelCharacterLoraGenerationRun,
} from "@/server/services/character-lora-training/generation-run-service";
import {
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { taskId } = await params;
    const managed = await cancelManagedGenerationRun(taskId);
    if (managed) {
      return ok(managed);
    }
    const data = await cancelCharacterLoraGenerationRun(taskId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
      return fail(mapped.message, mapped.status, mapped.details);
    }
    const phase3Mapped = mapCharacterLoraPhase3Error(error);
    return fail(phase3Mapped.message, phase3Mapped.status, phase3Mapped.details);
  }
}
