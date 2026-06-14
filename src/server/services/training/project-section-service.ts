import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LoraTrainingSection, LoraTrainingSectionBlock } from "@/app/design-demos/data/lora-training-types";
import { z } from "zod";

const TRAINING_PROJECT_SECTION_OVERRIDE_PATH = join(process.cwd(), "data", "training-project-section-overrides.json");
const TRAINING_PROJECT_SECTION_COLLECTION_PATH = join(process.cwd(), "data", "training-project-sections.json");

const sectionBlockSchema = z.object({
  id: z.string().trim().min(1),
  source: z.enum(["预制", "本地"]),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
});

const projectSectionInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  blocks: z.array(sectionBlockSchema).min(1),
  resolvedScene: z.string().trim().min(1).max(20_000),
  imagePrompt: z.string().trim().min(1).max(20_000),
});

export type TrainingProjectSectionOverride = {
  projectId: string;
  sectionId: string;
  title: string;
  enabled: boolean;
  blocks: LoraTrainingSectionBlock[];
  resolvedScene: string;
  imagePrompt: string;
  updatedAt: string;
};

type TrainingProjectSectionOverrideMap = Record<string, TrainingProjectSectionOverride>;
type TrainingProjectSectionCollectionMap = Record<string, LoraTrainingSection[]>;

export class TrainingProjectSectionServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectSectionServiceError";
    this.status = status;
    this.details = details;
  }
}

function sectionOverrideKey(projectId: string, sectionId: string) {
  return `${projectId}:${sectionId}`;
}

