import { fail, ok } from "@/lib/api-response";
import { mapReviewError, restoreImage } from "@/server/repositories/review-repository";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { imageId } = await context.params;

  try {
    const data = await restoreImage(imageId);
    return ok(data);
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
