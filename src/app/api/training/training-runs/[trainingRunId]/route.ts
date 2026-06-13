import { fail, ok } from "@/lib/api-response";
import { getTrainingRun, mapTrainingReadError } from "@/server/services/training/read-service";

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
