import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import { createProject, listProjects, mapProjectError } from "@/server/services/project-service";

export async function GET(request: NextRequest) {
  try {
    const data = await listProjects({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      title: request.nextUrl.searchParams.get("title") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      enabledOnly: request.nextUrl.searchParams.get("enabledOnly") ?? undefined,
      hasPending: request.nextUrl.searchParams.get("hasPending") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapProjectError(error);
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
    const data = await createProject(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
