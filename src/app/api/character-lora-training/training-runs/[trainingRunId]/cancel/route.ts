import { fail, ok } from "@/lib/api-response";
import {
  cancelTrainingRun,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

type TrainingRunCancelRouteContext = {
  params: Promise<{ trainingRunId: string }>;
};

export async function POST(request: Request, context: TrainingRunCancelRouteContext) {
  const { trainingRunId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await cancelTrainingRun(trainingRunId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
