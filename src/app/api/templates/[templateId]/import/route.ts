import { fail, ok } from "@/lib/api-response";
import { importTemplateToProject } from "@/lib/actions";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  let body;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }
  const projectId = body?.projectId;
  if (!projectId || typeof projectId !== "string") return fail("projectId is required", 400);
  try {
    const count = await importTemplateToProject(projectId, templateId);
    return ok({ importedCount: count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "TEMPLATE_NOT_FOUND" ? 404 : 500;
    return fail(msg, status);
  }
}
