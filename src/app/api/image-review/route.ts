import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { keepImages, trashImages } from "@/lib/actions/image-review";

type ReviewAction = "keep" | "trash";

function normalizeImageIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

function normalizeAction(value: unknown): ReviewAction | null {
  return value === "keep" || value === "trash" ? value : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const action = normalizeAction(payload.action);
  const imageIds = normalizeImageIds(payload.imageIds);

  if (!action) {
    return fail("action must be keep or trash", 400);
  }

  if (imageIds.length === 0) {
    return fail("imageIds must contain at least one image id", 400);
  }

  try {
    if (action === "keep") {
      await keepImages(imageIds, { revalidate: false });
      return ok({ action, count: imageIds.length, imageIds });
    }

    const result = await trashImages(imageIds, { revalidate: false });
    return ok({ action, count: result.count, imageIds: result.imageIds });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Review action failed",
      500,
    );
  }
}
