import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { reorderPresetFolders } from "@/lib/actions/preset-folder";
import { readJsonBody } from "@/server/http/request-json";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request) as { categoryId?: unknown; parentId?: string | null; ids?: unknown };
    const { categoryId, parentId, ids } = body;
    if (!categoryId || typeof categoryId !== "string") {
      return fail("categoryId is required", 400);
    }
    if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string")) {
      return fail("ids must be a string array", 400);
    }
    await reorderPresetFolders(categoryId, parentId ?? null, ids);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
