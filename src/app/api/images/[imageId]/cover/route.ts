import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api-response";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { imageId } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as { cover?: unknown };

    if (body.cover === false) {
      return fail("封面只能通过选择另一张图片覆盖", 400);
    }

    const image = await db.imageResult.findUnique({
      where: { id: imageId },
      select: {
        id: true,
        reviewStatus: true,
        run: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!image) {
      return fail("Image not found", 404);
    }

    if (image.reviewStatus === "trashed") {
      return fail("不能将已删除图片设为封面", 409);
    }

    const now = new Date();
    const [project, keptImage] = await db.$transaction([
      db.project.update({
        where: { id: image.run.projectId },
        data: { coverImageId: image.id },
        select: { id: true, coverImageId: true },
      }),
      db.imageResult.update({
        where: { id: image.id },
        data: { reviewStatus: "kept", reviewedAt: now },
        select: { id: true, reviewStatus: true },
      }),
    ]);

    revalidatePath("/projects", "layout");

    return ok({
      id: image.id,
      projectId: project.id,
      cover: project.coverImageId === image.id,
      reviewStatus: keptImage.reviewStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
