import { fail, ok } from "@/lib/api-response";
import { cancelManagedTrainingRun, mapTrainingProjectError } from "@/server/services/training/project-service";
import {
  cancelTrainingRun,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { trainingRunId } = await params;
    const managed = await cancelManagedTrainingRun(trainingRunId);
    if (managed) {
      return ok(managed);
    }
    const data = await cancelTrainingRun(trainingRunId, body);
    return ok(data);
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapCharacterLoraTrainingError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
