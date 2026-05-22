import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraTrainingRuns,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

type JobTrainingRunsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobTrainingRunsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraTrainingRuns(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
