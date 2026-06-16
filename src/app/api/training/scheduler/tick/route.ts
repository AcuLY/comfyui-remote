import { fail, ok } from "@/lib/api-response";
import { mapTrainingWorkerTaskError, tickTrainingWorkerScheduler } from "@/server/worker/training/task-api";

export const dynamic = "force-dynamic";

export async function POST(request?: Request) {
  try {
    const searchParams = request ? new URL(request.url).searchParams : null;
    const data = await tickTrainingWorkerScheduler({
      targetId: searchParams?.get("targetId") ?? undefined,
      targetType: searchParams?.get("targetType") ?? undefined,
    });
    if (!data) {
      return ok({
        idle: true,
      });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
