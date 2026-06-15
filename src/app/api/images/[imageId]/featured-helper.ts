import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { buildGenerationProjectWhere } from "@/server/repositories/legacy-training-resource-boundary";

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

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body", 400);
    }

    const value = Boolean((body as Record<string, unknown>)[field]);

    const existing = await db.imageResult.findFirst({
      where: {
        id: imageId,
        run: { project: buildGenerationProjectWhere() },
      },
      select: { id: true, reviewStatus: true },
    });
    if (!existing) {
      return fail("Image not found", 404);
    }

    const shouldKeep = value && existing.reviewStatus !== "trashed";
    const image = await db.imageResult.update({
      where: { id: imageId },
      data: {
        [field]: value,
        ...(shouldKeep
          ? { reviewStatus: "kept", reviewedAt: new Date() }
          : {}),
      },
      select: { id: true, [field]: true, reviewStatus: true },
    });

    revalidatePath("/projects", "layout");

    return ok(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
