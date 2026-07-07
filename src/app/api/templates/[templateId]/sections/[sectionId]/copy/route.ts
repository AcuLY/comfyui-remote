import { fail, ok } from "@/lib/api-response";
import { copyProjectTemplateSection } from "@/lib/actions/template-crud";
import { getProjectTemplateDetail } from "@/lib/server-data";

type RouteContext = {
  params: Promise<{ templateId: string; sectionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { templateId, sectionId } = await context.params;

  try {
    const template = await getProjectTemplateDetail(templateId);
    const section = template?.sections.find((item) => item.id === sectionId);
    if (!section) return fail("Template section not found", 404);

    const id = await copyProjectTemplateSection(sectionId);
    if (!id) return fail("Template section not found", 404);
    return ok({ id }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unknown error", 500);
  }
}
