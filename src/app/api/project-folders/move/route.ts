import { fail, ok } from "@/lib/api-response";
import {
  mapProjectFolderError,
  moveProjectToFolderFromBody,
} from "@/server/services/project-folder-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    await moveProjectToFolderFromBody(body);
    return ok({ success: true });
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
