import { fail, ok } from "@/lib/api-response";
import { getWorkflowTemplate } from "@/server/services/workflow-template-service";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  const normalizedId = templateId.trim();

  if (!normalizedId) {
    return fail("templateId is required", 400);
  }

  const template = await getWorkflowTemplate(normalizedId);

  if (!template) {
    return fail("Workflow template not found", 404);
  }

  return ok(template);
}
