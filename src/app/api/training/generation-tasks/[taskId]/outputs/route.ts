import { fail, ok } from "@/lib/api-response";
import {
  listTrainingGenerationOutputs,
  mapTrainingReadError,
} from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    const data = await listTrainingGenerationOutputs(taskId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
