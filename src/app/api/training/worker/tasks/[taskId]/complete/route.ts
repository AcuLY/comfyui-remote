import { fail, ok } from "@/lib/api-response";
import {
  completeLegacyTrainingWorkerTask,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

type WorkerTaskRouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: WorkerTaskRouteContext) {
  const { taskId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await completeLegacyTrainingWorkerTask(taskId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapLegacyTrainingGenerationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
