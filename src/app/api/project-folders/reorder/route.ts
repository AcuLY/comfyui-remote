import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import {
  mapProjectFolderError,
  reorderProjectFolders,
} from "@/server/services/project-folder-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    await reorderProjectFolders(body);
    return ok({ success: true });
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
