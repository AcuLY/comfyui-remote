import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LoraTrainingTemplate } from "@/app/design-demos/data/lora-training-types";
import { buildLoraTrainingDemoData } from "@/app/design-demos/data/lora-training";
import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
import {
  createCharacterLoraTrainingTemplate,
  getCharacterLoraTrainingTemplateSnapshot,
  listCharacterLoraTrainingTemplates,
  mapCharacterLoraSectionTemplateError,
  updateCharacterLoraTrainingTemplate,
} from "@/server/services/character-lora-training/section-template-service";
import { upsertCharacterLoraTrainingTemplates } from "@/server/repositories/character-lora-training-repository";
import { z } from "zod";

const TRAINING_TEMPLATE_FALLBACK_PATH = join(process.cwd(), "data", "training-templates.json");

const templateBlockInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  source: z.enum(["预制", "本地"]).optional(),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
}).strict();

const templateSectionInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  blockCount: z.coerce.number().int().min(0).optional(),
  blocks: z.array(templateBlockInputSchema).default([]),
  resolvedScene: z.string().trim().max(20_000).nullable().optional(),
  scenePreview: z.string().trim().max(20_000).nullable().optional(),
}).strict();

const trainingTemplateInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(20_000).nullable().optional(),
  imageGuidance: z.string().trim().max(20_000).nullable().optional(),
  captionGuidance: z.string().trim().max(20_000).nullable().optional(),
  sections: z.array(templateSectionInputSchema).default([]),
}).strict();

type TrainingTemplateInput = z.infer<typeof trainingTemplateInputSchema>;
export class TrainingTemplateServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingTemplateServiceError";
    this.status = status;
    this.details = details;
  }
}

function shouldUseTrainingTemplateFileFallback(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Database .* does not exist|Can't reach database server|ECONNREFUSED|P1001|P1003/i.test(message);
}

function readGuidance(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null;
}

