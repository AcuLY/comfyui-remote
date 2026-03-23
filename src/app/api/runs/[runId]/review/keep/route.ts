import { fail, ok } from "@/lib/api-response";
import { keepRunImages, mapReviewError } from "@/server/repositories/review-repository";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

type KeepRequestBody = {
  imageIds?: string[];
};

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params;

  let body: KeepRequestBody;
  try {
    body = (await request.json()) as KeepRequestBody;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const imageIds = Array.isArray(body.imageIds)
    ? [...new Set(body.imageIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0))]
    : [];

  if (imageIds.length === 0) {
    return fail("imageIds is required", 400);
  }

  try {
    const data = await keepRunImages(runId, imageIds);
    return ok(data);
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
