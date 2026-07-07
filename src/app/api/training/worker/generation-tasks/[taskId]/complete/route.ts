import { fail, failFromError, ok } from "@/lib/api-response";
import { completeGenerationTaskWorkerTarget, mapTrainingWorkerTaskError } from "@/server/worker/training/task-api";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { taskId } = await params;
    const data = await completeGenerationTaskWorkerTarget(taskId, body);
    if (!data) {
      return fail("Training generation task not found", 404, { taskId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
