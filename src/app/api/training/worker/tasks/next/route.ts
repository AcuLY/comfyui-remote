import { fail, ok } from "@/lib/api-response";
import {
  leaseNextTrainingWorkerTask,
  mapTrainingWorkerTaskError,
} from "@/server/worker/training/task-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const data = await leaseNextTrainingWorkerTask({
      workerType: searchParams.get("workerType"),
      leaseOwner: searchParams.get("leaseOwner") ?? undefined,
      leaseDurationSeconds: searchParams.get("leaseDurationSeconds")
        ? Number(searchParams.get("leaseDurationSeconds"))
        : undefined,
      projectId: searchParams.get("projectId") ?? undefined,
      targetType: searchParams.get("targetType") ?? undefined,
      targetId: searchParams.get("targetId") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
