import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraDecisionStatus,
  CharacterLoraJobStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraPromotionReturnPoint } from "@/server/character-lora-training/contracts";

import {
  ensurePresetCategory,
  mapRejectedPromotionReturnPointToJobPhase,
  mapRejectedPromotionReturnPointToJobStatus,
  resolveUniquePresetSlug,
} from "./helpers";
import { serializeLoraAsset, serializePromotionDecision } from "./serializers";
import {
  BENCHMARK_RUN_SELECT,
  JOB_SUMMARY_SELECT,
  PROMOTION_DECISION_SELECT,
} from "./types";

type LinkedVariantRef = {
  variantId: string;
  sortOrder: number;
};

function normalizeLinkedVariantRefs(linkedVariants: unknown): LinkedVariantRef[] {
  if (linkedVariants == null) return [];
  if (!Array.isArray(linkedVariants)) {
    throw new Error("linkedVariants must be an array");
  }

  const seen = new Set<string>();
  const refs: LinkedVariantRef[] = [];

  linkedVariants.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const record = entry as {
      variantId?: unknown;
      linkedVariantId?: unknown;
      sortOrder?: unknown;
    };
    const variantId = typeof record.variantId === "string"
      ? record.variantId
      : typeof record.linkedVariantId === "string"
        ? record.linkedVariantId
        : null;
    if (!variantId || seen.has(variantId)) return;
    seen.add(variantId);

    refs.push({
      variantId,
      sortOrder: typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
        ? record.sortOrder
        : index,
    });
  });

  return refs;
}

export async function upsertCharacterLoraAsset(input: {
  name: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  size?: bigint | number | null;
  source?: string | null;
  triggerWords?: string | null;
  notes?: string | null;
}) {
  const asset = await db.loraAsset.upsert({
    where: { absolutePath: input.absolutePath },
    update: {
      name: input.name,
      modelType: "lora",
      category: "character",
      fileName: input.fileName,
      relativePath: input.relativePath,
      size: input.size ?? null,
      source: input.source ?? "character-lora-training",
      triggerWords: input.triggerWords ?? null,
      notes: input.notes ?? null,
    },
    create: {
      name: input.name,
      modelType: "lora",
      category: "character",
      fileName: input.fileName,
      absolutePath: input.absolutePath,
      relativePath: input.relativePath,
      size: input.size ?? null,
      source: input.source ?? "character-lora-training",
      triggerWords: input.triggerWords ?? null,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      name: true,
      fileName: true,
      absolutePath: true,
      relativePath: true,
      size: true,
      category: true,
      triggerWords: true,
      notes: true,
      uploadedAt: true,
      updatedAt: true,
    },
  });

  return serializeLoraAsset(asset);
}

export async function getLoraAssetById(loraAssetId: string) {
  const asset = await db.loraAsset.findUnique({
    where: { id: loraAssetId },
    select: {
      id: true,
      name: true,
      fileName: true,
      absolutePath: true,
      relativePath: true,
      size: true,
      category: true,
      triggerWords: true,
      notes: true,
      uploadedAt: true,
      updatedAt: true,
    },
  });

  return asset ? serializeLoraAsset(asset) : null;
}

