import { fail, ok } from "@/lib/api-response";
import {
  getLegacyTrainingWorkerQueueStatus,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLegacyTrainingWorkerQueueStatus();
    return ok(data);
  } catch (error) {
    const mapped = mapLegacyTrainingGenerationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
