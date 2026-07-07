import { fail, failFromError, ok } from "@/lib/api-response";
import {
  cancelTrainingGenerationRun,
  mapTrainingGenerationRunMutationError,
} from "@/server/services/training/project-actions-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { runId } = await params;
    const data = await cancelTrainingGenerationRun(runId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