export async function createCharacterLoraPromotionDecisionInRepository(input: {
  benchmarkRunId: string;
  status: "approved" | "rejected";
  selectedLoraAssetId: string;
  selectedCheckpoint?: string | null;
  defaultRecommendedWeight: number;
  perVariantWeightOverrides?: Prisma.InputJsonValue | null;
  variantPromptDrafts: Prisma.InputJsonValue;
  decisionReason?: string | null;
  rejectedReturnPoint?: CharacterLoraPromotionReturnPoint | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const benchmark = await tx.characterLoraBenchmarkRun.findUnique({
      where: { id: input.benchmarkRunId },
      select: { id: true, jobId: true, status: true, resultSummary: true },
    });
    if (!benchmark) return null;

    const rejectedReturnPoint = input.status === "rejected"
      ? input.rejectedReturnPoint ?? "weightSelection"
      : null;

    const decision = await tx.characterLoraPromotionDecision.create({
      data: {
        jobId: benchmark.jobId,
        benchmarkRunId: benchmark.id,
        status: input.status === "approved"
          ? CharacterLoraDecisionStatus.approved
          : CharacterLoraDecisionStatus.rejected,
        selectedLoraAssetId: input.selectedLoraAssetId,
        selectedCheckpoint: input.selectedCheckpoint ?? null,
        defaultRecommendedWeight: input.defaultRecommendedWeight,
        perVariantWeightOverrides: input.perVariantWeightOverrides ?? Prisma.DbNull,
        variantPromptDrafts: input.variantPromptDrafts,
        decisionReason: input.decisionReason ?? null,
        rejectedReturnPoint,
        decidedAt: new Date(),
      },
      select: PROMOTION_DECISION_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: benchmark.jobId },
      data: {
        status: input.status === "approved"
          ? CharacterLoraJobStatus.promotion_ready
          : mapRejectedPromotionReturnPointToJobStatus(rejectedReturnPoint ?? "weightSelection"),
        phase: input.status === "approved"
          ? "promotion"
          : mapRejectedPromotionReturnPointToJobPhase(rejectedReturnPoint ?? "weightSelection"),
        failureSummary: input.status === "rejected" ? input.decisionReason ?? null : null,
      },
      select: { id: true },
    });

    return decision;
  });

  return result ? serializePromotionDecision(result) : null;
}

