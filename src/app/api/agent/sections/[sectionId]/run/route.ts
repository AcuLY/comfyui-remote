import { ActorType } from "@/lib/db-enums";
import { fail, ok } from "@/lib/api-response";
import {
  getProjectAgentContext,
  getProjectSectionOwner,
} from "@/server/repositories/project-repository";
import {
  enqueueProjectSectionRun,
  mapProjectError,
} from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ sectionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sectionId } = await context.params;

  try {
    const section = await getProjectSectionOwner(sectionId);
    const result = await enqueueProjectSectionRun(section.projectId, section.id, undefined, ActorType.agent);
    const contextData = await getProjectAgentContext(section.projectId);

    return ok(
      {
        projectId: section.projectId,
        sectionId: section.id,
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
