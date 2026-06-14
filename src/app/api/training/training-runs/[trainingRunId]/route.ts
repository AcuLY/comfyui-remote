import { fail, ok } from "@/lib/api-response";
import { getTrainingRun, mapTrainingReadError } from "@/server/services/training/read-service";
import { hideTrainingRuns, mapTrainingRunVisibilityError } from "@/server/services/training/run-visibility-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  try {
    const { trainingRunId } = await params;
    const data = await getTrainingRun(trainingRunId, "training");
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  const { trainingRunId } = await params;

  try {
    await getTrainingRun(trainingRunId, "training");
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }

  try {
    const data = await hideTrainingRuns([trainingRunId]);
    return ok({ id: trainingRunId, ...data });
  } catch (error) {
    const mapped = mapTrainingRunVisibilityError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
