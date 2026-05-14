import { fail, ok } from "@/lib/api-response";
import {
  deleteProjectFolder,
  getProjectFolder,
  mapProjectFolderError,
  renameProjectFolder,
} from "@/server/services/project-folder-service";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    const data = await getProjectFolder(folderId);
    return ok(data);
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await renameProjectFolder(folderId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    await deleteProjectFolder(folderId);
    return ok({ success: true });
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
