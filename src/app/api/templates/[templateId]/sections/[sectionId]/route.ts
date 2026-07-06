import { fail, failFromError, ok } from "@/lib/api-response";
import { deleteProjectTemplateSection, updateProjectTemplateSection } from "@/lib/actions";
import { getProjectTemplateDetail, type ProjectTemplateSectionData } from "@/lib/server-data";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ templateId: string; sectionId: string }>;
};

function mapTemplateSectionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message === "TEMPLATE_SECTION_NOT_FOUND" ? 404 : 500;
  return { message, status };
}

async function getTemplateSection(templateId: string, sectionId: string) {
  const template = await getProjectTemplateDetail(templateId);
  if (!template) return null;
  return template.sections.find((section) => section.id === sectionId) ?? null;
}

function readSectionPatch(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const candidate = record.section && typeof record.section === "object" && !Array.isArray(record.section)
    ? record.section
    : record;
  return candidate as Partial<ProjectTemplateSectionData>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { templateId, sectionId } = await context.params;

  try {
    const section = await getTemplateSection(templateId, sectionId);
    if (!section) return fail("Template section not found", 404);
    return ok(section);
  } catch (error) {
    const mapped = mapTemplateSectionError(error);
    return fail(mapped.message, mapped.status);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { templateId, sectionId } = await context.params;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  const patch = readSectionPatch(body);
  if (!patch) return fail("Request body must be a section patch object", 400);
  if (patch.promptBlocks !== undefined && !Array.isArray(patch.promptBlocks)) {
    return fail("promptBlocks must be an array", 400);
  }

  try {
    const existing = await getTemplateSection(templateId, sectionId);
    if (!existing) return fail("Template section not found", 404);

    const section: ProjectTemplateSectionData = {
      ...existing,
      ...patch,
      id: sectionId,
      promptBlocks: patch.promptBlocks ?? existing.promptBlocks,
    };
    await updateProjectTemplateSection({ templateId, sectionId, section });
    return ok({ success: true });
  } catch (error) {
    const mapped = mapTemplateSectionError(error);
    return fail(mapped.message, mapped.status);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { templateId, sectionId } = await context.params;

  try {
    await deleteProjectTemplateSection({ templateId, sectionId });
    return ok({ success: true });
  } catch (error) {
    const mapped = mapTemplateSectionError(error);
    return fail(mapped.message, mapped.status);
  }
}
