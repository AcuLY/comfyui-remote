import { fail, ok } from "@/lib/api-response";
import {
  deleteManagedGenerationTaskInput,
  mapTrainingGenerationTaskDraftError,
} from "@/server/services/training/generation-task-draft-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inputId: string }> },
) {
  try {
    const { inputId } = await params;
    const data = await deleteManagedGenerationTaskInput(inputId);
    if (!data) {
      return fail("Training generation task input not found", 404, { inputId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingGenerationTaskDraftError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