function formatUpdatedAt(value: Date | string = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapTemplateSnapshot(snapshot: Awaited<ReturnType<typeof getCharacterLoraTrainingTemplateSnapshot>>): LoraTrainingTemplate {
  return {
    id: snapshot.id,
    title: snapshot.name,
    status: snapshot.isActive ? "active" : "archived",
    updatedAt: formatUpdatedAt(snapshot.updatedAt),
    description: snapshot.description ?? "",
    imageGuidance: readGuidance(snapshot.trainingDefaults, "imageGuidance") ?? "每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。",
    captionGuidance: readGuidance(snapshot.promptCardDefaults, "captionGuidance") ?? "先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。",
    sectionCount: snapshot.sectionTemplates.length,
    sections: snapshot.sectionTemplates.map((section) => ({
      id: section.id,
      title: section.name,
      enabled: section.isActive,
      blockCount: 1,
      blocks: [
        {
          id: `${section.id}-prompt-template`,
          source: "本地" as const,
          title: section.angleTag || "模板提示词",
          text: section.promptTemplate || section.description || section.name,
        },
      ],
      resolvedScene: section.description || section.promptTemplate || section.name,
      scenePreview: section.description || section.name,
    })),
  };
}

function parseTrainingTemplateInput(input: unknown) {
  const result = trainingTemplateInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingTemplateServiceError("Invalid training template request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

async function readFallbackTrainingTemplates() {
  try {
    const raw = await readFile(TRAINING_TEMPLATE_FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as LoraTrainingTemplate[];
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaults = buildLoraTrainingDemoData(await loadDesignDemoData()).templates;
  await writeFallbackTrainingTemplates(defaults);
  return defaults;
}

async function writeFallbackTrainingTemplates(templates: LoraTrainingTemplate[]) {
  await mkdir(dirname(TRAINING_TEMPLATE_FALLBACK_PATH), { recursive: true });
  await writeFile(TRAINING_TEMPLATE_FALLBACK_PATH, `${JSON.stringify(templates, null, 2)}\n`, "utf8");
}

function normalizeTemplatePayload(input: TrainingTemplateInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    imageGuidance: input.imageGuidance ?? null,
    captionGuidance: input.captionGuidance ?? null,
    sections: input.sections.map((section) => ({
      id: section.id,
      title: section.title,
      enabled: section.enabled,
      blockCount: section.blockCount,
      blocks: section.blocks.map((block) => ({
        title: block.title,
        text: block.text,
      })),
      resolvedScene: section.resolvedScene ?? null,
      scenePreview: section.scenePreview ?? null,
    })),
  };
}

function nextTemplateUpdatedAt() {
  return formatUpdatedAt(new Date());
}

export async function listManagedTrainingTemplates() {
  const fallbackTemplates = await readFallbackTrainingTemplates().catch(() => [] as LoraTrainingTemplate[]);

  try {
    const summaries = await listCharacterLoraTrainingTemplates();
    const snapshots = await Promise.all(summaries.map((template) => getCharacterLoraTrainingTemplateSnapshot({ id: template.id })));
    const databaseTemplates = snapshots.map(mapTemplateSnapshot);
    const databaseIds = new Set(databaseTemplates.map((template) => template.id));
    return [
      ...fallbackTemplates.filter((template) => !databaseIds.has(template.id)),
      ...databaseTemplates,
    ];
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) throw error;
    return fallbackTemplates;
  }
}

export async function getManagedTrainingTemplate(templateId: string) {
  const fallbackTemplates = await readFallbackTrainingTemplates().catch(() => [] as LoraTrainingTemplate[]);
  const fallbackTemplate = fallbackTemplates.find((item) => item.id === templateId);
  if (fallbackTemplate) {
    return fallbackTemplate;
  }

  try {
    const snapshot = await getCharacterLoraTrainingTemplateSnapshot({ id: templateId });
    return mapTemplateSnapshot(snapshot);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const template = fallbackTemplates.find((item) => item.id === templateId);
    if (!template) {
      throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
    }
    return template;
  }
}

export async function createManagedTrainingTemplate(input: unknown) {
  const parsed = parseTrainingTemplateInput(input);

  try {
    const snapshot = await createCharacterLoraTrainingTemplate(normalizeTemplatePayload(parsed));
    return mapTemplateSnapshot(snapshot);
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      const mapped = mapCharacterLoraSectionTemplateError(error);
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const templates = await readFallbackTrainingTemplates();
    const nextId = `training-template-${Date.now()}`;
    const created: LoraTrainingTemplate = {
      id: nextId,
      title: parsed.title,
      status: "active",
      updatedAt: nextTemplateUpdatedAt(),
      description: parsed.description ?? "",
      imageGuidance: parsed.imageGuidance ?? "",
      captionGuidance: parsed.captionGuidance ?? "",
      sectionCount: parsed.sections.length,
      sections: parsed.sections.map((section, index) => ({
        id: section.id ?? `${nextId}-section-${index + 1}`,
        title: section.title,
        enabled: section.enabled,
        blockCount: section.blockCount ?? section.blocks.length,
        blocks: section.blocks.map((block) => ({
          id: block.id ?? `${nextId}-section-${index + 1}-block-${Date.now()}`,
          source: block.source ?? "本地",
          title: block.title,
          text: block.text,
        })),
        resolvedScene: section.resolvedScene ?? section.scenePreview ?? section.title,
        scenePreview: section.scenePreview ?? section.resolvedScene ?? section.title,
      })),
    };
    await writeFallbackTrainingTemplates([...templates, created]);
    return created;
  }
}

export async function updateManagedTrainingTemplate(templateId: string, input: unknown) {
  const parsed = parseTrainingTemplateInput(input);
  const fallbackTemplates = await readFallbackTrainingTemplates().catch(() => [] as LoraTrainingTemplate[]);
  const fallbackIndex = fallbackTemplates.findIndex((template) => template.id === templateId);

  if (fallbackIndex !== -1) {
    const updated: LoraTrainingTemplate = {
      ...fallbackTemplates[fallbackIndex],
      title: parsed.title,
      updatedAt: nextTemplateUpdatedAt(),
      description: parsed.description ?? "",
      imageGuidance: parsed.imageGuidance ?? "",
      captionGuidance: parsed.captionGuidance ?? "",
      sectionCount: parsed.sections.length,
      sections: parsed.sections.map((section, index) => ({
        id: section.id ?? `${templateId}-section-${index + 1}`,
        title: section.title,
        enabled: section.enabled,
        blockCount: section.blockCount ?? section.blocks.length,
        blocks: section.blocks.map((block, blockIndex) => ({
          id: block.id ?? `${templateId}-section-${index + 1}-block-${blockIndex + 1}`,
          source: block.source ?? "本地",
          title: block.title,
          text: block.text,
        })),
        resolvedScene: section.resolvedScene ?? section.scenePreview ?? section.title,
        scenePreview: section.scenePreview ?? section.resolvedScene ?? section.title,
      })),
    };
    const next = [...fallbackTemplates];
    next[fallbackIndex] = updated;
    await writeFallbackTrainingTemplates(next);
    return updated;
  }

  try {
    const snapshot = await updateCharacterLoraTrainingTemplate(templateId, normalizeTemplatePayload(parsed));
    return mapTemplateSnapshot(snapshot);
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      const mapped = mapCharacterLoraSectionTemplateError(error);
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const templates = await readFallbackTrainingTemplates();
    const currentIndex = templates.findIndex((template) => template.id === templateId);
    if (currentIndex === -1) {
      throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
    }
    const updated: LoraTrainingTemplate = {
      ...templates[currentIndex],
      title: parsed.title,
      updatedAt: nextTemplateUpdatedAt(),
      description: parsed.description ?? "",
      imageGuidance: parsed.imageGuidance ?? "",
      captionGuidance: parsed.captionGuidance ?? "",
      sectionCount: parsed.sections.length,
      sections: parsed.sections.map((section, index) => ({
        id: section.id ?? `${templateId}-section-${index + 1}`,
        title: section.title,
        enabled: section.enabled,
        blockCount: section.blockCount ?? section.blocks.length,
        blocks: section.blocks.map((block, blockIndex) => ({
          id: block.id ?? `${templateId}-section-${index + 1}-block-${blockIndex + 1}`,
          source: block.source ?? "本地",
          title: block.title,
          text: block.text,
        })),
        resolvedScene: section.resolvedScene ?? section.scenePreview ?? section.title,
        scenePreview: section.scenePreview ?? section.resolvedScene ?? section.title,
      })),
    };
    const next = [...templates];
    next[currentIndex] = updated;
    await writeFallbackTrainingTemplates(next);
    return updated;
  }
}

export async function deleteManagedTrainingTemplate(templateId: string) {
  const fallbackTemplates = await readFallbackTrainingTemplates().catch(() => [] as LoraTrainingTemplate[]);
  const fallbackIndex = fallbackTemplates.findIndex((template) => template.id === templateId);

  if (fallbackIndex !== -1) {
    const next = [...fallbackTemplates];
    next.splice(fallbackIndex, 1);
    await writeFallbackTrainingTemplates(next);
    return { success: true };
  }

  try {
    const snapshot = await getCharacterLoraTrainingTemplateSnapshot({ id: templateId });
    await upsertCharacterLoraTrainingTemplates([{
      key: snapshot.key,
      name: snapshot.name,
      description: snapshot.description ?? null,
      baseFamily: snapshot.baseFamily ?? null,
      captionStrategyDefault: snapshot.captionStrategyDefault,
      canonicalDefaults: snapshot.canonicalDefaults as never,
      promptCardDefaults: snapshot.promptCardDefaults as never,
      trainingDefaults: snapshot.trainingDefaults as never,
      benchmarkDefaults: snapshot.benchmarkDefaults as never,
      promotionDefaults: snapshot.promotionDefaults as never,
      isActive: false,
      sortOrder: snapshot.sortOrder ?? 10,
    }]);
    return { success: true };
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      const mapped = mapCharacterLoraSectionTemplateError(error);
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const currentIndex = fallbackTemplates.findIndex((template) => template.id === templateId);
    if (currentIndex === -1) {
      throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
    }
    const next = [...fallbackTemplates];
    next.splice(currentIndex, 1);
    await writeFallbackTrainingTemplates(next);
    return { success: true };
  }
}

export async function updateManagedTrainingTemplateSection(templateId: string, sectionId: string, input: unknown) {
  const patchSchema = z.object({
    title: z.string().trim().min(1).max(160).optional(),
    enabled: z.boolean().optional(),
    blocks: z.array(templateBlockInputSchema).optional(),
    resolvedScene: z.string().trim().max(20_000).nullable().optional(),
    scenePreview: z.string().trim().max(20_000).nullable().optional(),
  }).strict();
  const result = patchSchema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template section request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const current = await getManagedTrainingTemplate(templateId);
  const sections = current.sections.map((section: LoraTrainingTemplate["sections"][number]) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      title: result.data.title ?? section.title,
      enabled: result.data.enabled ?? section.enabled,
      blocks: result.data.blocks
        ? result.data.blocks.map((block, index) => ({
          id: block.id ?? `${section.id}-block-${index + 1}`,
          source: block.source ?? "本地",
          title: block.title,
          text: block.text,
        }))
        : section.blocks,
      resolvedScene: result.data.resolvedScene ?? section.resolvedScene,
      scenePreview: result.data.scenePreview ?? section.scenePreview,
      blockCount: result.data.blocks ? result.data.blocks.length : section.blockCount,
    };
  });

  if (!sections.some((section) => section.id === sectionId)) {
    throw new TrainingTemplateServiceError("Training template section not found", 404, { templateId, sectionId });
  }

  return updateManagedTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections,
  });
}

export function mapTrainingTemplateError(error: unknown) {
  if (error instanceof TrainingTemplateServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training template error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
