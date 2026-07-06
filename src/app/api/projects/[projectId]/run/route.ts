import { fail, failFromError, ok } from "@/lib/api-response";
import { readOptionalJsonObject } from "@/server/http/request-json";
import { enqueueProjectRuns, mapProjectError } from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let overrideBatchSize: number | undefined;
  try {
    const body = await readOptionalJsonObject(request);
    if (typeof body.batchSize === "number" && Number.isInteger(body.batchSize) && body.batchSize >= 1) {
      overrideBatchSize = body.batchSize;
    }
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await enqueueProjectRuns(projectId, overrideBatchSize);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
