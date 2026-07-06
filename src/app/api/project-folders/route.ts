import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import {
  createProjectFolder,
  listProjectFolders,
  mapProjectFolderError,
} from "@/server/services/project-folder-service";

export async function GET(request: NextRequest) {
  const parentParam = request.nextUrl.searchParams.get("parentId");
  const parentId = parentParam === null ? undefined : parentParam.trim() || null;

  try {
    const data = await listProjectFolders(parentId);
    return ok(data);
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await createProjectFolder(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapProjectFolderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
