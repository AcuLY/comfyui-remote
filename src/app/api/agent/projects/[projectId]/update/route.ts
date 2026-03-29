import { ActorType } from "@/lib/db-enums";
import { fail, ok } from "@/lib/api-response";
import {
  getProjectAgentContext,
  getProjectSectionDetail,
} from "@/server/repositories/project-repository";
import {
  mapProjectError,
  updateProject,
  updateProjectSection,
} from "@/server/services/project-service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type AgentProjectUpdateRequestBody = {
  project?: unknown;
  sections?: unknown;
};

function parseRequestBody(body: unknown): AgentProjectUpdateRequestBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("REQUEST_BODY_INVALID");
  }

  return body as AgentProjectUpdateRequestBody;
}

function normalizeSectionsInput(value: unknown) {
  if (value === undefined) {
    return [] as Array<{ sectionId: string; patch: Record<string, unknown> }>;
  }

  if (!Array.isArray(value)) {
    throw new Error("SECTIONS_MUST_BE_ARRAY");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`sections[${index}] must be an object`);
    }

    const { sectionId, ...patch } = entry as Record<string, unknown>;

    if (typeof sectionId !== "string" || !sectionId.trim()) {
      throw new Error(`sections[${index}].sectionId is required`);
    }

    return {
      sectionId: sectionId.trim(),
      patch,
    };
  });
}

function mapAgentProjectUpdateInputError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: "Invalid agent project update request",
      status: 400,
      details: String(error),
    };
  }

  switch (error.message) {
    case "REQUEST_BODY_INVALID":
      return { message: "Request body must be an object", status: 400 };
    case "SECTIONS_MUST_BE_ARRAY":
      return { message: "sections must be an array", status: 400 };
    case "NO_AGENT_PROJECT_UPDATE_FIELDS":
      return {
        message: "At least one of project or sections is required",
        status: 400,
        details: {
          supportedTopLevelFields: ["project", "sections"],
        },
      };
    default:
      return {
        message: error.message,
        status: 400,
      };
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: AgentProjectUpdateRequestBody;
  try {
    body = parseRequestBody(await request.json());
  } catch (error) {
    const mapped = mapAgentProjectUpdateInputError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }

  const projectPatch = body.project;
  const sectionPatches = (() => {
    try {
      return normalizeSectionsInput(body.sections);
    } catch (error) {
      const mapped = mapAgentProjectUpdateInputError(error);
      throw fail(mapped.message, mapped.status, mapped.details);
    }
  })();

  if (projectPatch === undefined && sectionPatches.length === 0) {
    return fail("At least one of project or sections is required", 400, {
      supportedTopLevelFields: ["project", "sections"],
    });
  }

  try {
    const updated: {
      project?: Awaited<ReturnType<typeof updateProject>>;
      sections: Awaited<ReturnType<typeof getProjectSectionDetail>>[];
      context: Awaited<ReturnType<typeof getProjectAgentContext>>;
    } = {
      sections: [],
      context: await getProjectAgentContext(projectId),
    };

    if (projectPatch !== undefined) {
      updated.project = await updateProject(projectId, projectPatch, ActorType.agent);
    }

    for (const sectionPatch of sectionPatches) {
      await updateProjectSection(projectId, sectionPatch.sectionId, sectionPatch.patch, ActorType.agent);
      updated.sections.push(await getProjectSectionDetail(projectId, sectionPatch.sectionId));
    }

    updated.context = await getProjectAgentContext(projectId);

    return ok(updated);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
