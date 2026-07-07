import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import {
  mapReviewError,
  setGenerationImageFeature,
} from "@/server/services/review-service";

type FeaturedField = "featured" | "featured2";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function handleFeaturedToggle(
  request: NextRequest,
  context: RouteContext,
  field: FeaturedField,
) {
  const { imageId } = await context.params;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  const value = Boolean((body as Record<string, unknown> | null | undefined)?.[field]);

  try {
    const image = await setGenerationImageFeature(imageId, field, value);
    revalidatePath("/projects", "layout");

    return ok(image);
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
