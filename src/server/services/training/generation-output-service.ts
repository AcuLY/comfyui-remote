import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path, { basename, dirname, extname, join } from "node:path";

import type {
  LoraTrainingImageResult,
  TrainingImageStatus,
} from "@/features/training/types";
import { Prisma } from "@/generated/prisma";
import { toImageUrl } from "@/lib/image-url";
import { prisma } from "@/lib/prisma";
import { TRAINING_IMAGE_GENERATION_PROVIDER_POLICY } from "@/lib/training/provider-policy";

import {
  createTrainingReferenceImage,
  findTrainingReferenceImageDuplicate,
  getTrainingCandidateImage,
  getTrainingProductionProject,
  getTrainingReferenceImage,
  listTrainingReferenceImages,
} from "@/server/repositories/training/image-results";
import { z } from "zod";

const PUBLIC_SECTION_ID_KEY = "publicSectionId";

const generationOutputApplySchema = z.object({
  targetEntityType: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1).optional().nullable(),
  targetField: z.string().trim().min(1).optional().nullable(),
  label: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(20_000).optional().nullable(),
  kind: z.enum(["original", "generated", "auxiliary"]).optional().nullable(),
}).strict();

type GenerationOutputApplyInput = z.infer<typeof generationOutputApplySchema>;

type GenerationOutputApplyTarget = "reference_image" | "result_pool";
type TrainingCandidateImage = NonNullable<Awaited<ReturnType<typeof getTrainingCandidateImage>>>;

export class TrainingGenerationOutputServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingGenerationOutputServiceError";
    this.status = status;
    this.details = details;
  }
}

