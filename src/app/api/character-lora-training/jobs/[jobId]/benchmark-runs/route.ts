import { fail, ok } from "@/lib/api-response";
import {
  enqueueCharacterLoraBenchmarkRun,
  listCharacterLoraBenchmarkRuns,
  mapCharacterLoraBenchmarkPromotionError,
} from "@/server/services/character-lora-training/benchmark-promotion-service";
import { listCharacterLoraTrainingRuns } from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

type JobBenchmarkRunsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobBenchmarkRunsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraBenchmarkRuns(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request, context: JobBenchmarkRunsRouteContext) {
  const { jobId } = await context.params;
  let body: Record<string, unknown> = {};

  try {
    const rawBody = await request.text();
    const parsed = rawBody.trim() ? JSON.parse(rawBody) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("Request body must be a JSON object", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const trainingRuns = await listCharacterLoraTrainingRuns(jobId);
    const requestedTrainingRunId = readOptionalString(body.trainingRunId);
    const selectedTrainingRun = requestedTrainingRunId
      ? trainingRuns.find((run) => run.id === requestedTrainingRunId)
      : trainingRuns.find((run) => run.status === "done" && run.finalSafetensorsArtifactId);

    if (requestedTrainingRunId && !selectedTrainingRun) {
      return fail("Training run not found for job", 404, { jobId, trainingRunId: requestedTrainingRunId });
    }
    if (!selectedTrainingRun) {
      return fail("Job has no completed training run with a final safetensors artifact", 409, { jobId });
    }

    const benchmarkInput = { ...body };
    delete benchmarkInput.trainingRunId;
    const data = await enqueueCharacterLoraBenchmarkRun(selectedTrainingRun.id, benchmarkInput);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraBenchmarkPromotionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
