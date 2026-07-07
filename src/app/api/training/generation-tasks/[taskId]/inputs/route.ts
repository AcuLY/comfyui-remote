import { fail, failFromError, ok } from "@/lib/api-response";
import {
  addTrainingGenerationTaskInput,
  mapTrainingGenerationTaskDraftError,
} from "@/server/services/training/generation-task-draft-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { taskId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await addTrainingGenerationTaskInput(taskId, {
      referenceId: typeof payload.referenceId === "string" ? payload.referenceId : null,
    });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationTaskDraftError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