function formatSectionUpdatedAt(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function readSectionOverrides() {
  try {
    const raw = await readFile(TRAINING_PROJECT_SECTION_OVERRIDE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TrainingProjectSectionOverrideMap;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return {} satisfies TrainingProjectSectionOverrideMap;
}

async function writeSectionOverrides(overrides: TrainingProjectSectionOverrideMap) {
  await mkdir(dirname(TRAINING_PROJECT_SECTION_OVERRIDE_PATH), { recursive: true });
  await writeFile(TRAINING_PROJECT_SECTION_OVERRIDE_PATH, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

async function readSectionCollections() {
  try {
    const raw = await readFile(TRAINING_PROJECT_SECTION_COLLECTION_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TrainingProjectSectionCollectionMap;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return {} satisfies TrainingProjectSectionCollectionMap;
}

async function writeSectionCollections(collections: TrainingProjectSectionCollectionMap) {
  await mkdir(dirname(TRAINING_PROJECT_SECTION_COLLECTION_PATH), { recursive: true });
  await writeFile(TRAINING_PROJECT_SECTION_COLLECTION_PATH, `${JSON.stringify(collections, null, 2)}\n`, "utf8");
}

function parseSectionInput(input: unknown) {
  const result = projectSectionInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingProjectSectionServiceError("Invalid training project section request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

const sectionReorderSchema = z.object({
  orderedSectionIds: z.array(z.string().trim().min(1)).min(1),
});

export async function listTrainingProjectSectionOverrides() {
  return readSectionOverrides();
}

export async function listTrainingProjectSectionCollections() {
  return readSectionCollections();
}

export async function getTrainingProjectSectionOverride(projectId: string, sectionId: string) {
  const overrides = await readSectionOverrides();
  return overrides[sectionOverrideKey(projectId, sectionId)] ?? null;
}

export async function upsertTrainingProjectSectionOverride(projectId: string, sectionId: string, input: unknown) {
  if (!projectId.trim()) {
    throw new TrainingProjectSectionServiceError("projectId is required", 400);
  }
  if (!sectionId.trim()) {
    throw new TrainingProjectSectionServiceError("sectionId is required", 400);
  }

  const parsed = parseSectionInput(input);
  const overrides = await readSectionOverrides();
  const key = sectionOverrideKey(projectId, sectionId);

  const next: TrainingProjectSectionOverride = {
    projectId,
    sectionId,
    title: parsed.title,
    enabled: parsed.enabled,
    blocks: parsed.blocks,
    resolvedScene: parsed.resolvedScene,
    imagePrompt: parsed.imagePrompt,
    updatedAt: formatSectionUpdatedAt(),
  };

  await writeSectionOverrides({
    ...overrides,
    [key]: next,
  });

  return next;
}

function buildProjectSections(baseSections: LoraTrainingSection[], overrideSections: LoraTrainingSection[] | undefined) {
  return overrideSections ? overrideSections : baseSections;
}

function nextProjectSectionCopyNumber(sections: LoraTrainingSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function nextProjectSectionDraftNumber(sections: LoraTrainingSection[]) {
  const draftPrefix = "new-section-";
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

async function saveProjectSections(projectId: string, sections: LoraTrainingSection[]) {
  const collections = await readSectionCollections();
  await writeSectionCollections({
    ...collections,
    [projectId]: sections,
  });
}

export async function setTrainingProjectSectionCollection(projectId: string, sections: LoraTrainingSection[]) {
  if (!projectId.trim()) {
    throw new TrainingProjectSectionServiceError("projectId is required", 400);
  }
  await saveProjectSections(projectId, sections);
  return sections;
}

export async function upsertTrainingProjectSection(
  projectId: string,
  sectionId: string,
  input: unknown,
  baseSections: LoraTrainingSection[],
) {
  const parsed = parseSectionInput(input);
  const collections = await readSectionCollections();
  const sections = buildProjectSections(baseSections, collections[projectId]);
  const sectionIndex = sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex === -1) {
    throw new TrainingProjectSectionServiceError("Training project section not found", 404, { projectId, sectionId });
  }

  const updatedSection: LoraTrainingSection = {
    ...sections[sectionIndex],
    title: parsed.title,
    enabled: parsed.enabled,
    blocks: parsed.blocks,
    resolvedScene: parsed.resolvedScene,
    imagePrompt: parsed.imagePrompt,
    updatedAt: formatSectionUpdatedAt(),
  };
  const nextSections = [...sections];
  nextSections[sectionIndex] = updatedSection;
  await saveProjectSections(projectId, nextSections);
  return updatedSection;
}

export async function createTrainingProjectSection(projectId: string, baseSections: LoraTrainingSection[]) {
  const collections = await readSectionCollections();
  const sections = buildProjectSections(baseSections, collections[projectId]);
  const source = sections[0];
  const draftNumber = nextProjectSectionDraftNumber(sections);
  const draftId = `new-section-${draftNumber}`;
  const draftIndex = sections.length + 1;
  const draft: LoraTrainingSection = source ? {
    ...source,
    id: draftId,
    title: `新小节 ${draftIndex}`,
    updatedAt: formatSectionUpdatedAt(),
    images: [],
    resultStatus: "pending",
  } : {
    id: draftId,
    title: `新小节 ${draftIndex}`,
    enabled: true,
    updatedAt: formatSectionUpdatedAt(),
    blocks: [
      { id: "draft-local-block", source: "本地", title: "本地场景描述", text: "补充这个小节的训练场景描述。" },
    ],
    resolvedScene: "补充这个小节的训练场景描述。",
    imagePrompt: "生成干净、可训练的角色样本。",
    images: [],
    resultStatus: "pending",
  };
  const nextSections = [...sections, draft];
  await saveProjectSections(projectId, nextSections);
  return draft;
}

export async function copyTrainingProjectSection(projectId: string, sectionId: string, baseSections: LoraTrainingSection[]) {
  const collections = await readSectionCollections();
  const sections = buildProjectSections(baseSections, collections[projectId]);
  const sourceIndex = sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex === -1) {
    throw new TrainingProjectSectionServiceError("Training project section not found", 404, { projectId, sectionId });
  }
  const source = sections[sourceIndex];
  const copyNumber = nextProjectSectionCopyNumber(sections, sectionId);
  const copy: LoraTrainingSection = {
    ...source,
    id: `${sectionId}-copy-${copyNumber}`,
    title: `${source.title} (副本)`,
    updatedAt: formatSectionUpdatedAt(),
  };
  const nextSections = [
    ...sections.slice(0, sourceIndex + 1),
    copy,
    ...sections.slice(sourceIndex + 1),
  ];
  await saveProjectSections(projectId, nextSections);
  return copy;
}

export async function deleteTrainingProjectSection(projectId: string, sectionId: string, baseSections: LoraTrainingSection[]) {
  const collections = await readSectionCollections();
  const sections = buildProjectSections(baseSections, collections[projectId]);
  if (!sections.some((section) => section.id === sectionId)) {
    throw new TrainingProjectSectionServiceError("Training project section not found", 404, { projectId, sectionId });
  }
  const nextSections = sections.filter((section) => section.id !== sectionId);
  await saveProjectSections(projectId, nextSections);
  return { success: true };
}

export async function reorderTrainingProjectSections(projectId: string, input: unknown, baseSections: LoraTrainingSection[]) {
  const result = sectionReorderSchema.safeParse(input);
  if (!result.success) {
    throw new TrainingProjectSectionServiceError("Invalid training project section reorder request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const collections = await readSectionCollections();
  const sections = buildProjectSections(baseSections, collections[projectId]);
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const orderedSections = result.data.orderedSectionIds
    .map((id) => sectionMap.get(id))
    .filter((section): section is LoraTrainingSection => Boolean(section));

  if (orderedSections.length !== sections.length) {
    throw new TrainingProjectSectionServiceError("Training project section reorder is incomplete", 400, {
      expected: sections.length,
      received: orderedSections.length,
    });
  }

  await saveProjectSections(projectId, orderedSections);
  return orderedSections;
}

export function mapTrainingProjectSectionError(error: unknown) {
  if (error instanceof TrainingProjectSectionServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project section error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
