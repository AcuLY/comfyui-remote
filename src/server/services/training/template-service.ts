import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LoraTrainingTemplate } from "@/features/training/types";
import {
  TRAINING_COMPAT_TEMPLATE_BASE_ID,
  TRAINING_DEFAULT_TEMPLATE_KEY,
  TRAINING_FALLBACK_TEMPLATE_BASE_ID,
  createLegacyTrainingTemplate,
  getLegacyTrainingTemplateSnapshot,
  listLegacyTrainingTemplates,
  mapLegacyTrainingSectionTemplateError,
  updateLegacyTrainingTemplate,
  upsertLegacyTrainingTemplates,
} from "@/server/services/training/legacy-compat-service";
import { listTrainingTemplateOrderIds, orderTrainingTemplatesByStoredIds } from "@/server/services/training/template-order-service";
import { z } from "zod";

const TRAINING_TEMPLATE_FALLBACK_PATH = join(process.cwd(), "data", "training-templates.json");
const DEFAULT_FALLBACK_TRAINING_TEMPLATES: LoraTrainingTemplate[] = [
  {
    id: TRAINING_FALLBACK_TEMPLATE_BASE_ID,
    title: "角色 LoRA 基础模板",
    status: "active",
    updatedAt: "16:04",
    description: "用于新角色 LoRA 训练项目的默认模板，包含舞台、街景和白底净图。",
    imageGuidance: "每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。",
    captionGuidance: "先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。",
    sectionCount: 3,
    sections: [
      {
        id: "stage",
        title: "舞台肖像",
        enabled: true,
        blockCount: 2,
        scenePreview: "青色轮廓光 + 角色服装细节",
        resolvedScene: "冷色舞台灯光，青色轮廓光，角色服装细节清楚，背景保留少量霓虹反射。",
        blocks: [
          {
            id: "template-stage-rim",
            source: "预制",
            title: "青色轮廓光",
            text: "冷色舞台灯光，侧后方有清晰青色轮廓光，背景暗部保留少量霓虹反射。",
          },
          {
            id: "template-stage-outfit",
            source: "本地",
            title: "角色服装细节",
            text: "保留角色默认服装、袖口和肩颈细节，不引入复杂遮挡。",
          },
        ],
      },
      {
        id: "street",
        title: "街角夜景",
        enabled: true,
        blockCount: 3,
        scenePreview: "雨后街角 + 霓虹反射",
        resolvedScene: "雨后街角夜景，湿润地面带霓虹反射，角色站在街灯旁，构图保持可训练。",
        blocks: [
          {
            id: "template-street-rain",
            source: "预制",
            title: "雨后街角",
            text: "雨后街角，地面有霓虹反射，背景轻微虚化但仍可辨认街道层次。",
          },
          {
            id: "template-street-pose",
            source: "本地",
            title: "正面可训练角度",
            text: "角色保持正面或轻微侧身，脸部和服装主体不被遮挡。",
          },
          {
            id: "template-street-clean",
            source: "本地",
            title: "背景控制",
            text: "避免多人、文字招牌和大面积前景遮挡。",
          },
        ],
      },
      {
        id: "studio",
        title: "白底棚拍",
        enabled: true,
        blockCount: 1,
        scenePreview: "白底柔光训练净图",
        resolvedScene: "白底棚拍，柔光，全身或半身干净构图，用于数据集稳定样本。",
        blocks: [
          {
            id: "template-studio-clean",
            source: "预制",
            title: "训练净图",
            text: "白底棚拍，少量柔光，移除复杂背景，优先保证角色全身服装和发型稳定。",
          },
        ],
      },
    ],
  },
  {
    id: "portrait-soft",
    title: "柔和肖像模板",
    status: "active",
    updatedAt: "15:44",
    description: "偏轻量的人像模板，适合资料较完整的角色快速生成训练集。",
    imageGuidance: "以半身和特写为主，优先保证脸部、发型和上身服装细节稳定。",
    captionGuidance: "先写角色触发词，再补充脸部特征、镜头距离和背景控制。",
    sectionCount: 2,
    sections: [
      {
        id: "closeup",
        title: "半身特写",
        enabled: true,
        blockCount: 2,
        scenePreview: "柔光半身、脸部细节",
        resolvedScene: "柔光半身肖像，脸部细节清楚，背景简洁且不干扰角色身份。",
        blocks: [
          {
            id: "template-closeup-light",
            source: "预制",
            title: "柔光半身",
            text: "柔和主光，浅景深，半身构图，脸部和发型轮廓清楚。",
          },
          {
            id: "template-closeup-identity",
            source: "本地",
            title: "身份稳定",
            text: "优先保持角色五官、发型和默认配色稳定。",
          },
        ],
      },
      {
        id: "outfit",
        title: "服装补充",
        enabled: true,
        blockCount: 2,
        scenePreview: "全身服装和材质",
        resolvedScene: "全身服装补充，展示材质、袖口和轮廓，背景保持简单。",
        blocks: [
          {
            id: "template-outfit-full",
            source: "预制",
            title: "全身服装",
            text: "全身或七分身构图，服装轮廓完整，材质纹理清晰。",
          },
          {
            id: "template-outfit-material",
            source: "本地",
            title: "材质补充",
            text: "补充袖口、衣摆和配饰，避免复杂道具抢占主体。",
          },
        ],
      },
    ],
  },
];

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

