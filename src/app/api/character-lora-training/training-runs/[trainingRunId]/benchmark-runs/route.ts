import { fail, ok } from "@/lib/api-response";
import {
  enqueueCharacterLoraBenchmarkRun,
  listCharacterLoraBenchmarkRunsForTrainingRun,
  mapCharacterLoraBenchmarkPromotionError,
} from "@/server/services/character-lora-training/benchmark-promotion-service";

export const dynamic = "force-dynamic";

type TrainingRunBenchmarkRunsRouteContext = {
  params: Promise<{ trainingRunId: string }>;
};

export async function GET(_request: Request, context: TrainingRunBenchmarkRunsRouteContext) {
  const { trainingRunId } = await context.params;

  try {
    const data = await listCharacterLoraBenchmarkRunsForTrainingRun(trainingRunId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request, context: TrainingRunBenchmarkRunsRouteContext) {
  const { trainingRunId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await enqueueCharacterLoraBenchmarkRun(trainingRunId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
