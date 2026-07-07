import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { renamePresetFolder, deletePresetFolder } from "@/lib/actions/preset-folder";
import { getPresetFolder } from "@/lib/server-data";
import { readJsonBody } from "@/server/http/request-json";

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
    return failFromError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    const body = await readJsonBody(request) as { name?: unknown };
    await renamePresetFolder(folderId, body.name);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    await deletePresetFolder(folderId);
    return ok({ success: true });
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}
