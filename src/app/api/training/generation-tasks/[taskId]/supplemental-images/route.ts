import { fail, ok } from "@/lib/api-response";
import {
  addManagedGenerationTaskSupplementalImage,
  mapTrainingGenerationTaskDraftError,
} from "@/server/services/training/generation-task-draft-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    const formData = await request.formData();
    const data = await addManagedGenerationTaskSupplementalImage(taskId, formData);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationTaskDraftError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
