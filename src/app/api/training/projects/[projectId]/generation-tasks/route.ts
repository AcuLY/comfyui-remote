import { fail, ok } from "@/lib/api-response";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  createManagedGenerationTaskDraft,
  mapTrainingGenerationTaskDraftError,
} from "@/server/services/training/generation-task-draft-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await listTrainingRuns({ kind: "generation", projectId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await createManagedGenerationTaskDraft(projectId, {
      sectionId: typeof payload.sectionId === "string" ? payload.sectionId : null,
      supplementalPrompt: typeof payload.supplementalPrompt === "string" ? payload.supplementalPrompt : null,
      taskType: typeof payload.taskType === "string" ? payload.taskType : null,
    });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationTaskDraftError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