function parseGenerationOutputApplyInput(input: unknown) {
  const result = generationOutputApplySchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingGenerationOutputServiceError("Invalid training generation output apply request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function normalizeApplyTarget(value: string): GenerationOutputApplyTarget {
  if (value === "reference_image" || value === "training_character_image") {
    return "reference_image";
  }
  if (value === "result_pool" || value === "training_image_result") {
    return "result_pool";
  }
  throw new TrainingGenerationOutputServiceError("Unsupported training generation output target", 409, {
    supportedTargets: ["reference_image", "training_character_image", "result_pool", "training_image_result"],
    targetEntityType: value,
  });
}

function normalizeNullableString(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type FileLike = {
  arrayBuffer(): Promise<ArrayBuffer>;
  name: string;
  size?: number;
  type?: string;
};

function isFileLike(value: unknown): value is FileLike {
  return Boolean(
    value
    && typeof value === "object"
    && "name" in value
    && typeof (value as { name?: unknown }).name === "string"
    && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function",
  );
}

function nowStorageStamp() {
  return `${Date.now()}-${randomUUID()}`;
}

function normalizeUploadName(name: string) {
  const ext = extname(name) || ".png";
  const stem = basename(name, ext)
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
  return `${stem}${ext.toLowerCase()}`;
}

function normalizeReviewStatus(value: unknown) {
  if (value === "keep" || value === "kept" || value === "included_in_training") return "keep";
  if (value === "reject" || value === "rejected" || value === "excluded") return "reject";
  return "pending";
}

function mapReviewStatus(reviewStatus: string): LoraTrainingImageResult["reviewStatus"] {
  if (reviewStatus === "keep" || reviewStatus === "included_in_training") return "kept";
  if (reviewStatus === "reject" || reviewStatus === "excluded") return "rejected";
  return "pending";
}

function mapImageStatus(reviewStatus: string): TrainingImageStatus {
  if (reviewStatus === "keep" || reviewStatus === "included_in_training") return "kept";
  if (reviewStatus === "reject" || reviewStatus === "excluded") return "trashed";
  return "pending";
}

async function mapCandidateToTrainingImageResult(image: TrainingCandidateImage): Promise<LoraTrainingImageResult> {
  const sectionId = image.sectionId ?? "ungrouped";
  const section = image.sectionId
    ? await findTrainingSectionForResult(image.jobId, image.sectionId)
    : null;
  const sectionTitle = section?.name ?? (image.sectionId ? "训练小节" : "未分组");
  const url = toImageUrl(image.relativePath);
  if (!url) {
    throw new TrainingGenerationOutputServiceError("Training image result path is missing", 500, {
      imageResultId: image.id,
    });
  }

  return {
    id: image.id,
    sectionId,
    sectionTitle,
    image: {
      id: `${image.relativePath}-0`,
      src: url,
      full: url,
      label: "01",
      status: mapImageStatus(image.reviewStatus),
      featured: true,
      featured2: false,
      cover: true,
      width: image.width ?? null,
      height: image.height ?? null,
    },
    reviewStatus: mapReviewStatus(image.reviewStatus),
    caption: image.captionDraft ?? "未填写说明文本",
    sourceLabel: `${sectionTitle} · 01`,
  };
}

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || typeof value === "undefined") return {};
  if (typeof value === "object") return value as Prisma.InputJsonValue;
  return { value } as Prisma.InputJsonValue;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getPublicSectionId(section: { id: string; sectionDefaultsJson?: unknown }) {
  const publicId = parseJsonObject(section.sectionDefaultsJson)[PUBLIC_SECTION_ID_KEY];
  return typeof publicId === "string" && publicId.trim() ? publicId.trim() : section.id;
}

async function findTrainingSectionForResult(projectId: string, sectionId: string | null) {
  if (!sectionId) return null;
  const sections = await prisma.trainingSection.findMany({
    where: { trainingProjectId: projectId },
  });
  return sections.find((section) => section.id === sectionId || getPublicSectionId(section) === sectionId) ?? null;
}

async function createManualUploadSectionRun(projectId: string, sectionId: string, captionDraft: string) {
  const section = await findTrainingSectionForResult(projectId, sectionId);
  if (!section) {
    throw new TrainingGenerationOutputServiceError("Training section not found", 404, { projectId, sectionId });
  }

  const latestRun = await prisma.trainingSectionRun.findFirst({
    where: {
      trainingProjectId: projectId,
      trainingSectionId: section.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  if (latestRun) return latestRun;

  const profile = await prisma.trainingCharacterProfile.upsert({
    where: { trainingProjectId: projectId },
    create: { trainingProjectId: projectId },
    update: {},
  });
  const now = new Date();
  const runIndex = await prisma.trainingSectionRun.count({
    where: { trainingSectionId: section.id },
  }) + 1;
  const task = await prisma.trainingGenerationTask.create({
    data: {
      trainingProjectId: projectId,
      generationKind: "image_generation",
      taskType: "trainingset_generation",
      supplementalPrompt: captionDraft,
      status: "done",
      provider: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.provider,
      model: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model,
      startedAt: now,
      finishedAt: now,
    },
  });
  return prisma.trainingSectionRun.create({
    data: {
      trainingProjectId: projectId,
      trainingSectionId: section.id,
      trainingCharacterProfileId: profile.id,
      generationTaskId: task.id,
      runIndex,
      sceneDescriptionText: section.name ?? "手动上传结果",
      imagePromptText: captionDraft || "手动上传结果",
      provider: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.provider,
      model: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model,
      status: "done",
      startedAt: now,
      finishedAt: now,
    },
  });
}

async function findTrainingProjectForImageResult(projectId: string) {
  const row = await prisma.trainingProject.findFirst({
    where: {
      OR: [
        { id: projectId },
        { slug: projectId },
        { name: projectId },
      ],
    },
    select: {
      id: true,
      status: true,
      archivedAt: true,
    },
  });
  if (!row) {
    throw new TrainingGenerationOutputServiceError("Training project not found", 404, { projectId });
  }
  return row;
}

async function getActiveImageResultRow(imageResultId: string) {
  const row = await prisma.trainingImageResult.findUnique({
    where: { id: imageResultId },
    select: {
      id: true,
      removedAt: true,
      trainingProjectId: true,
    },
  });
  if (!row || row.removedAt) {
    throw new TrainingGenerationOutputServiceError("Training image result not found", 404, { imageResultId });
  }
  return row;
}

async function getMappedTrainingImageResult(imageResultId: string) {
  const image = await getTrainingCandidateImage(imageResultId);
  if (!image) {
    throw new TrainingGenerationOutputServiceError("Training image result not found", 404, { imageResultId });
  }
  return mapCandidateToTrainingImageResult(image);
}

export async function uploadTrainingResultImage(projectId: string, formData: FormData) {
  const project = await findTrainingProjectForImageResult(projectId);
  if (project.archivedAt || project.status === "archived") {
    throw new TrainingGenerationOutputServiceError("Archived training projects cannot accept image results", 409, {
      projectId: project.id,
      status: project.status,
    });
  }

  const file = formData.get("file");
  if (!isFileLike(file)) {
    throw new TrainingGenerationOutputServiceError("file is required", 400);
  }

  const safeName = normalizeUploadName(file.name);
  const relativePath = `data/images/training/${project.id}/results/${nowStorageStamp()}-${safeName}`;
  const absolutePath = join(process.cwd(), relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const captionDraft = normalizeNullableString(formData.get("captionDraft") as string | null)
    ?? normalizeNullableString(formData.get("supplementalPrompt") as string | null)
    ?? "";
  const supplementalPrompt = normalizeNullableString(formData.get("supplementalPrompt") as string | null);
  const requestedSectionId = normalizeNullableString(formData.get("sectionId") as string | null);
  const sectionRun = requestedSectionId
    ? await createManualUploadSectionRun(project.id, requestedSectionId, captionDraft)
    : null;

  const artifact = await prisma.trainingArtifact.upsert({
    where: {
      trainingProjectId_storageKey: {
        trainingProjectId: project.id,
        storageKey: relativePath,
      },
    },
    update: {
      filePath: relativePath,
      fileSize: BigInt(buffer.byteLength),
      lifecycleStatus: "active",
      metadata: normalizeJson({
        originalName: file.name,
        purpose: "manual_image_result_upload",
      }),
      mimeType: file.type || null,
      sha256,
      storageRole: "generation_output",
    },
    create: {
      trainingProjectId: project.id,
      storageKey: relativePath,
      filePath: relativePath,
      fileSize: BigInt(buffer.byteLength),
      lifecycleStatus: "active",
      metadata: normalizeJson({
        originalName: file.name,
        purpose: "manual_image_result_upload",
      }),
      mimeType: file.type || null,
      sha256,
      storageRole: "generation_output",
    },
  });

  const created = await prisma.trainingImageResult.create({
    data: {
      trainingProjectId: project.id,
      artifactId: artifact.id,
      sourceType: "manual_upload",
      trainingSectionRunId: sectionRun?.id ?? null,
      reviewStatus: normalizeReviewStatus(formData.get("reviewStatus")),
      trainingCaption: captionDraft,
      supplementalPrompt,
      filePathSnapshot: relativePath,
      mimeType: file.type || null,
      fileSize: BigInt(buffer.byteLength),
      sha256,
    },
    select: { id: true },
  });

  return getMappedTrainingImageResult(created.id);
}

export async function patchTrainingImageResultRecord(
  imageResultId: string,
  input: { reviewStatus?: string; captionDraft?: string | null },
) {
  await getActiveImageResultRow(imageResultId);

  const data: Prisma.TrainingImageResultUpdateInput = {};
  if (typeof input.reviewStatus === "string") {
    data.reviewStatus = normalizeReviewStatus(input.reviewStatus);
  }
  if (typeof input.captionDraft === "string") {
    data.trainingCaption = input.captionDraft;
  }

  if (Object.keys(data).length === 0) {
    throw new TrainingGenerationOutputServiceError("At least one supported field is required", 400, {
      supportedFields: ["captionDraft", "reviewStatus"],
    });
  }

  await prisma.trainingImageResult.update({
    where: { id: imageResultId },
    data,
  });
  return getMappedTrainingImageResult(imageResultId);
}

export async function setTrainingImageResultReviewStatus(imageResultId: string, input: { reviewStatus?: unknown }) {
  await getActiveImageResultRow(imageResultId);
  await prisma.trainingImageResult.update({
    where: { id: imageResultId },
    data: {
      reviewStatus: normalizeReviewStatus(input.reviewStatus),
    },
  });
  return getMappedTrainingImageResult(imageResultId);
}

export async function deleteTrainingImageResultRecord(imageResultId: string) {
  await getActiveImageResultRow(imageResultId);
  await prisma.trainingImageResult.update({
    where: { id: imageResultId },
    data: {
      removedAt: new Date(),
      removeReason: "deleted_from_training_image_result_api",
    },
  });
  return {
    id: imageResultId,
    success: true,
  };
}

async function applyProductionGenerationOutput(
  outputId: string,
  input: GenerationOutputApplyInput,
  target: GenerationOutputApplyTarget,
) {
  const output = await getTrainingCandidateImage(outputId);
  if (!output) return null;
  const job = await getTrainingProductionProject(output.jobId);
  if (!job) {
    throw new TrainingGenerationOutputServiceError("Training project not found", 404, { outputId, projectId: output.jobId });
  }

  if (input.targetEntityId && input.targetEntityId !== job.id) {
    throw new TrainingGenerationOutputServiceError("Generation output does not belong to the target project", 409, {
      outputId,
      targetEntityId: input.targetEntityId,
      projectId: job.id,
    });
  }

  if (target === "result_pool") {
    return {
      outputId,
      targetEntityType: input.targetEntityType,
      targetEntityId: job.id,
      targetField: normalizeNullableString(input.targetField),
      appliedAt: new Date().toISOString(),
      created: false,
      result: output,
    };
  }

  if (job.status === "archived" || job.status === "promoted") {
    throw new TrainingGenerationOutputServiceError(
      "Archived training projects cannot accept generated reference images",
      409,
      { status: job.status },
    );
  }

  const duplicate = await findTrainingReferenceImageDuplicate({
    jobId: job.id,
    role: "generated",
    sha256: output.sha256,
  });
  if (duplicate) {
    const existing = await getTrainingReferenceImage(duplicate.id);
    if (!existing) {
      throw new TrainingGenerationOutputServiceError("Training reference image not found", 404, {
        outputId,
        sourceImageId: duplicate.id,
      });
    }
    return {
      outputId,
      targetEntityType: input.targetEntityType,
      targetEntityId: job.id,
      targetField: normalizeNullableString(input.targetField),
      appliedAt: new Date().toISOString(),
      created: false,
      result: existing,
    };
  }

  const sourceImages = await listTrainingReferenceImages(job.id);
  const byteSize = typeof output.fileSize === "string" && output.fileSize.trim() ? BigInt(output.fileSize) : null;
  const created = await createTrainingReferenceImage({
    jobId: job.id,
    role: normalizeNullableString(input.kind) ?? "generated",
    relativePath: output.relativePath,
    absolutePath: path.join(job.artifactRoot, output.relativePath),
    sha256: output.sha256,
    byteSize,
    mimeType: null,
    width: output.width,
    height: output.height,
    provenance: {
      mode: "training_generation_output_apply",
      sourceGenerationOutputId: output.id,
      sourceGenerationRunId: output.generationRunId,
      sourceCandidateImageId: output.id,
      label: normalizeNullableString(input.label),
      note: normalizeNullableString(input.note),
    },
    sortOrder: sourceImages.length,
    artifactMetadata: {
      purpose: "training_generation_output_apply",
      sourceGenerationOutputId: output.id,
      sourceGenerationRunId: output.generationRunId,
    },
  });

  return {
    outputId,
    targetEntityType: input.targetEntityType,
    targetEntityId: job.id,
    targetField: normalizeNullableString(input.targetField),
    appliedAt: new Date().toISOString(),
    created: true,
    result: created,
  };
}

export async function applyTrainingGenerationOutput(outputId: string, input: unknown) {
  const parsed = parseGenerationOutputApplyInput(input);
  const target = normalizeApplyTarget(parsed.targetEntityType);

  const production = await applyProductionGenerationOutput(outputId, parsed, target);
  if (production) return production;

  throw new TrainingGenerationOutputServiceError("Training generation output not found", 404, { outputId });
}

export function mapTrainingGenerationOutputError(error: unknown) {
  if (error instanceof TrainingGenerationOutputServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training generation output error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
