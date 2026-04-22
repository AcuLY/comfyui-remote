import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { moveToFolder } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    const body = await request.json();
    const { ids, categoryId } = body;
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    if (!categoryId || typeof categoryId !== "string") {
      return fail("categoryId is required", 400);
    }
    await moveToFolder(ids, folderId, categoryId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
