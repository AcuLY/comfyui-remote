import { fail, ok } from "@/lib/api-response";
import { mapReviewError, trashRunImages } from "@/server/repositories/review-repository";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

type TrashRequestBody = {
  imageIds?: string[];
  reason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params;

  let body: TrashRequestBody;
  try {
    body = (await request.json()) as TrashRequestBody;
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
    const data = await trashRunImages(runId, imageIds, typeof body.reason === "string" ? body.reason : undefined);
    return ok(data);
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
