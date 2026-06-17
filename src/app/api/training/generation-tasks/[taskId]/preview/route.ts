import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingGenerationTaskDraftError,
  previewTrainingGenerationTask,
} from "@/server/services/training/generation-task-draft-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    const data = await previewTrainingGenerationTask(taskId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationTaskDraftError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
