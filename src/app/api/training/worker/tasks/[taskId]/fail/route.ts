import { fail, failFromError, ok } from "@/lib/api-response";
import {
  failTrainingWorkerTask,
  mapTrainingWorkerTaskError,
} from "@/server/worker/training/task-api";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

type WorkerTaskRouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: WorkerTaskRouteContext) {
  const { taskId } = await context.params;
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await failTrainingWorkerTask(taskId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
