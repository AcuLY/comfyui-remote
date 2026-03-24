import { ActorType } from "@/generated/prisma";
import { fail, ok } from "@/lib/api-response";
import { getJobAgentContext } from "@/server/repositories/job-repository";
import {
  enqueueJobRuns,
  mapJobError,
} from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const result = await enqueueJobRuns(jobId, ActorType.agent);
    const contextData = await getJobAgentContext(jobId);

    return ok(
      {
        jobId,
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
