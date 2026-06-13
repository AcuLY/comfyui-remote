import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LoraTrainingSectionBlock } from "@/app/design-demos/data/lora-training-types";
import { z } from "zod";

const TRAINING_PROJECT_SECTION_OVERRIDE_PATH = join(process.cwd(), "data", "training-project-section-overrides.json");

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

export async function listTrainingProjectSectionOverrides() {
  return readSectionOverrides();
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
