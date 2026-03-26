import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { imageId } = await context.params;

  try {
    const body = await request.json();
    const featured = Boolean(body.featured);

    const image = await db.imageResult.update({
      where: { id: imageId },
      data: { featured },
      select: { id: true, featured: true },
    });

    revalidatePath("/jobs", "layout");

    return ok(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
