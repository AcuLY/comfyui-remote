import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { renamePresetFolder, deletePresetFolder } from "@/lib/actions";
import { getPresetFolder } from "@/lib/server-data";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    const folder = await getPresetFolder(folderId);
    if (!folder) return fail("Folder not found", 404);
    return ok(folder);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    const body = await request.json();
    await renamePresetFolder(folderId, body.name);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    await deletePresetFolder(folderId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}
