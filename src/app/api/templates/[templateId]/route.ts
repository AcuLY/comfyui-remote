import { fail, ok } from "@/lib/api-response";
import { updateProjectTemplate, deleteProjectTemplate } from "@/lib/actions";
import { getProjectTemplateDetail } from "@/lib/server-data";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  try {
    const template = await getProjectTemplateDetail(templateId);
    if (!template) return fail("Template not found", 404);
    return ok(template);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  let body;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }
  try {
    await updateProjectTemplate({ id: templateId, ...body });
    return ok({ success: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  try {
    await deleteProjectTemplate(templateId);
    return ok({ success: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}
