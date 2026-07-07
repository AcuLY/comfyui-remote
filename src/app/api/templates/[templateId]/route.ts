import { fail, failFromError, ok } from "@/lib/api-response";
import { updateProjectTemplate, deleteProjectTemplate } from "@/lib/actions/template-crud";
import { getProjectTemplateDetail } from "@/lib/server-data";
import { readJsonObject } from "@/server/http/request-json";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  try {
    const template = await getProjectTemplateDetail(templateId);
    if (!template) return fail("Template not found", 404);
    return ok(template);
  } catch (e: unknown) {
    return failFromError(e);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  try {
    const body = await readJsonObject(request);
    await updateProjectTemplate({ id: templateId, ...body } as Parameters<typeof updateProjectTemplate>[0]);
    return ok({ success: true });
  } catch (e: unknown) {
    return failFromError(e);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  try {
    await deleteProjectTemplate(templateId);
    return ok({ success: true });
  } catch (e: unknown) {
    return failFromError(e);
  }
}
