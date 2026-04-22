import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { reorderPresetFolders } from "@/lib/actions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, ids } = body;
    if (!categoryId || typeof categoryId !== "string") {
      return fail("categoryId is required", 400);
    }
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderPresetFolders(categoryId, ids);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