function normalizeTrainingTemplateLookupId(templateId: string) {
  return templateId === TRAINING_COMPAT_TEMPLATE_BASE_ID || templateId === TRAINING_DEFAULT_TEMPLATE_KEY
    ? TRAINING_FALLBACK_TEMPLATE_BASE_ID
    : templateId;
}

function normalizeFallbackTrainingTemplate(template: LoraTrainingTemplate): LoraTrainingTemplate {
  const id = normalizeTrainingTemplateLookupId(template.id);
  return id === template.id ? template : { ...template, id };
}

function findFallbackTrainingTemplate(templates: LoraTrainingTemplate[], templateId: string) {
  const lookupId = normalizeTrainingTemplateLookupId(templateId);
  return templates.find((item) => item.id === lookupId || item.title === templateId);
}

function findFallbackTrainingTemplateIndex(templates: LoraTrainingTemplate[], templateId: string) {
  const lookupId = normalizeTrainingTemplateLookupId(templateId);
  return templates.findIndex((item) => item.id === lookupId || item.title === templateId);
}

function mapTemplateSnapshot(snapshot: Awaited<ReturnType<typeof getLegacyTrainingTemplateSnapshot>>): LoraTrainingTemplate {
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
      return (parsed as LoraTrainingTemplate[]).map(normalizeFallbackTrainingTemplate);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaults = buildDefaultFallbackTrainingTemplates();
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

function nextTemplateSectionOrdinal(sections: LoraTrainingTemplate["sections"], prefix: string) {
  const ordinals = sections
    .map((section) => (section.id.startsWith(prefix) ? Number(section.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function createDraftTemplateSection(
  current: LoraTrainingTemplate["sections"],
  templateId: string,
  titleSuffix: string,
): LoraTrainingTemplate["sections"][number] {
  const source = current[0];
  const sectionOrdinal = nextTemplateSectionOrdinal(current, `${templateId}-section-`);
  const sectionId = `${templateId}-section-${sectionOrdinal}`;
  const draftIndex = current.length + 1;
  return source ? {
    ...source,
    id: sectionId,
    title: `新模板小节 ${draftIndex}${titleSuffix}`,
    enabled: true,
    scenePreview: "补充这个模板小节的训练场景摘要。",
  } : {
    id: sectionId,
    title: `新模板小节 ${draftIndex}${titleSuffix}`,
    enabled: true,
    blockCount: 1,
    blocks: [
      {
        id: `${sectionId}-block-1`,
        source: "本地",
        title: "本地场景描述",
        text: "补充这个模板小节的训练场景描述。",
      },
    ],
    resolvedScene: "补充这个模板小节的训练场景描述。",
    scenePreview: "补充这个模板小节的训练场景摘要。",
  };
}

function buildDefaultFallbackTrainingTemplates() {
  return DEFAULT_FALLBACK_TRAINING_TEMPLATES.map((template) => ({
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => ({ ...block })),
    })),
  }));
}

export async function listManagedTrainingTemplates() {
  const fallbackTemplates = await readFallbackTrainingTemplates().catch(() => [] as LoraTrainingTemplate[]);
  const orderedTemplateIds = await listTrainingTemplateOrderIds().catch(() => []);

  try {
    const summaries = await listLegacyTrainingTemplates();
    const snapshots = await Promise.all(summaries.map((template) => getLegacyTrainingTemplateSnapshot({ id: template.id })));
    const databaseTemplates = snapshots.map(mapTemplateSnapshot);
    const databaseIds = new Set(databaseTemplates.map((template) => template.id));
    return orderTrainingTemplatesByStoredIds([
      ...fallbackTemplates.filter((template) => !databaseIds.has(template.id)),
      ...databaseTemplates,
    ], orderedTemplateIds);
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) throw error;
    return orderTrainingTemplatesByStoredIds(fallbackTemplates, orderedTemplateIds);
  }
}

