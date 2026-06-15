import { fail, ok } from "@/lib/api-response";
import {
  heartbeatTrainingWorkerTask,
  mapTrainingWorkerTaskError,
} from "@/server/worker/training/task-api";

export const dynamic = "force-dynamic";

type WorkerTaskRouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: WorkerTaskRouteContext) {
  const { taskId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await heartbeatTrainingWorkerTask(taskId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
