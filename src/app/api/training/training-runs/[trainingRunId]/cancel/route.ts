import { fail, failFromError, ok } from "@/lib/api-response";
import {
  cancelTrainingRun,
  mapTrainingRunMutationError,
} from "@/server/services/training/project-actions-service";
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
    const data = await cancelTrainingRun(trainingRunId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
