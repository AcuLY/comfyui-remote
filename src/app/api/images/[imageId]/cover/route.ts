import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, failFromError, ok } from "@/lib/api-response";
import { readOptionalJsonObject } from "@/server/http/request-json";
import {
  mapReviewError,
  setGenerationImageCover,
} from "@/server/services/review-service";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { imageId } = await context.params;

  let body: { cover?: unknown };
  try {
    body = await readOptionalJsonObject(request) as { cover?: unknown };
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }

  if (body.cover === false) {
    return fail("封面只能通过选择另一张图片覆盖", 400);
  }

  try {
    const result = await setGenerationImageCover(imageId);

    revalidatePath("/projects", "layout");

    return ok(result);
  } catch (error) {
    const mapped = mapReviewError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
