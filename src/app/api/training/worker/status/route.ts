import { fail, ok } from "@/lib/api-response";
import {
  getTrainingWorkerQueueStatus,
  mapTrainingWorkerTaskError,
} from "@/server/worker/training/task-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTrainingWorkerQueueStatus();
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
