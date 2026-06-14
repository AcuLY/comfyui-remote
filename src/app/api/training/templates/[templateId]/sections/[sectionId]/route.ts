import { fail, ok } from "@/lib/api-response";
import {
  getManagedTrainingTemplate,
  mapTrainingTemplateError,
  updateManagedTrainingTemplateSection,
} from "@/server/services/training/template-service";

type RouteContext = {
  params: Promise<{ sectionId: string; templateId: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sectionId, templateId } = await context.params;
    const template = await getManagedTrainingTemplate(templateId);
    const section = template.sections.find((item) => item.id === sectionId);
    if (!section) return fail("Training template section not found", 404);
    return ok(section);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { sectionId, templateId } = await context.params;
    const data = await updateManagedTrainingTemplateSection(templateId, sectionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