export async function listCharacterLoraPromotionDecisions(jobId: string) {
  const decisions = await db.characterLoraPromotionDecision.findMany({
    where: { jobId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: PROMOTION_DECISION_SELECT,
  });

  return decisions.map(serializePromotionDecision);
}

export async function getCharacterLoraPromotionDecisionForPromotion(decisionId: string) {
  return db.characterLoraPromotionDecision.findUnique({
    where: { id: decisionId },
    select: {
      id: true,
      jobId: true,
      benchmarkRunId: true,
      status: true,
      selectedLoraAssetId: true,
      selectedCheckpoint: true,
      defaultRecommendedWeight: true,
      perVariantWeightOverrides: true,
      variantPromptDrafts: true,
      decisionReason: true,
      promotedPresetId: true,
      benchmarkRun: {
        select: {
          ...BENCHMARK_RUN_SELECT,
          trainingRun: {
            select: {
              datasetRevisionId: true,
              finalSha256: true,
              finalSafetensorsArtifactId: true,
            },
          },
        },
      },
      job: { select: JOB_SUMMARY_SELECT },
    },
  });
}

export async function promoteCharacterLoraDecisionInRepository(input: {
  decisionId: string;
  categoryName: string;
  categorySlug: string;
  presetName: string;
  presetSlug: string;
  presetNotes: string;
  variants: Array<{
    name: string;
    slug: string;
    prompt: string;
    negativePrompt?: string | null;
    lora1: Prisma.InputJsonValue;
    lora2: Prisma.InputJsonValue;
    linkedVariants?: Prisma.InputJsonValue | null;
    sortOrder: number;
  }>;
  overwriteExisting?: boolean;
  reportArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata?: Prisma.InputJsonValue | null;
  };
}) {
  const result = await db.$transaction(async (tx) => {
    const decision = await tx.characterLoraPromotionDecision.findUnique({
      where: { id: input.decisionId },
      select: { id: true, jobId: true, status: true },
    });
    if (!decision) return null;

    const category = await ensurePresetCategory(tx, {
      name: input.categoryName,
      slug: input.categorySlug,
      icon: "UserRound",
      color: "78 50% 55%",
    });

    const presetSlug = input.overwriteExisting
      ? input.presetSlug
      : await resolveUniquePresetSlug(tx, category.id, input.presetSlug);
    const existingPreset = input.overwriteExisting
      ? await tx.preset.findUnique({
          where: { categoryId_slug: { categoryId: category.id, slug: presetSlug } },
          select: { id: true },
        })
      : null;

    const existingVariantIds = existingPreset
      ? (await tx.presetVariant.findMany({
          where: { presetId: existingPreset.id },
          select: { id: true },
        })).map((variant) => variant.id)
      : [];

    if (existingVariantIds.length > 0) {
      await tx.presetVariantLink.deleteMany({
        where: {
          OR: [
            { sourceVariantId: { in: existingVariantIds } },
            { linkedVariantId: { in: existingVariantIds } },
          ],
        },
      });
    }

    const preset = existingPreset
      ? await tx.preset.update({
          where: { id: existingPreset.id },
          data: {
            name: input.presetName,
            notes: input.presetNotes,
            isActive: true,
            variants: { deleteMany: {} },
          },
          select: { id: true },
        })
      : await tx.preset.create({
          data: {
            categoryId: category.id,
            name: input.presetName,
            slug: presetSlug,
            notes: input.presetNotes,
            isActive: true,
          },
          select: { id: true },
        });

    for (const variant of input.variants) {
      const createdVariant = await tx.presetVariant.create({
        data: {
          presetId: preset.id,
          name: variant.name,
          slug: variant.slug,
          prompt: variant.prompt,
          negativePrompt: variant.negativePrompt ?? null,
          lora1: variant.lora1,
          lora2: variant.lora2,
          linkedVariants: Prisma.DbNull,
          sortOrder: variant.sortOrder,
          isActive: true,
        },
        select: { id: true },
      });

      const linkedRefs = normalizeLinkedVariantRefs(variant.linkedVariants);
      if (linkedRefs.length > 0) {
        await tx.presetVariantLink.createMany({
          data: linkedRefs.map((ref) => ({
            sourceVariantId: createdVariant.id,
            linkedVariantId: ref.variantId,
            sortOrder: ref.sortOrder,
          })),
        });
      }
    }

    const reportArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: decision.jobId,
        kind: "promotion_report",
        relativePath: input.reportArtifact.relativePath,
        absolutePath: input.reportArtifact.absolutePath,
        sha256: input.reportArtifact.sha256,
        byteSize: input.reportArtifact.byteSize,
        mimeType: "application/json",
        redactionLevel: "path_only",
        metadata: input.reportArtifact.metadata ?? Prisma.DbNull,
      },
      select: { id: true },
    });

    const updatedDecision = await tx.characterLoraPromotionDecision.update({
      where: { id: decision.id },
      data: {
        status: CharacterLoraDecisionStatus.promoted,
        promotedCategoryId: category.id,
        promotedPresetId: preset.id,
        reportArtifactId: reportArtifact.id,
        promotedAt: new Date(),
      },
      select: PROMOTION_DECISION_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: decision.jobId },
      data: {
        status: CharacterLoraJobStatus.promoted,
        phase: "promotion",
        promotedPresetId: preset.id,
        failureSummary: null,
      },
      select: { id: true },
    });

    return { decision: updatedDecision, categoryId: category.id, presetId: preset.id };
  });

  return result
    ? {
        decision: serializePromotionDecision(result.decision),
        categoryId: result.categoryId,
        presetId: result.presetId,
      }
    : null;
}

export async function findCharacterLoraPromotionLinkedVariant(kind: "halfUndressed" | "naked") {
  const terms = kind === "halfUndressed" ? ["半脱"] : ["全裸", "裸", "nude", "naked"];
  for (const term of terms) {
    const variant = await db.presetVariant.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term } },
          { slug: { contains: term } },
          { preset: { name: { contains: term } } },
          { preset: { slug: { contains: term } } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: { id: true, presetId: true, name: true, slug: true },
    });
    if (variant) return variant;
  }

  return null;
}

export async function findBreastSizeSliderLoraAsset() {
  return db.loraAsset.findFirst({
    where: {
      OR: [
        { name: { contains: "Breast Size Slider" } },
        { fileName: { contains: "Breast Size Slider" } },
        { relativePath: { contains: "Breast Size Slider" } },
        { name: { contains: "breast" } },
        { fileName: { contains: "breast" } },
        { relativePath: { contains: "breast" } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, name: true, relativePath: true },
  });
}
