import { fail, ok } from "@/lib/api-response";
import {
  enqueueCharacterLoraTrainingRun,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

type TrainingRunsRouteContext = {
  params: Promise<{ revisionId: string }>;
};

export async function POST(request: Request, context: TrainingRunsRouteContext) {
  const { revisionId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await enqueueCharacterLoraTrainingRun(revisionId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraTrainingError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
