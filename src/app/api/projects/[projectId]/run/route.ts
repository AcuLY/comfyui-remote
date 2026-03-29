import { fail, ok } from "@/lib/api-response";
import { enqueueJobRuns, mapJobError } from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  let overrideBatchSize: number | undefined;
  try {
    const body = await request.json().catch(() => null);
    if (body && typeof body.batchSize === "number" && Number.isInteger(body.batchSize) && body.batchSize >= 1) {
      overrideBatchSize = body.batchSize;
    }
  } catch {
    // no body is fine
  }

  try {
    const data = await enqueueJobRuns(jobId, overrideBatchSize);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
