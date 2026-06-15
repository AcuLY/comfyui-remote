import { fail, ok } from "@/lib/api-response";
import {
  leaseNextLegacyTrainingWorkerTask,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const data = await leaseNextLegacyTrainingWorkerTask({
      workerType: searchParams.get("workerType"),
      leaseOwner: searchParams.get("leaseOwner") ?? undefined,
      leaseDurationSeconds: searchParams.get("leaseDurationSeconds")
        ? Number(searchParams.get("leaseDurationSeconds"))
        : undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapLegacyTrainingGenerationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
