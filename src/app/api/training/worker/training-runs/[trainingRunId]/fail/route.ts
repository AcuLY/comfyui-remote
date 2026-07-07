import { fail, failFromError, ok } from "@/lib/api-response";
import { failTrainingRunWorkerTarget, mapTrainingWorkerTaskError } from "@/server/worker/training/task-api";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { trainingRunId } = await params;
    const data = await failTrainingRunWorkerTarget(trainingRunId, body);
    if (!data) {
      return fail("Training run not found", 404, { trainingRunId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
