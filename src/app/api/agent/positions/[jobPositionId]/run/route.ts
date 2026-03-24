import { fail, ok } from "@/lib/api-response";
import {
  getJobAgentContext,
  getJobPositionOwner,
} from "@/server/repositories/job-repository";
import {
  enqueueJobPositionRun,
  mapJobError,
} from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobPositionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobPositionId } = await context.params;

  try {
    const position = await getJobPositionOwner(jobPositionId);
    const result = await enqueueJobPositionRun(position.jobId, position.id);
    const contextData = await getJobAgentContext(position.jobId);

    return ok(
      {
        jobId: position.jobId,
        jobPositionId: position.id,
        result,
        context: contextData,
      },
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
