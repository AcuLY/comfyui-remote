import { fail, ok } from "@/lib/api-response";
import { saveProjectAsTemplate } from "@/lib/actions";
import { HttpRequestError, readJsonObject } from "@/server/http/request-json";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  try {
    const body = await readJsonObject(request);
    const name = body.name;
    if (!name || typeof name !== "string") return fail("name is required", 400);

    const id = await saveProjectAsTemplate(projectId, name, body.description as string | null | undefined);
    return ok({ id }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof HttpRequestError) {
      return fail(e.message, e.status, e.details);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "PROJECT_NOT_FOUND" ? 404 : 500;
    return fail(msg, status);
  }
}
