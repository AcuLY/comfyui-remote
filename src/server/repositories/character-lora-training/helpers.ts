import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
} from "@/generated/prisma/enums";
import { ORDINARY_PRESET_CATEGORY_TYPE } from "@/lib/actions/preset-resource-scope";
import { detectProvider } from "@/lib/prisma";
import type { CharacterLoraTrainingCompleteOutput } from "@/server/character-lora-training/contracts";

export function ciContains(value: string) {
  return detectProvider() === "postgresql"
    ? { contains: value, mode: "insensitive" as const }
    : { contains: value };
}

export function slugifyForRepository(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function cloneJsonValueForRepository(value: unknown) {
  return value == null
    ? Prisma.DbNull
    : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function readJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    : {};
}

export function asJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { value };
}

export function truncateWithFallback(value: string, maxLength: number, fallback: string) {
  const normalized = value.trim();
  return (normalized || fallback).slice(0, maxLength);
}

export function appendNumberedSuffix(base: string, index: number, maxLength: number, separator: string) {
  const suffix = index === 0 ? "" : `${separator}${index + 1}`;
  return `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isTemporaryBenchmarkResourceNotes(notes: string | null | undefined) {
  if (!notes) return false;

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }

    const record = parsed as Record<string, unknown>;
    return record.temporary === true && record.purpose === "character_lora_benchmark";
  } catch {
    return false;
  }
}

export function extractTargetSteps(config: Prisma.InputJsonValue) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const ordinary = (config as Record<string, unknown>).ordinary;
  if (!ordinary || typeof ordinary !== "object" || Array.isArray(ordinary)) {
    return null;
  }

  const targetSteps = (ordinary as Record<string, unknown>).targetSteps;
  return typeof targetSteps === "number" && Number.isInteger(targetSteps) ? targetSteps : null;
}

export function hasCancelRequested(value: Prisma.JsonValue | Prisma.InputJsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (value as Record<string, unknown>).cancelRequested === true;
}

export function extractCompletionStep(output: CharacterLoraTrainingCompleteOutput) {
  const lastCheckpoint = [...output.checkpoints].sort((a, b) => b.step - a.step)[0];
  return lastCheckpoint?.step ?? null;
}

export function deriveActiveSectionStatus(input: {
  keepCount: number;
  rejectCount: number;
  pendingCount: number;
}) {
  if (input.pendingCount > 0) {
    return "reviewing";
  }

  if (input.keepCount > 0 || input.rejectCount > 0) {
    return "reviewed";
  }

  return "draft";
}

export function buildDefaultCaption(triggerToken: string, sectionName: string | null, visualPrompt: string) {
  const pieces = [
    triggerToken,
    sectionName ? sectionName.toLowerCase() : null,
    visualPrompt.replace(/\s+/g, " ").slice(0, 180),
  ].filter((piece): piece is string => Boolean(piece));

  return pieces.join(", ");
}

export async function refreshSectionCounts(
  tx: Prisma.TransactionClient,
  sectionIds: string[],
) {
  for (const sectionId of sectionIds) {
    const [section, keepCount, rejectCount, pendingCount] = await Promise.all([
      tx.characterLoraJobSection.findUnique({
        where: { id: sectionId },
        select: { status: true },
      }),
      tx.characterLoraCandidateImage.count({
        where: { sectionId, reviewStatus: CharacterLoraImageReviewStatus.keep },
      }),
      tx.characterLoraCandidateImage.count({
        where: { sectionId, reviewStatus: CharacterLoraImageReviewStatus.reject },
      }),
      tx.characterLoraCandidateImage.count({
        where: { sectionId, reviewStatus: CharacterLoraImageReviewStatus.pending },
      }),
    ]);

    if (!section) {
      continue;
    }

    await tx.characterLoraJobSection.update({
      where: { id: sectionId },
      data: {
        keepCount,
        rejectCount,
        pendingCount,
        ...(section.status === "paused"
          ? {}
          : { status: deriveActiveSectionStatus({ keepCount, rejectCount, pendingCount }) }),
      },
      select: { id: true },
    });
  }
}

export function countWorkerTasks(tasks: Array<{ status: string }>) {
  return tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
}

export function latestIsoDate(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (timestamps.length === 0) {
    return null;
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

export function oldestIsoDate(values: string[]) {
  const timestamps = values
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (timestamps.length === 0) {
    return null;
  }
  return new Date(Math.min(...timestamps)).toISOString();
}

export async function resolveUniquePresetSlug(
  tx: Prisma.TransactionClient,
  categoryId: string,
  baseSlug: string,
) {
  const normalizedBase = slugifyForRepository(baseSlug, "preset");

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const slug = suffix === 1 ? normalizedBase : `${normalizedBase}-${suffix}`;
    const existing = await tx.preset.findUnique({
      where: { categoryId_slug: { categoryId, slug } },
      select: { id: true },
    });
    if (!existing) return slug;
  }

  throw new Error("PRESET_SLUG_EXHAUSTED");
}

export async function resolveUniqueProjectSlugForRepository(
  tx: Prisma.TransactionClient,
  title: string,
) {
  const normalizedBase = slugifyForRepository(title, "project");

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const slug = suffix === 1 ? normalizedBase : `${normalizedBase}-${suffix}`;
    const existing = await tx.project.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }

  throw new Error("PROJECT_SLUG_EXHAUSTED");
}

const SECTION_TEMPLATE_KEY_MAX_LENGTH = 96;
const SECTION_TEMPLATE_NAME_MAX_LENGTH = 160;

export async function findAvailableSectionTemplateKey(
  client: Prisma.TransactionClient,
  preferredKey: string,
) {
  const baseKey = truncateWithFallback(preferredKey, SECTION_TEMPLATE_KEY_MAX_LENGTH, "section_template_copy");

  for (let index = 0; index <= 100; index += 1) {
    const candidate = appendNumberedSuffix(baseKey, index, SECTION_TEMPLATE_KEY_MAX_LENGTH, "_");
    const existing = await client.characterLoraSectionTemplate.findUnique({
      where: { key: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return appendNumberedSuffix(baseKey, Date.now() % 1_000_000, SECTION_TEMPLATE_KEY_MAX_LENGTH, "_");
}

export async function findAvailableSectionTemplateName(
  client: Prisma.TransactionClient,
  preferredName: string,
) {
  const baseName = truncateWithFallback(preferredName, SECTION_TEMPLATE_NAME_MAX_LENGTH, "Section Template Copy");

  for (let index = 0; index <= 100; index += 1) {
    const candidate = appendNumberedSuffix(baseName, index, SECTION_TEMPLATE_NAME_MAX_LENGTH, " ");
    const existing = await client.characterLoraSectionTemplate.findFirst({
      where: { name: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return appendNumberedSuffix(baseName, Date.now() % 1_000_000, SECTION_TEMPLATE_NAME_MAX_LENGTH, " ");
}

export async function ensurePresetCategory(
  tx: Prisma.TransactionClient,
  input: {
    name: string;
    slug: string;
    icon?: string | null;
    color?: string | null;
  },
) {
  const existing = await tx.presetCategory.findFirst({
    where: {
      OR: [
        { name: input.name },
        { slug: input.slug },
        { slug: "role" },
        { slug: "character" },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  if (existing) {
    return existing;
  }

  return tx.presetCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      icon: input.icon ?? null,
      color: input.color ?? null,
      positivePromptOrder: 10,
      negativePromptOrder: 10,
      lora1Order: 10,
      lora2Order: 10,
      sortOrder: 10,
      type: ORDINARY_PRESET_CATEGORY_TYPE,
    },
    select: { id: true, name: true, slug: true },
  });
}

export function extractTrainingProgressUpdate(progressJson: Prisma.InputJsonValue | undefined) {
  if (!progressJson || typeof progressJson !== "object" || Array.isArray(progressJson)) {
    return {};
  }

  const progress = progressJson as Record<string, unknown>;
  const step = progress.step;
  const targetSteps = progress.targetSteps;
  const loss = progress.loss;
  const etaSeconds = progress.etaSeconds;
  const currentCheckpoint = progress.currentCheckpoint;

  return {
    currentStep: typeof step === "number" && Number.isInteger(step) ? step : undefined,
    targetSteps: typeof targetSteps === "number" && Number.isInteger(targetSteps) ? targetSteps : undefined,
    lossSnapshot: toInputJsonValue({
      step: typeof step === "number" ? step : null,
      loss: typeof loss === "number" ? loss : null,
      etaSeconds: typeof etaSeconds === "number" ? etaSeconds : null,
      currentCheckpoint: typeof currentCheckpoint === "string" ? currentCheckpoint : null,
    }),
  };
}

export function mapRejectedPromotionReturnPointToJobStatus(point: string): CharacterLoraJobStatus {
  switch (point) {
    case "dataset":
    case "caption":
      return CharacterLoraJobStatus.dataset_ready;
    case "prompt":
      return CharacterLoraJobStatus.prompt_pending;
    case "trainingConfig":
      return CharacterLoraJobStatus.trained;
    case "weightSelection":
      return CharacterLoraJobStatus.benchmark_review;
    default:
      return CharacterLoraJobStatus.benchmark_review;
  }
}

export function mapRejectedPromotionReturnPointToJobPhase(point: string) {
  switch (point) {
    case "dataset":
    case "caption":
      return "dataset";
    case "prompt":
      return "prompt_card";
    case "trainingConfig":
      return "training";
    case "weightSelection":
      return "benchmark";
    default:
      return "benchmark";
  }
}
