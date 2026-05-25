import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraImageGenerationTaskPayload } from "@/server/character-lora-training/contracts";

import {
  deriveActiveSectionStatus,
  findAvailableSectionTemplateKey,
  findAvailableSectionTemplateName,
  isUniqueConstraintError,
  refreshSectionCounts,
  toInputJsonValue,
} from "./helpers";
import {
  serializeCandidateImage,
  serializeGenerationRun,
  serializeJobSection,
  serializeSectionTemplate,
  type CharacterLoraSectionTemplateSummary,
} from "./serializers";
import {
  CANDIDATE_IMAGE_SELECT,
  GENERATION_RUN_SUMMARY_SELECT,
  JOB_SECTION_SELECT,
  SECTION_TEMPLATE_SELECT,
  type CharacterLoraCandidateImageListFilters,
  type CharacterLoraJobSectionStatusPatch,
  type CharacterLoraSectionTemplateCopyCreateInput,
  type CharacterLoraSectionTemplateUpsertInput,
} from "./types";

export async function upsertCharacterLoraSectionTemplates(
  templates: CharacterLoraSectionTemplateUpsertInput[],
) {
  const records = await db.$transaction(
    templates.map((template) =>
      db.characterLoraSectionTemplate.upsert({
        where: { key: template.key },
        update: template,
        create: template,
        select: SECTION_TEMPLATE_SELECT,
      }),
    ),
  );

  return records.map(serializeSectionTemplate);
}

export async function getCharacterLoraSectionTemplate(input: { id?: string; key?: string }) {
  const where = input.id
    ? { id: input.id }
    : input.key
      ? { key: input.key }
      : null;

  if (!where) {
    return null;
  }

  const template = await db.characterLoraSectionTemplate.findUnique({
    where,
    select: SECTION_TEMPLATE_SELECT,
  });

  return template ? serializeSectionTemplate(template) : null;
}

export async function createCharacterLoraSectionTemplateCopy(
  input: CharacterLoraSectionTemplateCopyCreateInput,
) {
  let lastUniqueError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const record = await db.$transaction(async (tx) => {
        const key = await findAvailableSectionTemplateKey(tx, input.key);
        const name = await findAvailableSectionTemplateName(tx, input.name);

        return tx.characterLoraSectionTemplate.create({
          data: {
            key,
            name,
            trainingTemplateId: input.trainingTemplateId ?? null,
            description: input.description ?? null,
            angleTag: input.angleTag ?? null,
            promptTemplate: input.promptTemplate,
            negativeTemplate: input.negativeTemplate ?? null,
            targetCandidateCount: input.targetCandidateCount,
            targetKeepCount: input.targetKeepCount,
            sortOrder: input.sortOrder,
            isActive: true,
          },
          select: SECTION_TEMPLATE_SELECT,
        });
      });

      return serializeSectionTemplate(record);
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < 4) {
        lastUniqueError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastUniqueError instanceof Error
    ? lastUniqueError
    : new Error("Failed to create a unique Character LoRA section template copy.");
}

