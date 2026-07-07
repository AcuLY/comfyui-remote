import { fail, failFromError, ok } from "@/lib/api-response";
import {
  deleteTrainingGenerationTask,
  getTrainingGenerationTask,
  isTrainingGenerationTaskDraftOrigin,
  mapTrainingGenerationTaskError,
  updateTrainingGenerationTask,
} from "@/server/services/training/generation-task-draft-service";
import { getTrainingRun, mapTrainingReadError } from "@/server/services/training/read-service";
import { hideTrainingRuns, mapTrainingRunVisibilityError } from "@/server/services/training/run-visibility-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;

  const draft = await getTrainingGenerationTask(taskId).catch(() => null);
  if (draft) {
    return ok(draft);
  }
  if (await isTrainingGenerationTaskDraftOrigin(taskId)) {
    return fail("Training generation task draft not found", 404, { taskId });
  }

  try {
    const data = await getTrainingRun(taskId, "generation");
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(
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
    const data = await updateTrainingGenerationTask(taskId, {
      generationKind: typeof payload.generationKind === "string" ? payload.generationKind : null,
      paramsJson: Object.prototype.hasOwnProperty.call(payload, "paramsJson") ? payload.paramsJson : undefined,
      supplementalPrompt: typeof payload.supplementalPrompt === "string" ? payload.supplementalPrompt : null,
      taskType: typeof payload.taskType === "string" ? payload.taskType : null,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;

  const deletedDraft = await deleteTrainingGenerationTask(taskId).catch((error) => {
    const mapped = mapTrainingGenerationTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  });
  if (deletedDraft instanceof Response) {
    return deletedDraft;
  }
  if (deletedDraft) {
    return ok(deletedDraft);
  }

  try {
    await getTrainingRun(taskId, "generation");
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }

  try {
    const data = await hideTrainingRuns([taskId]);
    return ok({ id: taskId, ...data });
  } catch (error) {
    const mapped = mapTrainingRunVisibilityError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
