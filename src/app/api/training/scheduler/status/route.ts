import { fail, ok } from "@/lib/api-response";
import { getTrainingSchedulerStatus, mapTrainingReadError } from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTrainingSchedulerStatus();
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