export async function listActiveCharacterLoraSectionTemplates(
  templateKeys?: string[],
  trainingTemplateId?: string | null,
) {
  const templates = await db.characterLoraSectionTemplate.findMany({
    where: {
      isActive: true,
      ...(templateKeys ? { key: { in: templateKeys } } : {}),
      ...(trainingTemplateId !== undefined ? { trainingTemplateId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: SECTION_TEMPLATE_SELECT,
  });

  return templates.map(serializeSectionTemplate);
}

export async function listCharacterLoraJobSections(jobId: string) {
  const sections = await db.characterLoraJobSection.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: JOB_SECTION_SELECT,
  });

  return sections.map(serializeJobSection);
}

export async function instantiateCharacterLoraJobSections(input: {
  jobId: string;
  canonicalVersionId?: string | null;
  promptCardVersionId?: string | null;
  templates: CharacterLoraSectionTemplateSummary[];
}) {
  const result = await db.$transaction(async (tx) => {
    const keys = input.templates.map((template) => template.key);
    const existing = await tx.characterLoraJobSection.findMany({
      where: {
        jobId: input.jobId,
        key: { in: keys },
      },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((section) => section.key));
    const templatesToCreate = input.templates.filter((template) => !existingKeys.has(template.key));

    for (const template of templatesToCreate) {
      await tx.characterLoraJobSection.create({
        data: {
          jobId: input.jobId,
          templateId: template.id,
          key: template.key,
          name: template.name,
          canonicalVersionId: input.canonicalVersionId ?? null,
          promptCardVersionId: input.promptCardVersionId ?? null,
          targetCandidateCount: template.targetCandidateCount,
          targetKeepCount: template.targetKeepCount,
          status: "draft",
          sortOrder: template.sortOrder,
        },
        select: { id: true },
      });
    }

    const lineageUpdateClauses: Prisma.CharacterLoraJobSectionWhereInput[] = [
      ...(input.canonicalVersionId
        ? [
            { canonicalVersionId: null },
            { canonicalVersionId: { not: input.canonicalVersionId } },
          ]
        : []),
      ...(input.promptCardVersionId
        ? [
            { promptCardVersionId: null },
            { promptCardVersionId: { not: input.promptCardVersionId } },
          ]
        : []),
    ];

    if (lineageUpdateClauses.length > 0) {
      await tx.characterLoraJobSection.updateMany({
        where: {
          jobId: input.jobId,
          key: { in: keys },
          OR: lineageUpdateClauses,
        },
        data: {
          ...(input.canonicalVersionId ? { canonicalVersionId: input.canonicalVersionId } : {}),
          ...(input.promptCardVersionId ? { promptCardVersionId: input.promptCardVersionId } : {}),
        },
      });
    }

    const sections = await tx.characterLoraJobSection.findMany({
      where: {
        jobId: input.jobId,
        key: { in: keys },
      },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      select: JOB_SECTION_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.section_generating,
        phase: "sections",
      },
      select: { id: true },
    });

    return {
      sections,
      createdCount: templatesToCreate.length,
      skippedCount: existing.length,
    };
  });

  return {
    sections: result.sections.map(serializeJobSection),
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
  };
}

export async function getCharacterLoraJobSection(sectionId: string) {
  const section = await db.characterLoraJobSection.findUnique({
    where: { id: sectionId },
    select: JOB_SECTION_SELECT,
  });

  return section ? serializeJobSection(section) : null;
}

export async function updateCharacterLoraJobSectionStatus(input: {
  sectionId: string;
  status: CharacterLoraJobSectionStatusPatch;
}) {
  const section = await db.$transaction(async (tx) => {
    const current = await tx.characterLoraJobSection.findUnique({
      where: { id: input.sectionId },
      select: {
        id: true,
        keepCount: true,
        rejectCount: true,
        pendingCount: true,
      },
    });

    if (!current) {
      return null;
    }

    const status =
      input.status === "paused"
        ? "paused"
        : deriveActiveSectionStatus({
            keepCount: current.keepCount,
            rejectCount: current.rejectCount,
            pendingCount: current.pendingCount,
          });

    return tx.characterLoraJobSection.update({
      where: { id: input.sectionId },
      data: { status },
      select: JOB_SECTION_SELECT,
    });
  });

  return section ? serializeJobSection(section) : null;
}

export async function createCharacterLoraSectionGenerationRunWithTask(input: {
  runId: string;
  jobId: string;
  sectionId: string;
  parentRunId?: string | null;
  provider: string;
  hostModel: string;
  imageModel: string;
  hostInstruction: string;
  visualPrompt: string;
  negativePrompt?: string | null;
  toolParams: Prisma.InputJsonValue;
  inputImages: Prisma.InputJsonValue;
  requestArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  };
  taskPayload: CharacterLoraImageGenerationTaskPayload;
}) {
  const result = await db.$transaction(async (tx) => {
    const artifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: input.jobId,
        kind: "provider_payload",
        relativePath: input.requestArtifact.relativePath,
        absolutePath: input.requestArtifact.absolutePath,
        sha256: input.requestArtifact.sha256,
        byteSize: input.requestArtifact.byteSize,
        mimeType: "application/json",
        redactionLevel: "payload_redacted",
        metadata: input.requestArtifact.metadata,
      },
      select: { id: true },
    });

    const run = await tx.characterLoraGenerationRun.create({
      data: {
        id: input.runId,
        jobId: input.jobId,
        sectionId: input.sectionId,
        kind: "section",
        parentRunId: input.parentRunId ?? null,
        status: CharacterLoraRunStatus.queued,
        provider: input.provider,
        hostModel: input.hostModel,
        imageModel: input.imageModel,
        hostInstruction: input.hostInstruction,
        visualPrompt: input.visualPrompt,
        negativePrompt: input.negativePrompt,
        toolParams: input.toolParams,
        inputImages: input.inputImages,
        requestArtifactId: artifact.id,
      },
      select: GENERATION_RUN_SUMMARY_SELECT,
    });

    const task = await tx.characterLoraWorkerTask.create({
      data: {
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.image_generation,
        targetType: "generationRun",
        targetId: run.id,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
      },
      select: { id: true },
    });

    await tx.characterLoraJobSection.update({
      where: { id: input.sectionId },
      data: { status: "generating" },
      select: { id: true },
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.section_generating,
        phase: "sections",
      },
      select: { id: true },
    });

    return {
      run,
      workerTaskId: task.id,
    };
  });

  return {
    ...serializeGenerationRun(result.run),
    workerTaskId: result.workerTaskId,
  };
}

