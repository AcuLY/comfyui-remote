import { fail, ok } from "@/lib/api-response";
import { getTrainingRun, mapTrainingReadError } from "@/server/services/training/read-service";
import { hideTrainingRuns, mapTrainingRunVisibilityError } from "@/server/services/training/run-visibility-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    const data = await getTrainingRun(taskId, "generation");
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;

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
