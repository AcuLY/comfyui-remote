import { fail, ok } from "@/lib/api-response";
import { completeGenerationTaskWorkerTarget, mapTrainingWorkerTaskError } from "@/server/worker/training/task-api";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { taskId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await completeGenerationTaskWorkerTarget(taskId, payload);
    if (!data) {
      return fail("Training generation task not found", 404, { taskId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