export async function getManagedTrainingTemplate(templateId: string) {
  const fallbackTemplates = await readFallbackTrainingTemplates().catch(() => [] as LoraTrainingTemplate[]);
  const fallbackTemplate = findFallbackTrainingTemplate(fallbackTemplates, templateId);
  if (fallbackTemplate) {
    return fallbackTemplate;
  }

  try {
    const snapshot = await getLegacyTrainingTemplateSnapshot({ id: templateId });
    return mapTemplateSnapshot(snapshot);
  } catch (error) {
    const mapped = mapLegacyTrainingSectionTemplateError(error);
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const template = findFallbackTrainingTemplate(fallbackTemplates, templateId);
    if (!template) {
      throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
    }
    return template;
  }
}

export async function createManagedTrainingTemplate(input: unknown) {
  const parsed = parseTrainingTemplateInput(input);

  try {
    const snapshot = await createLegacyTrainingTemplate(normalizeTemplatePayload(parsed));
    return mapTemplateSnapshot(snapshot);
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      const mapped = mapLegacyTrainingSectionTemplateError(error);
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
  const fallbackIndex = findFallbackTrainingTemplateIndex(fallbackTemplates, templateId);

  if (fallbackIndex !== -1) {
    const fallbackTemplateId = fallbackTemplates[fallbackIndex].id;
    const updated: LoraTrainingTemplate = {
      ...fallbackTemplates[fallbackIndex],
      title: parsed.title,
      updatedAt: nextTemplateUpdatedAt(),
      description: parsed.description ?? "",
      imageGuidance: parsed.imageGuidance ?? "",
      captionGuidance: parsed.captionGuidance ?? "",
      sectionCount: parsed.sections.length,
      sections: parsed.sections.map((section, index) => ({
        id: section.id ?? `${fallbackTemplateId}-section-${index + 1}`,
        title: section.title,
        enabled: section.enabled,
        blockCount: section.blockCount ?? section.blocks.length,
        blocks: section.blocks.map((block, blockIndex) => ({
          id: block.id ?? `${fallbackTemplateId}-section-${index + 1}-block-${blockIndex + 1}`,
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
    const snapshot = await updateLegacyTrainingTemplate(templateId, normalizeTemplatePayload(parsed));
    return mapTemplateSnapshot(snapshot);
  } catch (error) {
    if (!shouldUseTrainingTemplateFileFallback(error)) {
      const mapped = mapLegacyTrainingSectionTemplateError(error);
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const templates = await readFallbackTrainingTemplates();
    const currentIndex = findFallbackTrainingTemplateIndex(templates, templateId);
    if (currentIndex === -1) {
      throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
    }
    const fallbackTemplateId = templates[currentIndex].id;
    const updated: LoraTrainingTemplate = {
      ...templates[currentIndex],
      title: parsed.title,
      updatedAt: nextTemplateUpdatedAt(),
      description: parsed.description ?? "",
      imageGuidance: parsed.imageGuidance ?? "",
      captionGuidance: parsed.captionGuidance ?? "",
      sectionCount: parsed.sections.length,
      sections: parsed.sections.map((section, index) => ({
        id: section.id ?? `${fallbackTemplateId}-section-${index + 1}`,
        title: section.title,
        enabled: section.enabled,
        blockCount: section.blockCount ?? section.blocks.length,
        blocks: section.blocks.map((block, blockIndex) => ({
          id: block.id ?? `${fallbackTemplateId}-section-${index + 1}-block-${blockIndex + 1}`,
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
  const fallbackIndex = findFallbackTrainingTemplateIndex(fallbackTemplates, templateId);

  if (fallbackIndex !== -1) {
    const next = [...fallbackTemplates];
    next.splice(fallbackIndex, 1);
    await writeFallbackTrainingTemplates(next);
    return { success: true };
  }

  try {
    const snapshot = await getLegacyTrainingTemplateSnapshot({ id: templateId });
    await upsertLegacyTrainingTemplates([{
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
      const mapped = mapLegacyTrainingSectionTemplateError(error);
      throw new TrainingTemplateServiceError(mapped.message, mapped.status, mapped.details);
    }
    const currentIndex = findFallbackTrainingTemplateIndex(fallbackTemplates, templateId);
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

export async function createManagedTrainingTemplateSection(templateId: string, input: unknown = {}) {
  const schema = z.object({
    sourceSectionId: z.string().trim().min(1).optional(),
  }).strict();
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template section create request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const current = await getManagedTrainingTemplate(templateId);
  const sourceSectionId = result.data.sourceSectionId?.trim();
  const nextSection = sourceSectionId
    ? (() => {
        const source = current.sections.find((section) => section.id === sourceSectionId);
        if (!source) {
          throw new TrainingTemplateServiceError("Training template section not found", 404, { sourceSectionId, templateId });
        }
        const copyOrdinal = nextTemplateSectionOrdinal(current.sections, `${source.id}-copy-`);
        return {
          ...source,
          id: `${source.id}-copy-${copyOrdinal}`,
          title: `${source.title} (副本)`,
        };
      })()
    : createDraftTemplateSection(current.sections, templateId, "");

  const nextSections = sourceSectionId
    ? (() => {
        const sourceIndex = current.sections.findIndex((section) => section.id === sourceSectionId);
        if (sourceIndex === -1) return [...current.sections, nextSection];
        return [
          ...current.sections.slice(0, sourceIndex + 1),
          nextSection,
          ...current.sections.slice(sourceIndex + 1),
        ];
      })()
    : [...current.sections, nextSection];

  return updateManagedTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections: nextSections,
  });
}

export async function deleteManagedTrainingTemplateSection(templateId: string, sectionId: string) {
  const current = await getManagedTrainingTemplate(templateId);
  if (!current.sections.some((section) => section.id === sectionId)) {
    throw new TrainingTemplateServiceError("Training template section not found", 404, { templateId, sectionId });
  }

  return updateManagedTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections: current.sections.filter((section) => section.id !== sectionId),
  });
}

export async function reorderManagedTrainingTemplateSections(templateId: string, input: unknown) {
  const schema = z.object({
    orderedSectionIds: z.array(z.string().trim().min(1)).min(1),
  }).strict();
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template reorder request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const current = await getManagedTrainingTemplate(templateId);
  const orderedSectionIds = [...new Set(result.data.orderedSectionIds)];
  if (orderedSectionIds.length !== current.sections.length) {
    throw new TrainingTemplateServiceError("orderedSectionIds must include every template section exactly once", 400, {
      expected: current.sections.length,
      actual: orderedSectionIds.length,
    });
  }

  const sectionMap = new Map(current.sections.map((section) => [section.id, section]));
  const missingSectionIds = orderedSectionIds.filter((sectionId) => !sectionMap.has(sectionId));
  if (missingSectionIds.length > 0) {
    throw new TrainingTemplateServiceError("Training template section not found", 404, { missingSectionIds, templateId });
  }

  const nextSections = orderedSectionIds.map((sectionId) => sectionMap.get(sectionId)!);
  return updateManagedTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections: nextSections,
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
