import { fail, ok } from "@/lib/api-response";
import { saveProjectAsTemplate } from "@/lib/actions";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  let body;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }
  const name = body?.name;
  if (!name || typeof name !== "string") return fail("name is required", 400);
  try {
    const id = await saveProjectAsTemplate(projectId, name, body?.description);
    return ok({ id }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "PROJECT_NOT_FOUND" ? 404 : 500;
    return fail(msg, status);
  }
}
