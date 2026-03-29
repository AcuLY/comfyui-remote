import { ActorType } from "@/lib/db-enums";
import { fail, ok } from "@/lib/api-response";
import { getProjectAgentContext } from "@/server/repositories/project-repository";
import {
  enqueueProjectRuns,
  mapProjectError,
} from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const result = await enqueueProjectRuns(projectId, undefined, ActorType.agent);
    const contextData = await getProjectAgentContext(projectId);

    return ok(
      {
        projectId,
        result,
        context: contextData,
      },
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
