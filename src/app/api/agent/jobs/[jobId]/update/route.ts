import { ActorType } from "@/lib/db-enums";
import { fail, ok } from "@/lib/api-response";
import {
  getJobAgentContext,
  getJobPositionDetail,
} from "@/server/repositories/job-repository";
import {
  mapJobError,
  updateJob,
  updateJobPosition,
} from "@/server/services/job-service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type AgentJobUpdateRequestBody = {
  job?: unknown;
  positions?: unknown;
};

function parseRequestBody(body: unknown): AgentJobUpdateRequestBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("REQUEST_BODY_INVALID");
  }

  return body as AgentJobUpdateRequestBody;
}

function normalizePositionsInput(value: unknown) {
  if (value === undefined) {
    return [] as Array<{ jobPositionId: string; patch: Record<string, unknown> }>;
  }

  if (!Array.isArray(value)) {
    throw new Error("POSITIONS_MUST_BE_ARRAY");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`positions[${index}] must be an object`);
    }

    const { jobPositionId, ...patch } = entry as Record<string, unknown>;

    if (typeof jobPositionId !== "string" || !jobPositionId.trim()) {
      throw new Error(`positions[${index}].jobPositionId is required`);
    }

    return {
      jobPositionId: jobPositionId.trim(),
      patch,
    };
  });
}

function mapAgentJobUpdateInputError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: "Invalid agent job update request",
      status: 400,
      details: String(error),
    };
  }

  switch (error.message) {
    case "REQUEST_BODY_INVALID":
      return { message: "Request body must be an object", status: 400 };
    case "POSITIONS_MUST_BE_ARRAY":
      return { message: "positions must be an array", status: 400 };
    case "NO_AGENT_JOB_UPDATE_FIELDS":
      return {
        message: "At least one of job or positions is required",
        status: 400,
        details: {
          supportedTopLevelFields: ["job", "positions"],
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
  const { jobId } = await context.params;

  let body: AgentJobUpdateRequestBody;
  try {
    body = parseRequestBody(await request.json());
  } catch (error) {
    const mapped = mapAgentJobUpdateInputError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }

  const jobPatch = body.job;
  const positionPatches = (() => {
    try {
      return normalizePositionsInput(body.positions);
    } catch (error) {
      const mapped = mapAgentJobUpdateInputError(error);
      throw fail(mapped.message, mapped.status, mapped.details);
    }
  })();

  if (jobPatch === undefined && positionPatches.length === 0) {
    return fail("At least one of job or positions is required", 400, {
      supportedTopLevelFields: ["job", "positions"],
    });
  }

  try {
    const updated: {
      job?: Awaited<ReturnType<typeof updateJob>>;
      positions: Awaited<ReturnType<typeof getJobPositionDetail>>[];
      context: Awaited<ReturnType<typeof getJobAgentContext>>;
    } = {
      positions: [],
      context: await getJobAgentContext(jobId),
    };

    if (jobPatch !== undefined) {
      updated.job = await updateJob(jobId, jobPatch, ActorType.agent);
    }

    for (const positionPatch of positionPatches) {
      await updateJobPosition(jobId, positionPatch.jobPositionId, positionPatch.patch, ActorType.agent);
      updated.positions.push(await getJobPositionDetail(jobId, positionPatch.jobPositionId));
    }

    updated.context = await getJobAgentContext(jobId);

    return ok(updated);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
