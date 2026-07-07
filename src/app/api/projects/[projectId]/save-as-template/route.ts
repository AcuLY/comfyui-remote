import { fail, failFromError, ok } from "@/lib/api-response";
import { saveProjectAsTemplate } from "@/lib/actions/template-save";
import { readJsonObject } from "@/server/http/request-json";

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
    const status = e instanceof Error && e.message === "PROJECT_NOT_FOUND" ? 404 : 500;
    return failFromError(e, "Unknown error", status);
  }
}
