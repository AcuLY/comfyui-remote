import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraTrainingTemplateSnapshot,
  mapCharacterLoraSectionTemplateError,
  updateCharacterLoraTrainingTemplate,
} from "@/server/services/character-lora-training/section-template-service";

type RouteContext = {
  params: Promise<{ sectionId: string; templateId: string }>;
};

type TrainingTemplateSectionPatch = {
  title?: string;
  enabled?: boolean;
  blocks?: Array<{ text: string; title: string }>;
  resolvedScene?: string | null;
  scenePreview?: string | null;
};

function readGuidance(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null;
}

function mapTrainingTemplateSection(section: Awaited<ReturnType<typeof getCharacterLoraTrainingTemplateSnapshot>>["sectionTemplates"][number]) {
  return {
    id: section.id,
    title: section.name,
    enabled: section.isActive,
    blockCount: section.targetCandidateCount,
    blocks: [
      {
        id: `${section.id}-prompt-template`,
        source: "本地" as const,
        title: section.angleTag || "模板提示词",
        text: section.promptTemplate,
      },
    ],
    resolvedScene: section.description || section.promptTemplate || section.name,
    scenePreview: section.description || section.name,
  };
}

function readSectionPatch(body: unknown): TrainingTemplateSectionPatch | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const candidate = record.section && typeof record.section === "object" && !Array.isArray(record.section)
    ? record.section
    : record;
  return candidate as TrainingTemplateSectionPatch;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sectionId, templateId } = await context.params;
    const snapshot = await getCharacterLoraTrainingTemplateSnapshot({ id: templateId });
    const section = snapshot.sectionTemplates.find((item) => item.id === sectionId);
    if (!section) return fail("Training template section not found", 404);
    return ok(mapTrainingTemplateSection(section));
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
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

  const patch = readSectionPatch(body);
  if (!patch) return fail("Request body must be a template section patch object", 400);

  try {
    const { sectionId, templateId } = await context.params;
    const snapshot = await getCharacterLoraTrainingTemplateSnapshot({ id: templateId });
    const existingSection = snapshot.sectionTemplates.find((item) => item.id === sectionId);
    if (!existingSection) return fail("Training template section not found", 404);

    const sections = snapshot.sectionTemplates.map((section) => {
      if (section.id !== sectionId) {
        return mapTrainingTemplateSection(section);
      }

      const currentSection = mapTrainingTemplateSection(section);
      return {
        ...currentSection,
        title: typeof patch.title === "string" ? patch.title : currentSection.title,
        enabled: typeof patch.enabled === "boolean" ? patch.enabled : currentSection.enabled,
        blocks: Array.isArray(patch.blocks) ? patch.blocks : currentSection.blocks,
        resolvedScene: patch.resolvedScene ?? currentSection.resolvedScene,
        scenePreview: patch.scenePreview ?? currentSection.scenePreview,
      };
    });

    const data = await updateCharacterLoraTrainingTemplate(templateId, {
      title: snapshot.name,
      description: snapshot.description ?? null,
      imageGuidance: readGuidance(snapshot.trainingDefaults, "imageGuidance"),
      captionGuidance: readGuidance(snapshot.promptCardDefaults, "captionGuidance"),
      sections,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
