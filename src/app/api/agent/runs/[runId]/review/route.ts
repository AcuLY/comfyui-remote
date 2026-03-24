import { ActorType } from "@/lib/db-enums";
import { fail, ok } from "@/lib/api-response";
import {
  getRunAgentContext,
  keepRunImages,
  mapReviewError,
  trashRunImages,
} from "@/server/services/review-service";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

type AgentRunReviewRequestBody = {
  action?: unknown;
  imageIds?: unknown;
  reason?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params;

  let body: AgentRunReviewRequestBody;
  try {
    body = (await request.json()) as AgentRunReviewRequestBody;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (typeof body.action !== "string") {
    return fail("action is required", 400, {
      supportedActions: ["keep", "trash"],
    });
  }

  const action = body.action.trim().toLowerCase();

  if (action !== "keep" && action !== "trash") {
    return fail("action must be one of keep or trash", 400, {
      supportedActions: ["keep", "trash"],
    });
  }

  try {
    const result =
      action === "keep"
        ? await keepRunImages(runId, { imageIds: body.imageIds }, ActorType.agent)
        : await trashRunImages(runId, {
            imageIds: body.imageIds,
            reason: body.reason,
          }, ActorType.agent);

    const contextData = await getRunAgentContext(runId);

    return ok({
      action,
      result,
      context: contextData,
    });
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