export async function listCharacterLoraCandidateImages(filters: CharacterLoraCandidateImageListFilters) {
  const where: Prisma.CharacterLoraCandidateImageWhereInput = {
    jobId: filters.jobId,
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    ...(filters.generationRunId ? { generationRunId: filters.generationRunId } : {}),
    ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
  };

  const images = await db.characterLoraCandidateImage.findMany({
    where,
    orderBy: [{ sectionId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: CANDIDATE_IMAGE_SELECT,
  });

  return images.map(serializeCandidateImage);
}

export async function getCharacterLoraCandidateImage(imageId: string) {
  const image = await db.characterLoraCandidateImage.findUnique({
    where: { id: imageId },
    select: CANDIDATE_IMAGE_SELECT,
  });

  return image ? serializeCandidateImage(image) : null;
}

export async function reviewCharacterLoraCandidateImages(input: {
  images: Array<{
    imageId: string;
    reviewStatus: "pending" | "keep" | "reject" | "excluded";
    rejectReasons?: Prisma.InputJsonValue | null;
    reviewNote?: string | null;
  }>;
}) {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.characterLoraCandidateImage.findMany({
      where: { id: { in: input.images.map((image) => image.imageId) } },
      select: { id: true, jobId: true, sectionId: true },
    });
    const existingById = new Map(existing.map((image) => [image.id, image]));
    const missingIds = input.images
      .map((image) => image.imageId)
      .filter((imageId) => !existingById.has(imageId));

    if (missingIds.length > 0) {
      throw new Error(`Candidate images not found: ${missingIds.join(", ")}`);
    }

    for (const image of input.images) {
      await tx.characterLoraCandidateImage.update({
        where: { id: image.imageId },
        data: {
          reviewStatus: image.reviewStatus,
          rejectReasons: image.reviewStatus === "reject" ? (image.rejectReasons ?? Prisma.JsonNull) : Prisma.JsonNull,
          reviewNote: image.reviewNote ?? null,
          reviewedAt: image.reviewStatus === "pending" ? null : new Date(),
        },
        select: { id: true },
      });
    }

    const sectionIds = Array.from(
      new Set(existing.map((image) => image.sectionId).filter((sectionId): sectionId is string => Boolean(sectionId))),
    );

    await refreshSectionCounts(tx, sectionIds);

    const jobIds = Array.from(new Set(existing.map((image) => image.jobId)));
    for (const jobId of jobIds) {
      await tx.characterLoraTrainingJob.update({
        where: { id: jobId },
        data: { status: CharacterLoraJobStatus.reviewing, phase: "review" },
        select: { id: true },
      });
    }

    const updated = await tx.characterLoraCandidateImage.findMany({
      where: { id: { in: input.images.map((image) => image.imageId) } },
      orderBy: [{ sectionId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: CANDIDATE_IMAGE_SELECT,
    });

    return updated;
  });

  return result.map(serializeCandidateImage);
}

export async function updateCharacterLoraCandidateCaption(input: {
  imageId: string;
  captionDraft: string;
}) {
  const image = await db.characterLoraCandidateImage.update({
    where: { id: input.imageId },
    data: { captionDraft: input.captionDraft },
    select: CANDIDATE_IMAGE_SELECT,
  });

  return serializeCandidateImage(image);
}
