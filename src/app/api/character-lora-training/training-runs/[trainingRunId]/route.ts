import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraTrainingRunStatus,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

type TrainingRunRouteContext = {
  params: Promise<{ trainingRunId: string }>;
};

export async function GET(_request: Request, context: TrainingRunRouteContext) {
  const { trainingRunId } = await context.params;

  try {
    const data = await getCharacterLoraTrainingRunStatus(trainingRunId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
