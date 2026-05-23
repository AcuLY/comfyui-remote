import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraDecisionStatus,
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
  RunStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { detectProvider } from "@/lib/prisma";
import type {
  CharacterLoraArtifactKind,
  CharacterLoraDatasetFreezeTaskPayload,
  CharacterLoraImageGenerationOutput,
  CharacterLoraImageGenerationTaskPayload,
  CharacterLoraBenchmarkTaskPayload,
  CharacterLoraTrainingCompleteOutput,
  CharacterLoraTrainingTaskPayload,
} from "@/server/character-lora-training/contracts";

const JOB_SUMMARY_SELECT = {
  id: true,
  slug: true,
  characterName: true,
  triggerToken: true,
  status: true,
  phase: true,
  trainingScope: true,
  captionStrategy: true,
  baseCheckpointName: true,
  baseCheckpointPath: true,
  baseCheckpointHash: true,
  baseFamily: true,
  artifactRoot: true,
  currentCanonicalVersionId: true,
  currentPromptCardVersionId: true,
  selectedDatasetRevisionId: true,
  promotedPresetId: true,
  createdBy: true,
  failureSummary: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      sourceImages: true,
      canonicalVersions: true,
      promptCardVersions: true,
      sections: true,
      generationRuns: true,
      candidateImages: true,
      datasetRevisions: true,
      trainingRuns: true,
      benchmarkRuns: true,
      promotionDecisions: true,
      artifacts: true,
      workerTasks: true,
    },
  },
} as const;

const SOURCE_IMAGE_SELECT = {
  id: true,
  jobId: true,
  role: true,
  artifactId: true,
  filePath: true,
  sha256: true,
  width: true,
  height: true,
  provenance: true,
  sortOrder: true,
  createdAt: true,
} as const;

const ARTIFACT_REF_SELECT = {
  id: true,
  jobId: true,
  kind: true,
  relativePath: true,
  absolutePath: true,
  sha256: true,
  byteSize: true,
  mimeType: true,
  redactionLevel: true,
  metadata: true,
  createdAt: true,
} as const;

const GENERATION_RUN_SUMMARY_SELECT = {
  id: true,
  jobId: true,
  sectionId: true,
  kind: true,
  parentRunId: true,
  status: true,
  provider: true,
  hostModel: true,
  imageModel: true,
  hostInstruction: true,
  visualPrompt: true,
  negativePrompt: true,
  toolParams: true,
  inputImages: true,
  requestArtifactId: true,
  responseSummary: true,
  errorSummary: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      canonicalVersions: true,
      candidateImages: true,
    },
  },
} as const;

const CANONICAL_VERSION_SELECT = {
  id: true,
  jobId: true,
  version: true,
  status: true,
  sourceRunId: true,
  imageArtifactId: true,
  selectedAt: true,
  notes: true,
  createdAt: true,
} as const;

const PROMPT_CARD_VERSION_SELECT = {
  id: true,
  jobId: true,
  canonicalVersionId: true,
  version: true,
  triggerToken: true,
  identityTraits: true,
  outfitTraits: true,
  negativeTraits: true,
  finalPromptDraft: true,
  changeReason: true,
  createdAt: true,
} as const;

const SECTION_TEMPLATE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  angleTag: true,
  promptTemplate: true,
  negativeTemplate: true,
  targetCandidateCount: true,
  targetKeepCount: true,
  sortOrder: true,
  isActive: true,
} as const;

const JOB_SECTION_SELECT = {
  id: true,
  jobId: true,
  templateId: true,
  key: true,
  name: true,
  canonicalVersionId: true,
  promptCardVersionId: true,
  targetCandidateCount: true,
  targetKeepCount: true,
  status: true,
  keepCount: true,
  rejectCount: true,
  pendingCount: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  template: {
    select: {
      promptTemplate: true,
      negativeTemplate: true,
      angleTag: true,
      description: true,
    },
  },
  _count: {
    select: {
      generationRuns: true,
      candidateImages: true,
    },
  },
} as const;

const CANDIDATE_IMAGE_SELECT = {
  id: true,
  jobId: true,
  sectionId: true,
  generationRunId: true,
  artifactId: true,
  filePath: true,
  sha256: true,
  width: true,
  height: true,
  fileSize: true,
  reviewStatus: true,
  rejectReasons: true,
  reviewNote: true,
  captionDraft: true,
  reviewedAt: true,
  includedDatasetRevisionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DATASET_REVISION_SELECT = {
  id: true,
  jobId: true,
  version: true,
  status: true,
  canonicalVersionId: true,
  promptCardVersionId: true,
  captionStrategy: true,
  itemCount: true,
  sourceCount: true,
  syntheticCount: true,
  selectedManifestArtifactId: true,
  metadataJsonlArtifactId: true,
  captionAuditArtifactId: true,
  trainDir: true,
  frozenAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      items: true,
      includedCandidateImages: true,
    },
  },
} as const;

const TRAINING_RUN_SELECT = {
  id: true,
  jobId: true,
  datasetRevisionId: true,
  status: true,
  launcher: true,
  resolvedConfig: true,
  configArtifactId: true,
  dryRunSummaryArtifactId: true,
  logArtifactId: true,
  outputDir: true,
  finalSafetensorsArtifactId: true,
  finalSha256: true,
  metadataSummary: true,
  currentStep: true,
  targetSteps: true,
  lossSnapshot: true,
  cancelRequestedAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      checkpoints: true,
      benchmarkRuns: true,
    },
  },
} as const;

const BENCHMARK_RUN_SELECT = {
  id: true,
  jobId: true,
  trainingRunId: true,
  status: true,
  loraAssetId: true,
  testPresetId: true,
  testProjectId: true,
  templateId: true,
  checkpointMatrix: true,
  weightMatrix: true,
  reportArtifactId: true,
  recommendedWeight: true,
  resultSummary: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      promotionDecisions: true,
    },
  },
} as const;

const PROMOTION_DECISION_SELECT = {
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
  promotedCategoryId: true,
  promotedPresetId: true,
  reportArtifactId: true,
  decidedAt: true,
  promotedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const WORKER_TASK_SELECT = {
  id: true,
  jobId: true,
  workerType: true,
  targetType: true,
  targetId: true,
  status: true,
  payload: true,
  leaseOwner: true,
  leaseExpiresAt: true,
  attemptCount: true,
  progressJson: true,
  startedAt: true,
  heartbeatAt: true,
  finishedAt: true,
  errorSummary: true,
  createdAt: true,
  updatedAt: true,
} as const;

const GPU_TASK_LOCK_SELECT = {
  id: true,
  taskType: true,
  ownerType: true,
  ownerId: true,
  status: true,
  startedAt: true,
  releasedAt: true,
  metadata: true,
} as const;

type JobSummaryRecord = Prisma.CharacterLoraTrainingJobGetPayload<{
  select: typeof JOB_SUMMARY_SELECT;
}>;

type SourceImageRecord = Prisma.CharacterLoraSourceImageGetPayload<{
  select: typeof SOURCE_IMAGE_SELECT;
}>;

type ArtifactRefRecord = Prisma.CharacterLoraArtifactGetPayload<{
  select: typeof ARTIFACT_REF_SELECT;
}>;

type GenerationRunRecord = Prisma.CharacterLoraGenerationRunGetPayload<{
  select: typeof GENERATION_RUN_SUMMARY_SELECT;
}>;

type CanonicalVersionRecord = Prisma.CharacterLoraCanonicalVersionGetPayload<{
  select: typeof CANONICAL_VERSION_SELECT;
}>;

type PromptCardVersionRecord = Prisma.CharacterLoraPromptCardVersionGetPayload<{
  select: typeof PROMPT_CARD_VERSION_SELECT;
}>;

type SectionTemplateRecord = Prisma.CharacterLoraSectionTemplateGetPayload<{
  select: typeof SECTION_TEMPLATE_SELECT;
}>;

type JobSectionRecord = Prisma.CharacterLoraJobSectionGetPayload<{
  select: typeof JOB_SECTION_SELECT;
}>;

type CandidateImageRecord = Prisma.CharacterLoraCandidateImageGetPayload<{
  select: typeof CANDIDATE_IMAGE_SELECT;
}>;

type DatasetRevisionRecord = Prisma.CharacterLoraDatasetRevisionGetPayload<{
  select: typeof DATASET_REVISION_SELECT;
}>;

type TrainingRunRecord = Prisma.CharacterLoraTrainingRunGetPayload<{
  select: typeof TRAINING_RUN_SELECT;
}>;

type BenchmarkRunRecord = Prisma.CharacterLoraBenchmarkRunGetPayload<{
  select: typeof BENCHMARK_RUN_SELECT;
}>;

type PromotionDecisionRecord = Prisma.CharacterLoraPromotionDecisionGetPayload<{
  select: typeof PROMOTION_DECISION_SELECT;
}>;

type WorkerTaskRecord = Prisma.CharacterLoraWorkerTaskGetPayload<{
  select: typeof WORKER_TASK_SELECT;
}>;

type GpuTaskLockRecord = Prisma.GpuTaskLockGetPayload<{
  select: typeof GPU_TASK_LOCK_SELECT;
}>;

export type CharacterLoraTrainingJobCreateInput = {
  slug: string;
  characterName: string;
  triggerToken: string;
  status: "draft";
  phase?: string | null;
  trainingScope: Prisma.InputJsonValue;
  captionStrategy: string;
  baseCheckpointName?: string | null;
  baseCheckpointPath?: string | null;
  baseCheckpointHash?: string | null;
  baseFamily?: string | null;
  artifactRoot: string;
  createdBy?: string | null;
};

export type CharacterLoraTrainingJobUpdateInput = Partial<{
  characterName: string;
  triggerToken: string;
  phase: string | null;
  trainingScope: Prisma.InputJsonValue;
  captionStrategy: string;
  baseCheckpointName: string | null;
  baseCheckpointPath: string | null;
  baseCheckpointHash: string | null;
  baseFamily: string | null;
  createdBy: string | null;
}>;

export type CharacterLoraTrainingJobListFilters = {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export type CharacterLoraTrainingJobSummary = ReturnType<typeof serializeJobSummary>;
export type CharacterLoraSourceImageSummary = ReturnType<typeof serializeSourceImage>;
export type CharacterLoraArtifactRefSummary = ReturnType<typeof serializeArtifactRef>;
export type CharacterLoraGenerationRunSummary = ReturnType<typeof serializeGenerationRun>;
export type CharacterLoraCanonicalVersionSummary = ReturnType<typeof serializeCanonicalVersion>;
export type CharacterLoraPromptCardVersionSummary = ReturnType<typeof serializePromptCardVersion>;
export type CharacterLoraSectionTemplateSummary = ReturnType<typeof serializeSectionTemplate>;
export type CharacterLoraJobSectionSummary = ReturnType<typeof serializeJobSection>;
export type CharacterLoraCandidateImageSummary = ReturnType<typeof serializeCandidateImage>;
export type CharacterLoraDatasetRevisionSummary = ReturnType<typeof serializeDatasetRevision>;
export type CharacterLoraTrainingRunSummary = ReturnType<typeof serializeTrainingRun>;
export type CharacterLoraBenchmarkRunSummary = ReturnType<typeof serializeBenchmarkRun>;
export type CharacterLoraPromotionDecisionSummary = ReturnType<typeof serializePromotionDecision>;
export type CharacterLoraWorkerTaskSummary = ReturnType<typeof serializeWorkerTask>;
export type CharacterLoraGpuTaskLockSummary = ReturnType<typeof serializeGpuTaskLock>;

export type CharacterLoraSourceImageCreateInput = {
  jobId: string;
  role: string;
  relativePath: string;
  absolutePath?: string | null;
  sha256: string;
  byteSize?: bigint | number | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  provenance?: Prisma.InputJsonValue | null;
  sortOrder?: number;
  artifactMetadata?: Prisma.InputJsonValue | null;
};

export type CharacterLoraCandidateImageListFilters = {
  jobId: string;
  sectionId?: string;
  generationRunId?: string;
  reviewStatus?: CharacterLoraImageReviewStatus;
};

export type CharacterLoraDatasetItemCreateInput = {
  candidateImageId: string;
  imageArtifactId: string;
  captionArtifactId: string;
  captionText: string;
  repeatCount: number;
  sourceWeight?: number | null;
  sortOrder: number;
};

type CharacterLoraDatasetRevisionCreateInput = {
  revisionId: string;
  jobId: string;
  version: number;
  canonicalVersionId: string;
  promptCardVersionId: string;
  captionStrategy: string;
  trainDir: string;
  sourceCount: number;
  syntheticCount: number;
  selectedManifestArtifactId: string;
  metadataJsonlArtifactId: string;
  captionAuditArtifactId: string;
  items: CharacterLoraDatasetItemCreateInput[];
};

export async function listCharacterLoraTrainingJobs(filters: CharacterLoraTrainingJobListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const q = filters.q?.trim();

  const where: Prisma.CharacterLoraTrainingJobWhereInput = {
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(q
      ? {
          OR: [
            { characterName: ciContains(q) },
            { triggerToken: ciContains(q) },
            { slug: ciContains(q) },
            { baseCheckpointName: ciContains(q) },
          ],
        }
      : {}),
  };

  const [total, jobs] = await Promise.all([
    db.characterLoraTrainingJob.count({ where }),
    db.characterLoraTrainingJob.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: JOB_SUMMARY_SELECT,
    }),
  ]);

  return {
    jobs: jobs.map(serializeJobSummary),
    page,
    pageSize,
    total,
  };
}

export async function getCharacterLoraTrainingJob(jobId: string) {
  const job = await db.characterLoraTrainingJob.findUnique({
    where: { id: jobId },
    select: JOB_SUMMARY_SELECT,
  });

  return job ? serializeJobSummary(job) : null;
}

export async function findCharacterLoraTrainingJobBySlug(slug: string) {
  return db.characterLoraTrainingJob.findUnique({
    where: { slug },
    select: { id: true },
  });
}

export async function findActiveCharacterLoraTrainingJobByTriggerToken(input: {
  triggerToken: string;
  excludeJobId?: string;
}) {
  return db.characterLoraTrainingJob.findFirst({
    where: {
      triggerToken: input.triggerToken,
      status: { notIn: [CharacterLoraJobStatus.archived, CharacterLoraJobStatus.cancelled] },
      ...(input.excludeJobId ? { id: { not: input.excludeJobId } } : {}),
    },
    select: {
      id: true,
      slug: true,
      characterName: true,
      triggerToken: true,
      status: true,
    },
  });
}

export async function createCharacterLoraTrainingJob(input: CharacterLoraTrainingJobCreateInput) {
  const job = await db.characterLoraTrainingJob.create({
    data: input,
    select: JOB_SUMMARY_SELECT,
  });

  return serializeJobSummary(job);
}

export async function updateCharacterLoraTrainingJob(jobId: string, input: CharacterLoraTrainingJobUpdateInput) {
  const job = await db.characterLoraTrainingJob.update({
    where: { id: jobId },
    data: input,
    select: JOB_SUMMARY_SELECT,
  });

  return serializeJobSummary(job);
}

export async function listCharacterLoraSourceImages(jobId: string) {
  const sourceImages = await db.characterLoraSourceImage.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: SOURCE_IMAGE_SELECT,
  });

  return sourceImages.map(serializeSourceImage);
}

export async function getCharacterLoraSourceImage(sourceImageId: string) {
  const sourceImage = await db.characterLoraSourceImage.findUnique({
    where: { id: sourceImageId },
    select: SOURCE_IMAGE_SELECT,
  });

  return sourceImage ? serializeSourceImage(sourceImage) : null;
}

export async function listCharacterLoraSourceImagesByIds(jobId: string, sourceImageIds: string[]) {
  if (sourceImageIds.length === 0) {
    return [];
  }

  const sourceImages = await db.characterLoraSourceImage.findMany({
    where: {
      jobId,
      id: { in: sourceImageIds },
    },
    select: SOURCE_IMAGE_SELECT,
  });

  return sourceImages.map(serializeSourceImage);
}

export async function findCharacterLoraSourceImageDuplicate(input: {
  jobId: string;
  sha256: string;
  role: string;
}) {
  return db.characterLoraSourceImage.findUnique({
    where: {
      jobId_sha256_role: {
        jobId: input.jobId,
        sha256: input.sha256,
        role: input.role,
      },
    },
    select: { id: true },
  });
}

export async function createCharacterLoraSourceImage(input: CharacterLoraSourceImageCreateInput) {
  const sourceImage = await db.$transaction(async (tx) => {
    const artifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: input.jobId,
        kind: "source_image",
        relativePath: input.relativePath,
        absolutePath: input.absolutePath,
        sha256: input.sha256,
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        redactionLevel: "path_only",
        metadata: input.artifactMetadata ?? Prisma.DbNull,
      },
      select: { id: true },
    });

    return tx.characterLoraSourceImage.create({
      data: {
        jobId: input.jobId,
        role: input.role,
        artifactId: artifact.id,
        filePath: input.relativePath,
        sha256: input.sha256,
        width: input.width ?? null,
        height: input.height ?? null,
        provenance: input.provenance ?? Prisma.DbNull,
        sortOrder: input.sortOrder ?? 0,
      },
      select: SOURCE_IMAGE_SELECT,
    });
  });

  return serializeSourceImage(sourceImage);
}

export async function registerCharacterLoraSourceImageAsCandidate(input: {
  jobId: string;
  sourceImageId: string;
  reviewStatus?: CharacterLoraImageReviewStatus;
  captionDraft?: string | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const sourceImage = await tx.characterLoraSourceImage.findUnique({
      where: { id: input.sourceImageId },
      select: {
        ...SOURCE_IMAGE_SELECT,
        job: {
          select: {
            id: true,
            characterName: true,
            triggerToken: true,
          },
        },
      },
    });

    if (!sourceImage || sourceImage.jobId !== input.jobId) {
      throw new Error("Source image not found for this character LoRA job");
    }

    const artifact = await tx.characterLoraArtifact.findUnique({
      where: { id: sourceImage.artifactId },
      select: ARTIFACT_REF_SELECT,
    });

    if (!artifact || artifact.jobId !== input.jobId || artifact.kind !== "source_image") {
      throw new Error("Source image artifact must belong to the job and have kind source_image");
    }

    const existingCandidate = await tx.characterLoraCandidateImage.findFirst({
      where: {
        jobId: input.jobId,
        artifactId: sourceImage.artifactId,
      },
      select: CANDIDATE_IMAGE_SELECT,
    });

    if (existingCandidate) {
      return {
        candidate: existingCandidate,
        generationRun: null,
        created: false,
      };
    }

    const now = new Date();
    const run = await tx.characterLoraGenerationRun.create({
      data: {
        id: randomUUID(),
        jobId: input.jobId,
        sectionId: null,
        kind: "source_candidate",
        status: CharacterLoraRunStatus.done,
        provider: "mock-local",
        hostModel: "mock-local",
        imageModel: "source-image-import",
        hostInstruction: "Register an uploaded source image as a reviewable dataset candidate.",
        visualPrompt: `${sourceImage.job.triggerToken}, ${sourceImage.job.characterName}, source training anchor`,
        negativePrompt: null,
        toolParams: toInputJsonValue({
          origin: "source_candidate",
          mode: "register_source_image",
          sourceImageId: sourceImage.id,
          sourceRole: sourceImage.role,
        }),
        inputImages: toInputJsonValue({
          origin: "source_candidate",
          sourceImageId: sourceImage.id,
          sourceRole: sourceImage.role,
          artifactId: sourceImage.artifactId,
          relativePath: sourceImage.filePath,
          sha256: sourceImage.sha256,
        }),
        responseSummary: toInputJsonValue({
          origin: "source_candidate",
          sourceImageId: sourceImage.id,
          sourceRole: sourceImage.role,
          artifactId: sourceImage.artifactId,
          relativePath: sourceImage.filePath,
          registeredAt: now.toISOString(),
        }),
        startedAt: now,
        finishedAt: now,
      },
      select: GENERATION_RUN_SUMMARY_SELECT,
    });

    const candidate = await tx.characterLoraCandidateImage.create({
      data: {
        jobId: input.jobId,
        sectionId: null,
        generationRunId: run.id,
        artifactId: sourceImage.artifactId,
        filePath: sourceImage.filePath,
        sha256: sourceImage.sha256,
        width: sourceImage.width,
        height: sourceImage.height,
        fileSize: artifact.byteSize,
        reviewStatus: input.reviewStatus ?? CharacterLoraImageReviewStatus.pending,
        captionDraft: input.captionDraft ?? `${sourceImage.job.triggerToken}, ${sourceImage.job.characterName}, source reference, ${sourceImage.role}`,
        reviewedAt: null,
      },
      select: CANDIDATE_IMAGE_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: { status: CharacterLoraJobStatus.reviewing, phase: "review" },
      select: { id: true },
    });

    return {
      candidate,
      generationRun: run,
      created: true,
    };
  });

  return {
    candidate: serializeCandidateImage(result.candidate),
    generationRun: result.generationRun ? serializeGenerationRun(result.generationRun) : null,
    created: result.created,
  };
}

export async function createCharacterLoraJobArtifact(input: {
  jobId: string;
  kind: CharacterLoraArtifactKind;
  relativePath: string;
  absolutePath?: string | null;
  sha256?: string | null;
  byteSize?: bigint | number | null;
  mimeType?: string | null;
  redactionLevel?: string;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return db.characterLoraArtifact.create({
    data: {
      jobId: input.jobId,
      kind: input.kind,
      relativePath: input.relativePath,
      absolutePath: input.absolutePath,
      sha256: input.sha256,
      byteSize: input.byteSize,
      mimeType: input.mimeType,
      redactionLevel: input.redactionLevel ?? "path_only",
      metadata: input.metadata ?? Prisma.DbNull,
    },
    select: { id: true },
  });
}

export async function getCharacterLoraArtifact(artifactId: string) {
  const artifact = await db.characterLoraArtifact.findUnique({
    where: { id: artifactId },
    select: ARTIFACT_REF_SELECT,
  });

  return artifact ? serializeArtifactRef(artifact) : null;
}

export async function getCharacterLoraGenerationRun(generationRunId: string) {
  const run = await db.characterLoraGenerationRun.findUnique({
    where: { id: generationRunId },
    select: GENERATION_RUN_SUMMARY_SELECT,
  });

  return run ? serializeGenerationRun(run) : null;
}

export async function createCharacterLoraCanonicalGenerationRunWithTask(input: {
  runId: string;
  jobId: string;
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
        sectionId: null,
        kind: "canonical",
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

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.canonical_pending,
        phase: "canonical",
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

export async function createMockCompletedCanonicalVersion(input: {
  generationRunId: string;
  jobId: string;
  imageArtifactId: string;
  notes?: string | null;
  responseSummary: Prisma.InputJsonValue;
}) {
  const version = await db.$transaction(async (tx) => {
    const previous = await tx.characterLoraCanonicalVersion.findFirst({
      where: { jobId: input.jobId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const canonicalVersion = await tx.characterLoraCanonicalVersion.create({
      data: {
        jobId: input.jobId,
        version: (previous?.version ?? 0) + 1,
        status: "candidate",
        sourceRunId: input.generationRunId,
        imageArtifactId: input.imageArtifactId,
        notes: input.notes,
      },
      select: CANONICAL_VERSION_SELECT,
    });

    await tx.characterLoraGenerationRun.update({
      where: { id: input.generationRunId },
      data: {
        status: CharacterLoraRunStatus.done,
        responseSummary: input.responseSummary,
        errorSummary: null,
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.characterLoraWorkerTask.updateMany({
      where: {
        targetType: "generationRun",
        targetId: input.generationRunId,
        status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
      },
      data: {
        status: CharacterLoraRunStatus.done,
        errorSummary: null,
      },
    });

    return canonicalVersion;
  });

  return serializeCanonicalVersion(version);
}

export async function createManualCanonicalVersionFromSourceImage(input: {
  jobId: string;
  imageArtifactId: string;
  notes: string;
}) {
  const version = await db.$transaction(async (tx) => {
    const previous = await tx.characterLoraCanonicalVersion.findFirst({
      where: { jobId: input.jobId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return tx.characterLoraCanonicalVersion.create({
      data: {
        jobId: input.jobId,
        version: (previous?.version ?? 0) + 1,
        status: "candidate",
        sourceRunId: null,
        imageArtifactId: input.imageArtifactId,
        notes: input.notes,
      },
      select: CANONICAL_VERSION_SELECT,
    });
  });

  return serializeCanonicalVersion(version);
}

export async function getCharacterLoraCanonicalVersion(canonicalVersionId: string) {
  const version = await db.characterLoraCanonicalVersion.findUnique({
    where: { id: canonicalVersionId },
    select: CANONICAL_VERSION_SELECT,
  });

  return version ? serializeCanonicalVersion(version) : null;
}

export async function listCharacterLoraCanonicalVersions(jobId: string) {
  const versions = await db.characterLoraCanonicalVersion.findMany({
    where: { jobId },
    orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    select: CANONICAL_VERSION_SELECT,
  });

  return versions.map(serializeCanonicalVersion);
}

export async function selectCharacterLoraCanonicalVersion(input: {
  jobId: string;
  canonicalVersionId: string;
}) {
  const result = await db.$transaction(async (tx) => {
    await tx.characterLoraCanonicalVersion.updateMany({
      where: {
        jobId: input.jobId,
        id: { not: input.canonicalVersionId },
        status: "selected",
      },
      data: {
        status: "superseded",
      },
    });

    const canonicalVersion = await tx.characterLoraCanonicalVersion.update({
      where: { id: input.canonicalVersionId },
      data: {
        status: "selected",
        selectedAt: new Date(),
      },
      select: CANONICAL_VERSION_SELECT,
    });

    const job = await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        currentCanonicalVersionId: input.canonicalVersionId,
        status: CharacterLoraJobStatus.prompt_pending,
        phase: "prompt_card",
      },
      select: JOB_SUMMARY_SELECT,
    });

    return { canonicalVersion, job };
  });

  return {
    canonicalVersion: serializeCanonicalVersion(result.canonicalVersion),
    job: serializeJobSummary(result.job),
  };
}

export async function listCharacterLoraPromptCardVersions(jobId: string) {
  const versions = await db.characterLoraPromptCardVersion.findMany({
    where: { jobId },
    orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    select: PROMPT_CARD_VERSION_SELECT,
  });

  return versions.map(serializePromptCardVersion);
}

export async function getCharacterLoraPromptCardVersion(promptCardVersionId: string) {
  const version = await db.characterLoraPromptCardVersion.findUnique({
    where: { id: promptCardVersionId },
    select: PROMPT_CARD_VERSION_SELECT,
  });

  return version ? serializePromptCardVersion(version) : null;
}

export async function createCharacterLoraPromptCardVersion(input: {
  jobId: string;
  canonicalVersionId?: string | null;
  triggerToken: string;
  identityTraits: Prisma.InputJsonValue;
  outfitTraits: Prisma.InputJsonValue;
  negativeTraits?: Prisma.InputJsonValue | null;
  finalPromptDraft: string;
  changeReason?: string | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const previous = await tx.characterLoraPromptCardVersion.findFirst({
      where: { jobId: input.jobId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const promptCard = await tx.characterLoraPromptCardVersion.create({
      data: {
        jobId: input.jobId,
        canonicalVersionId: input.canonicalVersionId ?? null,
        version: (previous?.version ?? 0) + 1,
        triggerToken: input.triggerToken,
        identityTraits: input.identityTraits,
        outfitTraits: input.outfitTraits,
        negativeTraits: input.negativeTraits ?? Prisma.DbNull,
        finalPromptDraft: input.finalPromptDraft,
        changeReason: input.changeReason,
      },
      select: PROMPT_CARD_VERSION_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        currentPromptCardVersionId: promptCard.id,
        status: CharacterLoraJobStatus.section_generating,
        phase: "sections",
      },
      select: { id: true },
    });

    return promptCard;
  });

  return serializePromptCardVersion(result);
}

export type CharacterLoraSectionTemplateUpsertInput = {
  key: string;
  name: string;
  description?: string | null;
  angleTag?: string | null;
  promptTemplate: string;
  negativeTemplate?: string | null;
  targetCandidateCount: number;
  targetKeepCount: number;
  sortOrder: number;
  isActive: boolean;
};

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

export async function listActiveCharacterLoraSectionTemplates(templateKeys?: string[]) {
  const templates = await db.characterLoraSectionTemplate.findMany({
    where: {
      isActive: true,
      ...(templateKeys ? { key: { in: templateKeys } } : {}),
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
  canonicalVersionId: string;
  promptCardVersionId: string;
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
          canonicalVersionId: input.canonicalVersionId,
          promptCardVersionId: input.promptCardVersionId,
          targetCandidateCount: template.targetCandidateCount,
          targetKeepCount: template.targetKeepCount,
          status: "draft",
          sortOrder: template.sortOrder,
        },
        select: { id: true },
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

export async function getCharacterLoraDatasetRevision(datasetRevisionId: string) {
  const revision = await db.characterLoraDatasetRevision.findUnique({
    where: { id: datasetRevisionId },
    select: DATASET_REVISION_SELECT,
  });

  return revision ? serializeDatasetRevision(revision) : null;
}

export async function listCharacterLoraTrainingRuns(jobId: string) {
  const runs = await db.characterLoraTrainingRun.findMany({
    where: { jobId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: TRAINING_RUN_SELECT,
  });

  return runs.map(serializeTrainingRun);
}

export async function getCharacterLoraTrainingRun(trainingRunId: string) {
  const run = await db.characterLoraTrainingRun.findUnique({
    where: { id: trainingRunId },
    select: TRAINING_RUN_SELECT,
  });

  return run ? serializeTrainingRun(run) : null;
}

export async function getCharacterLoraTrainingRunWithFinalArtifact(trainingRunId: string) {
  return db.characterLoraTrainingRun.findUnique({
    where: { id: trainingRunId },
    select: {
      id: true,
      jobId: true,
      datasetRevisionId: true,
      status: true,
      finalSafetensorsArtifactId: true,
      finalSha256: true,
      job: { select: JOB_SUMMARY_SELECT },
      datasetRevision: { select: DATASET_REVISION_SELECT },
    },
  });
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

export async function createCharacterLoraBenchmarkRunWithTask(input: {
  benchmarkRunId: string;
  jobId: string;
  trainingRunId: string;
  loraAssetId?: string | null;
  templateId?: string | null;
  checkpointMatrix: Prisma.InputJsonValue;
  weightMatrix: Prisma.InputJsonValue;
  taskPayload?: CharacterLoraBenchmarkTaskPayload | null;
  tempPreset: {
    categoryName: string;
    categorySlug: string;
    presetName: string;
    presetSlug: string;
    variantName: string;
    variantSlug: string;
    prompt: string;
    negativePrompt?: string | null;
    lora1: Prisma.InputJsonValue;
    lora2: Prisma.InputJsonValue;
    notes: string;
  };
  tempProject: {
    title: string;
    notes: string;
    checkpointName?: string | null;
    checkpointMatrix: string[];
    weightMatrix: number[];
    loraPath: string;
    sectionLoraConfig: Prisma.InputJsonValue;
    promptBlock: {
      label: string;
      positive: string;
      negative?: string | null;
    };
    fallbackSections: Array<{
      name: string;
      sortOrder?: number | null;
      promptBlock: {
        label: string;
        positive: string;
        negative?: string | null;
      };
    }>;
  };
}) {
  const result = await db.$transaction(async (tx) => {
    const category = await ensurePresetCategory(tx, {
      name: input.tempPreset.categoryName,
      slug: input.tempPreset.categorySlug,
      icon: "UserRound",
      color: "78 50% 55%",
    });
    const presetSlug = await resolveUniquePresetSlug(tx, category.id, input.tempPreset.presetSlug);
    const preset = await tx.preset.create({
      data: {
        categoryId: category.id,
        name: input.tempPreset.presetName,
        slug: presetSlug,
        notes: input.tempPreset.notes,
        variants: {
          create: {
            name: input.tempPreset.variantName,
            slug: input.tempPreset.variantSlug,
            prompt: input.tempPreset.prompt,
            negativePrompt: input.tempPreset.negativePrompt ?? null,
            lora1: input.tempPreset.lora1,
            lora2: input.tempPreset.lora2,
            sortOrder: 0,
          },
        },
      },
      include: { variants: { select: { id: true, slug: true }, take: 1 } },
    });
    const variantId = preset.variants[0]?.id ?? null;
    const projectSlug = await resolveUniqueProjectSlugForRepository(tx, input.tempProject.title);
    const template = input.templateId
      ? await tx.projectTemplate.findUnique({
          where: { id: input.templateId },
          include: {
            sectionFolders: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }] },
            sections: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          },
        })
      : null;
    const project = await tx.project.create({
      data: {
        title: input.tempProject.title,
        slug: projectSlug,
        status: "draft",
        checkpointName: input.tempProject.checkpointName ?? null,
        presetBindings: toInputJsonValue([{
          categoryId: category.id,
          presetId: preset.id,
          variantId,
        }]),
        notes: input.tempProject.notes,
      },
      select: { id: true },
    });

    if (template) {
      const folderIdMap = new Map<string, string>();
      for (const folder of template.sectionFolders) {
        const created = await tx.projectSectionFolder.create({
          data: {
            projectId: project.id,
            parentId: folder.parentId ? folderIdMap.get(folder.parentId) ?? null : null,
            name: folder.name,
            sortOrder: folder.sortOrder,
          },
          select: { id: true },
        });
        folderIdMap.set(folder.id, created.id);
      }

      let expandedSortOrder = 0;
      for (const [index, section] of template.sections.entries()) {
        const blocks = normalizeTemplatePromptBlocks(section.promptBlocks, input.tempProject.promptBlock);
        for (const matrixItem of buildBenchmarkMatrixItems(input.tempProject.checkpointMatrix, input.tempProject.weightMatrix)) {
          const matrixMetadata = buildBenchmarkSectionMetadata({
            benchmarkRunId: input.benchmarkRunId,
            baseSectionIndex: index,
            originalSectionName: section.name ?? `Section ${index + 1}`,
            originalSortOrder: section.sortOrder ?? index,
            matrixItem,
          });
          const decoratedBlocks = decorateBenchmarkPromptBlocks(blocks, matrixMetadata);
          await tx.projectSection.create({
            data: {
              projectId: project.id,
              folderId: section.folderId ? folderIdMap.get(section.folderId) ?? null : null,
              sortOrder: expandedSortOrder,
              enabled: true,
              name: section.name,
              positivePrompt: decoratedBlocks.map((block) => block.positive).filter(Boolean).join("\n"),
              negativePrompt: decoratedBlocks.map((block) => block.negative).filter(Boolean).join("\n") || null,
              aspectRatio: section.aspectRatio,
              shortSidePx: section.shortSidePx,
              batchSize: section.batchSize,
              seedPolicy1: section.seedPolicy1,
              seedPolicy2: section.seedPolicy2,
              ksampler1: cloneJsonValueForRepository(section.ksampler1),
              ksampler2: cloneJsonValueForRepository(section.ksampler2),
              upscaleFactor: section.upscaleFactor,
              checkpointName: matrixItem.checkpointName,
              loraConfig: buildBenchmarkSectionLoraConfig(input.tempProject.loraPath, matrixItem.weight),
              extraParams: buildBenchmarkExtraParams(section.extraParams, matrixMetadata),
              promptBlocks: {
                create: decoratedBlocks.map((block, blockIndex) => ({
                  type: "custom",
                  label: block.label,
                  positive: block.positive,
                  negative: block.negative ?? null,
                  sortOrder: block.sortOrder ?? blockIndex,
                })),
              },
            },
            select: { id: true },
          });
          expandedSortOrder += 1;
        }
      }
    } else {
      if (input.tempProject.fallbackSections.length === 0) {
        throw new Error("Benchmark fallback sections are required when no template is available.");
      }

      let expandedSortOrder = 0;
      for (const [index, section] of input.tempProject.fallbackSections.entries()) {
        const blocks = [{ ...section.promptBlock, sortOrder: 0 }];
        for (const matrixItem of buildBenchmarkMatrixItems(input.tempProject.checkpointMatrix, input.tempProject.weightMatrix)) {
          const matrixMetadata = buildBenchmarkSectionMetadata({
            benchmarkRunId: input.benchmarkRunId,
            baseSectionIndex: index,
            originalSectionName: section.name,
            originalSortOrder: section.sortOrder ?? index,
            matrixItem,
          });
          const decoratedBlocks = decorateBenchmarkPromptBlocks(blocks, matrixMetadata);
          await tx.projectSection.create({
            data: {
              projectId: project.id,
              sortOrder: expandedSortOrder,
              enabled: true,
              name: section.name,
              positivePrompt: decoratedBlocks.map((block) => block.positive).filter(Boolean).join("\n"),
              negativePrompt: decoratedBlocks.map((block) => block.negative).filter(Boolean).join("\n") || null,
              checkpointName: matrixItem.checkpointName,
              loraConfig: buildBenchmarkSectionLoraConfig(input.tempProject.loraPath, matrixItem.weight),
              extraParams: buildBenchmarkExtraParams(null, matrixMetadata),
              promptBlocks: {
                create: decoratedBlocks.map((block, blockIndex) => ({
                  type: "custom",
                  label: block.label,
                  positive: block.positive,
                  negative: block.negative ?? null,
                  sortOrder: block.sortOrder ?? blockIndex,
                })),
              },
            },
            select: { id: true },
          });
          expandedSortOrder += 1;
        }
      }
    }

    const run = await tx.characterLoraBenchmarkRun.create({
      data: {
        id: input.benchmarkRunId,
        jobId: input.jobId,
        trainingRunId: input.trainingRunId,
        status: CharacterLoraRunStatus.queued,
        loraAssetId: input.loraAssetId ?? null,
        testPresetId: preset.id,
        testProjectId: project.id,
        templateId: template?.id ?? input.templateId ?? null,
        checkpointMatrix: input.checkpointMatrix,
        weightMatrix: input.weightMatrix,
      },
      select: BENCHMARK_RUN_SELECT,
    });

    const task = input.taskPayload
      ? await tx.characterLoraWorkerTask.create({
          data: {
            jobId: input.jobId,
            workerType: CharacterLoraWorkerType.benchmark,
            targetType: "benchmarkRun",
            targetId: run.id,
            status: CharacterLoraRunStatus.queued,
            payload: toInputJsonValue(input.taskPayload),
          },
          select: { id: true },
        })
      : null;

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.benchmarking,
        phase: "benchmark",
        failureSummary: null,
      },
      select: { id: true },
    });

    return { run, taskId: task?.id ?? null, testPresetId: preset.id, testProjectId: project.id };
  });

  return {
    benchmarkRun: serializeBenchmarkRun(result.run),
    workerTaskId: result.taskId,
    testPresetId: result.testPresetId,
    testProjectId: result.testProjectId,
  };
}

export async function listCharacterLoraBenchmarkRunsByJob(jobId: string) {
  const runs = await db.characterLoraBenchmarkRun.findMany({
    where: { jobId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: BENCHMARK_RUN_SELECT,
  });

  return runs.map(serializeBenchmarkRun);
}

export async function listCharacterLoraBenchmarkRunsByTrainingRun(trainingRunId: string) {
  const runs = await db.characterLoraBenchmarkRun.findMany({
    where: { trainingRunId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: BENCHMARK_RUN_SELECT,
  });

  return runs.map(serializeBenchmarkRun);
}

export async function getCharacterLoraBenchmarkRun(benchmarkRunId: string) {
  const run = await db.characterLoraBenchmarkRun.findUnique({
    where: { id: benchmarkRunId },
    select: BENCHMARK_RUN_SELECT,
  });

  return run ? serializeBenchmarkRun(run) : null;
}

export async function getCharacterLoraBenchmarkMatrixExpansionSummary(benchmarkRunId: string) {
  const benchmark = await db.characterLoraBenchmarkRun.findUnique({
    where: { id: benchmarkRunId },
    select: {
      testProjectId: true,
      checkpointMatrix: true,
      weightMatrix: true,
    },
  });
  if (!benchmark?.testProjectId) {
    return null;
  }

  const sections = await db.projectSection.findMany({
    where: { projectId: benchmark.testProjectId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      checkpointName: true,
      loraConfig: true,
      extraParams: true,
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          label: true,
          positive: true,
        },
      },
    },
  });

  return buildBenchmarkMatrixExpansionSummary({
    checkpointMatrix: readStringArrayFromJson(benchmark.checkpointMatrix),
    weightMatrix: readNumberArrayFromJson(benchmark.weightMatrix),
    sections,
  });
}

export async function completeCharacterLoraBenchmarkRunInRepository(input: {
  benchmarkRunId: string;
  reportArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata?: Prisma.InputJsonValue | null;
  };
  recommendedWeight: number;
  resultSummary: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const run = await tx.characterLoraBenchmarkRun.findUnique({
      where: { id: input.benchmarkRunId },
      select: { id: true, jobId: true },
    });
    if (!run) return null;

    const artifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: run.jobId,
        kind: "benchmark_report",
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

    await tx.characterLoraWorkerTask.updateMany({
      where: {
        targetType: "benchmarkRun",
        targetId: run.id,
        status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
      },
      data: {
        status: CharacterLoraRunStatus.done,
        finishedAt: new Date(),
        heartbeatAt: new Date(),
        leaseExpiresAt: null,
        progressJson: toInputJsonValue({ completed: true, reportArtifactId: artifact.id }),
        errorSummary: null,
      },
    });

    const updated = await tx.characterLoraBenchmarkRun.update({
      where: { id: run.id },
      data: {
        status: CharacterLoraRunStatus.done,
        reportArtifactId: artifact.id,
        recommendedWeight: input.recommendedWeight,
        resultSummary: input.resultSummary,
        finishedAt: new Date(),
      },
      select: BENCHMARK_RUN_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: run.jobId },
      data: {
        status: CharacterLoraJobStatus.benchmark_review,
        phase: "benchmark",
        failureSummary: null,
      },
      select: { id: true },
    });

    return updated;
  });

  return result ? serializeBenchmarkRun(result) : null;
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
  rejectedReturnPoint?: "benchmark_review" | "dataset_ready" | "trained" | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const benchmark = await tx.characterLoraBenchmarkRun.findUnique({
      where: { id: input.benchmarkRunId },
      select: { id: true, jobId: true, status: true, resultSummary: true },
    });
    if (!benchmark) return null;

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
        decidedAt: new Date(),
      },
      select: PROMOTION_DECISION_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: benchmark.jobId },
      data: {
        status: input.status === "approved"
          ? CharacterLoraJobStatus.promotion_ready
          : (input.rejectedReturnPoint ?? "benchmark_review"),
        phase: input.status === "approved" ? "promotion" : "benchmark",
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
      await tx.presetVariant.create({
        data: {
          presetId: preset.id,
          name: variant.name,
          slug: variant.slug,
          prompt: variant.prompt,
          negativePrompt: variant.negativePrompt ?? null,
          lora1: variant.lora1,
          lora2: variant.lora2,
          linkedVariants: variant.linkedVariants ?? Prisma.DbNull,
          sortOrder: variant.sortOrder,
          isActive: true,
        },
        select: { id: true },
      });
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

export async function findCharacterLoraBenchmarkTemplate() {
  return db.projectTemplate.findFirst({
    where: {
      OR: [
        { name: { contains: "角色 lora 测试" } },
        { name: { contains: "角色 LoRA 测试" } },
        { name: { contains: "character lora" } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
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

export async function countActiveComfyQueueRuns() {
  const [queued, running] = await Promise.all([
    db.run.count({ where: { status: RunStatus.queued } }),
    db.run.count({ where: { status: RunStatus.running } }),
  ]);

  return { queued, running };
}

export async function listActiveCharacterLoraGpuTaskLocks() {
  const locks = await db.gpuTaskLock.findMany({
    where: { status: "active" },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: GPU_TASK_LOCK_SELECT,
  });

  return locks.map(serializeGpuTaskLock);
}

export async function getCurrentCharacterLoraGpuTaskLock() {
  const lock = await db.gpuTaskLock.findFirst({
    where: { status: "active" },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: GPU_TASK_LOCK_SELECT,
  });

  return lock ? serializeGpuTaskLock(lock) : null;
}

export async function createCharacterLoraTrainingRunWithTask(input: {
  trainingRunId: string;
  jobId: string;
  datasetRevisionId: string;
  launcher: string;
  resolvedConfig: Prisma.InputJsonValue;
  outputDir: string;
  configArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  };
  dryRunSummaryArtifact?: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  } | null;
  taskPayload: CharacterLoraTrainingTaskPayload;
  gpuLockMetadata: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const configArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: input.jobId,
        kind: "training_config",
        relativePath: input.configArtifact.relativePath,
        absolutePath: input.configArtifact.absolutePath,
        sha256: input.configArtifact.sha256,
        byteSize: input.configArtifact.byteSize,
        mimeType: "application/toml",
        redactionLevel: "path_only",
        metadata: input.configArtifact.metadata,
      },
      select: { id: true },
    });

    const dryRunSummaryArtifact = input.dryRunSummaryArtifact
      ? await tx.characterLoraArtifact.create({
          data: {
            jobId: input.jobId,
            kind: "training_config",
            relativePath: input.dryRunSummaryArtifact.relativePath,
            absolutePath: input.dryRunSummaryArtifact.absolutePath,
            sha256: input.dryRunSummaryArtifact.sha256,
            byteSize: input.dryRunSummaryArtifact.byteSize,
            mimeType: "application/json",
            redactionLevel: "path_only",
            metadata: input.dryRunSummaryArtifact.metadata,
          },
          select: { id: true },
        })
      : null;

    const targetSteps = extractTargetSteps(input.resolvedConfig);
    const run = await tx.characterLoraTrainingRun.create({
      data: {
        id: input.trainingRunId,
        jobId: input.jobId,
        datasetRevisionId: input.datasetRevisionId,
        status: CharacterLoraRunStatus.queued,
        launcher: input.launcher,
        resolvedConfig: input.resolvedConfig,
        configArtifactId: configArtifact.id,
        dryRunSummaryArtifactId: dryRunSummaryArtifact?.id ?? null,
        outputDir: input.outputDir,
        targetSteps,
      },
      select: TRAINING_RUN_SELECT,
    });

    const task = await tx.characterLoraWorkerTask.create({
      data: {
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.training,
        targetType: "trainingRun",
        targetId: run.id,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
      },
      select: { id: true },
    });

    const gpuLock = await tx.gpuTaskLock.create({
      data: {
        taskType: "training",
        ownerType: "character_lora_training_run",
        ownerId: run.id,
        status: "active",
        metadata: input.gpuLockMetadata,
      },
      select: GPU_TASK_LOCK_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.training_queued,
        phase: "training",
        selectedDatasetRevisionId: input.datasetRevisionId,
        failureSummary: null,
      },
      select: { id: true },
    });

    return { run, taskId: task.id, gpuLock };
  });

  return {
    trainingRun: serializeTrainingRun(result.run),
    workerTaskId: result.taskId,
    gpuTaskLock: serializeGpuTaskLock(result.gpuLock),
  };
}

export async function createCharacterLoraDatasetFreezeWorkerTask(input: {
  jobId: string;
  revisionId: string;
  taskPayload: CharacterLoraDatasetFreezeTaskPayload;
}) {
  const task = await db.$transaction(async (tx) => {
    const created = await tx.characterLoraWorkerTask.create({
      data: {
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.dataset_freeze,
        targetType: "datasetRevision",
        targetId: input.revisionId,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
      },
      select: WORKER_TASK_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        phase: "dataset",
        failureSummary: null,
      },
      select: { id: true },
    });

    return created;
  });

  return serializeWorkerTask(task);
}

export async function leaseNextCharacterLoraWorkerTask(input: {
  workerType: CharacterLoraWorkerType;
  leaseOwner: string;
  leaseExpiresAt: Date;
}) {
  const task = await db.$transaction(async (tx) => {
    const now = new Date();
    const queued = await tx.characterLoraWorkerTask.findFirst({
      where: {
        workerType: input.workerType,
        OR: [
          { status: CharacterLoraRunStatus.queued },
          {
            status: CharacterLoraRunStatus.running,
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: { id: true, targetType: true, targetId: true, status: true },
    });

    if (!queued) {
      return null;
    }

    const claimed = await tx.characterLoraWorkerTask.updateMany({
      where: {
        id: queued.id,
        OR: [
          { status: CharacterLoraRunStatus.queued },
          {
            status: CharacterLoraRunStatus.running,
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      data: {
        status: CharacterLoraRunStatus.running,
        leaseOwner: input.leaseOwner,
        leaseExpiresAt: input.leaseExpiresAt,
        attemptCount: { increment: 1 },
        startedAt: now,
        heartbeatAt: now,
        errorSummary: null,
      },
    });

    if (claimed.count !== 1) {
      return null;
    }

    if (queued.targetType === "generationRun") {
      await tx.characterLoraGenerationRun.updateMany({
        where: {
          id: queued.targetId,
          status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
        },
        data: {
          status: CharacterLoraRunStatus.running,
          startedAt: queued.status === CharacterLoraRunStatus.queued ? now : undefined,
          errorSummary: null,
        },
      });
    }

    if (queued.targetType === "trainingRun") {
      const run = await tx.characterLoraTrainingRun.update({
        where: { id: queued.targetId },
        data: {
          status: CharacterLoraRunStatus.running,
          startedAt: queued.status === CharacterLoraRunStatus.queued ? now : undefined,
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.training_running,
          phase: "training",
          failureSummary: null,
        },
        select: { id: true },
      });
    }

    if (queued.targetType === "benchmarkRun") {
      const run = await tx.characterLoraBenchmarkRun.update({
        where: { id: queued.targetId },
        data: {
          status: CharacterLoraRunStatus.running,
          startedAt: queued.status === CharacterLoraRunStatus.queued ? now : undefined,
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.benchmarking,
          phase: "benchmark",
          failureSummary: null,
        },
        select: { id: true },
      });
    }

    return tx.characterLoraWorkerTask.findUnique({
      where: { id: queued.id },
      select: WORKER_TASK_SELECT,
    });
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function getCharacterLoraWorkerTask(taskId: string) {
  const task = await db.characterLoraWorkerTask.findUnique({
    where: { id: taskId },
    select: WORKER_TASK_SELECT,
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function getCharacterLoraWorkerTaskForTarget(input: {
  targetType: string;
  targetId: string;
}) {
  const task = await db.characterLoraWorkerTask.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: WORKER_TASK_SELECT,
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function heartbeatCharacterLoraWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  progressJson?: Prisma.InputJsonValue;
}) {
  const task = await db.$transaction(async (tx) => {
    const existing = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!existing || existing.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && existing.leaseOwner !== input.leaseOwner) {
      return null;
    }

    const updated = await tx.characterLoraWorkerTask.update({
      where: { id: input.taskId },
      data: {
        heartbeatAt: new Date(),
        ...(input.leaseExpiresAt ? { leaseExpiresAt: input.leaseExpiresAt } : {}),
        ...(input.progressJson ? { progressJson: input.progressJson } : {}),
      },
      select: WORKER_TASK_SELECT,
    });

    if (updated.targetType === "trainingRun") {
      const progress = extractTrainingProgressUpdate(input.progressJson);
      const run = await tx.characterLoraTrainingRun.update({
        where: { id: updated.targetId },
        data: {
          status: CharacterLoraRunStatus.running,
          currentStep: progress.currentStep,
          targetSteps: progress.targetSteps,
          lossSnapshot: progress.lossSnapshot,
          startedAt: updated.startedAt,
        },
        select: { jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: { status: CharacterLoraJobStatus.training_running, phase: "training" },
        select: { id: true },
      });
    }

    return updated;
  });

  return task ? serializeWorkerTask(task) : null;
}

export async function completeImageGenerationWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  output: CharacterLoraImageGenerationOutput;
  imageArtifacts: Array<{
    relativePath: string;
    absolutePath: string;
    sha256: string;
    width?: number | null;
    height?: number | null;
    byteSize?: bigint | number | null;
    metadata?: Prisma.InputJsonValue | null;
  }>;
  responseSummaryArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  };
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    const run = await tx.characterLoraGenerationRun.findUnique({
      where: { id: task.targetId },
      select: {
        ...GENERATION_RUN_SUMMARY_SELECT,
        job: { select: { triggerToken: true } },
        section: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (!run || task.targetType !== "generationRun") {
      return null;
    }

    const responseArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: run.jobId,
        kind: "provider_payload",
        relativePath: input.responseSummaryArtifact.relativePath,
        absolutePath: input.responseSummaryArtifact.absolutePath,
        sha256: input.responseSummaryArtifact.sha256,
        byteSize: input.responseSummaryArtifact.byteSize,
        mimeType: "application/json",
        redactionLevel: "payload_redacted",
        metadata: input.responseSummaryArtifact.metadata,
      },
      select: { id: true },
    });

    const artifacts = [];
    for (const artifactInput of input.imageArtifacts) {
      artifacts.push(
        await tx.characterLoraArtifact.create({
          data: {
            jobId: run.jobId,
            kind: run.kind === "canonical" ? "canonical_image" : "candidate_image",
            relativePath: artifactInput.relativePath,
            absolutePath: artifactInput.absolutePath,
            sha256: artifactInput.sha256,
            byteSize: artifactInput.byteSize ?? null,
            mimeType: "image/png",
            redactionLevel: "path_only",
            metadata: artifactInput.metadata ?? Prisma.DbNull,
          },
          select: { id: true, relativePath: true, sha256: true, byteSize: true },
        }),
      );
    }

    if (run.kind === "canonical") {
      const previous = await tx.characterLoraCanonicalVersion.findFirst({
        where: { jobId: run.jobId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      let nextVersion = (previous?.version ?? 0) + 1;

      for (const artifact of artifacts) {
        await tx.characterLoraCanonicalVersion.create({
          data: {
            jobId: run.jobId,
            version: nextVersion,
            status: "candidate",
            sourceRunId: run.id,
            imageArtifactId: artifact.id,
            notes: `worker generated canonical image ${artifact.relativePath}`,
          },
          select: { id: true },
        });
        nextVersion += 1;
      }
    } else {
      for (let index = 0; index < artifacts.length; index += 1) {
        const artifact = artifacts[index];
        const image = input.imageArtifacts[index];
        await tx.characterLoraCandidateImage.create({
          data: {
            jobId: run.jobId,
            sectionId: run.sectionId,
            generationRunId: run.id,
            artifactId: artifact.id,
            filePath: artifact.relativePath,
            sha256: artifact.sha256 ?? image.sha256,
            width: image.width ?? null,
            height: image.height ?? null,
            fileSize: artifact.byteSize,
            reviewStatus: CharacterLoraImageReviewStatus.pending,
            captionDraft: buildDefaultCaption(run.job.triggerToken, run.section?.name ?? null, run.visualPrompt),
          },
          select: { id: true },
        });
      }

      if (run.sectionId) {
        await refreshSectionCounts(tx, [run.sectionId]);
      }

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: { status: CharacterLoraJobStatus.reviewing, phase: "review" },
        select: { id: true },
      });
    }

    await tx.characterLoraGenerationRun.update({
      where: { id: run.id },
      data: {
        status: CharacterLoraRunStatus.done,
        responseSummary: toInputJsonValue({
          ...input.output,
          responseSummaryArtifactId: responseArtifact.id,
        }),
        errorSummary: null,
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    const completedTask = await tx.characterLoraWorkerTask.update({
      where: { id: task.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });

    const refreshedRun = await tx.characterLoraGenerationRun.findUnique({
      where: { id: run.id },
      select: GENERATION_RUN_SUMMARY_SELECT,
    });

    return { task: completedTask, generationRun: refreshedRun };
  });

  return result
    ? {
        task: serializeWorkerTask(result.task),
        generationRun: result.generationRun ? serializeGenerationRun(result.generationRun) : null,
      }
    : null;
}

export async function completeTrainingWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  output: CharacterLoraTrainingCompleteOutput;
  finalArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize?: bigint | number | null;
    metadata?: Prisma.InputJsonValue | null;
  };
  logArtifact?: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize?: bigint | number | null;
    metadata?: Prisma.InputJsonValue | null;
  } | null;
  checkpoints: Array<{
    step: number;
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize?: bigint | number | null;
    metrics?: Prisma.InputJsonValue | null;
  }>;
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    if (task.targetType !== "trainingRun") {
      return null;
    }

    const run = await tx.characterLoraTrainingRun.findUnique({
      where: { id: task.targetId },
      select: { id: true, jobId: true, targetSteps: true },
    });

    if (!run) {
      return null;
    }

    const finalArtifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: run.jobId,
        kind: "safetensors",
        relativePath: input.finalArtifact.relativePath,
        absolutePath: input.finalArtifact.absolutePath,
        sha256: input.finalArtifact.sha256,
        byteSize: input.finalArtifact.byteSize ?? null,
        mimeType: "application/octet-stream",
        redactionLevel: "path_only",
        metadata: input.finalArtifact.metadata ?? Prisma.DbNull,
      },
      select: { id: true },
    });

    const logArtifact = input.logArtifact
      ? await tx.characterLoraArtifact.create({
          data: {
            jobId: run.jobId,
            kind: "training_log",
            relativePath: input.logArtifact.relativePath,
            absolutePath: input.logArtifact.absolutePath,
            sha256: input.logArtifact.sha256,
            byteSize: input.logArtifact.byteSize ?? null,
            mimeType: "text/plain",
            redactionLevel: "path_only",
            metadata: input.logArtifact.metadata ?? Prisma.DbNull,
          },
          select: { id: true },
        })
      : null;

    for (const checkpoint of input.checkpoints) {
      const checkpointArtifact =
        checkpoint.relativePath === input.finalArtifact.relativePath
          ? finalArtifact
          : await tx.characterLoraArtifact.create({
              data: {
                jobId: run.jobId,
                kind: "safetensors",
                relativePath: checkpoint.relativePath,
                absolutePath: checkpoint.absolutePath,
                sha256: checkpoint.sha256,
                byteSize: checkpoint.byteSize ?? null,
                mimeType: "application/octet-stream",
                redactionLevel: "path_only",
                metadata: checkpoint.metrics ?? Prisma.DbNull,
              },
              select: { id: true },
            });

      await tx.characterLoraTrainingCheckpoint.upsert({
        where: {
          trainingRunId_step: {
            trainingRunId: run.id,
            step: checkpoint.step,
          },
        },
        update: {
          artifactId: checkpointArtifact.id,
          sha256: checkpoint.sha256,
          metrics: checkpoint.metrics ?? Prisma.DbNull,
        },
        create: {
          trainingRunId: run.id,
          step: checkpoint.step,
          artifactId: checkpointArtifact.id,
          sha256: checkpoint.sha256,
          metrics: checkpoint.metrics ?? Prisma.DbNull,
        },
        select: { id: true },
      });
    }

    await tx.characterLoraTrainingRun.update({
      where: { id: run.id },
      data: {
        status: CharacterLoraRunStatus.done,
        logArtifactId: logArtifact?.id ?? null,
        finalSafetensorsArtifactId: finalArtifact.id,
        finalSha256: input.finalArtifact.sha256,
        metadataSummary: toInputJsonValue(input.output.metadataSummary),
        currentStep: extractCompletionStep(input.output),
        targetSteps: run.targetSteps ?? extractCompletionStep(input.output),
        lossSnapshot: toInputJsonValue({
          final: true,
          hashes: input.output.hashes ?? {},
        }),
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: run.jobId },
      data: {
        status: CharacterLoraJobStatus.trained,
        phase: "training",
        failureSummary: null,
      },
      select: { id: true },
    });

    const completedTask = await tx.characterLoraWorkerTask.update({
      where: { id: task.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        progressJson: toInputJsonValue({
          completed: true,
          finalSafetensorsArtifactId: finalArtifact.id,
          finalSha256: input.finalArtifact.sha256,
        }),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });

    await tx.gpuTaskLock.updateMany({
      where: {
        ownerType: "character_lora_training_run",
        ownerId: run.id,
        status: "active",
      },
      data: {
        status: "released",
        releasedAt: new Date(),
      },
    });

    const refreshedRun = await tx.characterLoraTrainingRun.findUnique({
      where: { id: run.id },
      select: TRAINING_RUN_SELECT,
    });

    return { task: completedTask, trainingRun: refreshedRun };
  });

  return result
    ? {
        task: serializeWorkerTask(result.task),
        trainingRun: result.trainingRun ? serializeTrainingRun(result.trainingRun) : null,
      }
    : null;
}

export async function failCharacterLoraWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  errorSummary: string;
  progressJson?: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    const shouldMarkTrainingCancelled =
      task.targetType === "trainingRun" &&
      (input.errorSummary.toLowerCase().includes("cancel") ||
        hasCancelRequested(task.progressJson) ||
        hasCancelRequested(input.progressJson));
    const terminalStatus = shouldMarkTrainingCancelled ? CharacterLoraRunStatus.cancelled : CharacterLoraRunStatus.failed;
    const terminalJobStatus = shouldMarkTrainingCancelled ? CharacterLoraJobStatus.cancelled : CharacterLoraJobStatus.failed;

    await tx.characterLoraWorkerTask.update({
      where: { id: input.taskId },
      data: {
        status: terminalStatus,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        progressJson: input.progressJson ?? task.progressJson ?? Prisma.DbNull,
        errorSummary: input.errorSummary,
      },
      select: { id: true },
    });

    if (task.targetType === "generationRun") {
      const run = await tx.characterLoraGenerationRun.update({
        where: { id: task.targetId },
        data: {
          status: CharacterLoraRunStatus.failed,
          errorSummary: input.errorSummary,
          finishedAt: new Date(),
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.failed,
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });
    }

    if (task.targetType === "trainingRun") {
      const run = await tx.characterLoraTrainingRun.update({
        where: { id: task.targetId },
        data: {
          status: terminalStatus,
          finishedAt: new Date(),
          lossSnapshot: input.progressJson ?? task.progressJson ?? Prisma.DbNull,
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: terminalJobStatus,
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });

      await tx.gpuTaskLock.updateMany({
        where: {
          ownerType: "character_lora_training_run",
          ownerId: run.id,
          status: "active",
        },
        data: {
          status: "released",
          releasedAt: new Date(),
        },
      });
    }

    if (task.targetType === "benchmarkRun") {
      const run = await tx.characterLoraBenchmarkRun.update({
        where: { id: task.targetId },
        data: {
          status: CharacterLoraRunStatus.failed,
          finishedAt: new Date(),
          resultSummary: toInputJsonValue({
            errorSummary: input.errorSummary,
            progressJson: input.progressJson ?? task.progressJson ?? null,
          }),
        },
        select: { id: true, jobId: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.failed,
          phase: "benchmark",
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });
    }

    if (task.targetType === "datasetRevision") {
      await tx.characterLoraTrainingJob.update({
        where: { id: task.jobId },
        data: {
          status: CharacterLoraJobStatus.failed,
          phase: "dataset",
          failureSummary: input.errorSummary,
        },
        select: { id: true },
      });
    }

    return tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });
  });

  return result ? serializeWorkerTask(result) : null;
}

export async function cancelCharacterLoraTrainingRun(input: {
  trainingRunId: string;
  reason?: string | null;
  requestedBy?: string | null;
  cancelSignalArtifact?: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  } | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const run = await tx.characterLoraTrainingRun.findUnique({
      where: { id: input.trainingRunId },
      select: TRAINING_RUN_SELECT,
    });

    if (!run) {
      return null;
    }

    const cancelSummary = {
      cancelRequested: true,
      reason: input.reason ?? null,
      requestedBy: input.requestedBy ?? null,
      cancelSignalPath: input.cancelSignalArtifact?.relativePath ?? null,
    };

    let cancelArtifactId: string | null = null;
    if (input.cancelSignalArtifact) {
      const artifact = await tx.characterLoraArtifact.create({
        data: {
          jobId: run.jobId,
          kind: "training_log",
          relativePath: input.cancelSignalArtifact.relativePath,
          absolutePath: input.cancelSignalArtifact.absolutePath,
          sha256: input.cancelSignalArtifact.sha256,
          byteSize: input.cancelSignalArtifact.byteSize,
          mimeType: "application/json",
          redactionLevel: "path_only",
          metadata: input.cancelSignalArtifact.metadata,
        },
        select: { id: true },
      });
      cancelArtifactId = artifact.id;
    }

    if (run.status === CharacterLoraRunStatus.queued) {
      await tx.characterLoraWorkerTask.updateMany({
        where: {
          targetType: "trainingRun",
          targetId: run.id,
          status: CharacterLoraRunStatus.queued,
        },
        data: {
          status: CharacterLoraRunStatus.cancelled,
          finishedAt: new Date(),
          progressJson: toInputJsonValue(cancelSummary),
          errorSummary: input.reason ?? "Training run cancelled before lease",
        },
      });

      await tx.characterLoraTrainingRun.update({
        where: { id: run.id },
        data: {
          status: CharacterLoraRunStatus.cancelled,
          cancelRequestedAt: new Date(),
          finishedAt: new Date(),
          lossSnapshot: toInputJsonValue({
            ...cancelSummary,
            cancelSignalArtifactId: cancelArtifactId,
          }),
        },
        select: { id: true },
      });

      await tx.characterLoraTrainingJob.update({
        where: { id: run.jobId },
        data: {
          status: CharacterLoraJobStatus.cancelled,
          phase: "training",
          failureSummary: input.reason ?? "Training run cancelled before lease",
        },
        select: { id: true },
      });

      await tx.gpuTaskLock.updateMany({
        where: {
          ownerType: "character_lora_training_run",
          ownerId: run.id,
          status: "active",
        },
        data: {
          status: "released",
          releasedAt: new Date(),
        },
      });
    } else if (run.status === CharacterLoraRunStatus.running) {
      await tx.characterLoraWorkerTask.updateMany({
        where: {
          targetType: "trainingRun",
          targetId: run.id,
          status: CharacterLoraRunStatus.running,
        },
        data: {
          progressJson: toInputJsonValue(cancelSummary),
          heartbeatAt: new Date(),
        },
      });

      await tx.characterLoraTrainingRun.update({
        where: { id: run.id },
        data: {
          cancelRequestedAt: new Date(),
          lossSnapshot: toInputJsonValue({
            ...cancelSummary,
            cancelSignalArtifactId: cancelArtifactId,
          }),
        },
        select: { id: true },
      });
    }

    const refreshedRun = await tx.characterLoraTrainingRun.findUnique({
      where: { id: run.id },
      select: TRAINING_RUN_SELECT,
    });

    return refreshedRun;
  });

  return result ? serializeTrainingRun(result) : null;
}

export async function listCharacterLoraDatasetRevisions(jobId: string) {
  const revisions = await db.characterLoraDatasetRevision.findMany({
    where: { jobId },
    orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    select: DATASET_REVISION_SELECT,
  });

  return revisions.map(serializeDatasetRevision);
}

export async function getNextCharacterLoraDatasetRevisionVersion(jobId: string) {
  const previous = await db.characterLoraDatasetRevision.findFirst({
    where: { jobId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (previous?.version ?? 0) + 1;
}

export async function createFrozenCharacterLoraDatasetRevision(input: CharacterLoraDatasetRevisionCreateInput) {
  const result = await db.$transaction(async (tx) => {
    return createFrozenCharacterLoraDatasetRevisionInTx(tx, input);
  });

  return serializeDatasetRevision(result);
}

export async function completeDatasetFreezeWorkerTask(input: {
  taskId: string;
  leaseOwner?: string;
  revision: CharacterLoraDatasetRevisionCreateInput;
  progressJson?: Prisma.InputJsonValue;
}) {
  const result = await db.$transaction(async (tx) => {
    const task = await tx.characterLoraWorkerTask.findUnique({
      where: { id: input.taskId },
      select: WORKER_TASK_SELECT,
    });

    if (!task || task.status !== CharacterLoraRunStatus.running) {
      return null;
    }

    if (input.leaseOwner && task.leaseOwner !== input.leaseOwner) {
      return null;
    }

    if (
      task.workerType !== CharacterLoraWorkerType.dataset_freeze ||
      task.targetType !== "datasetRevision" ||
      task.targetId !== input.revision.revisionId
    ) {
      return null;
    }

    const revision = await createFrozenCharacterLoraDatasetRevisionInTx(tx, input.revision);
    const completedTask = await tx.characterLoraWorkerTask.update({
      where: { id: task.id },
      data: {
        status: CharacterLoraRunStatus.done,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        progressJson: input.progressJson ?? toInputJsonValue({
          completed: true,
          datasetRevisionId: revision.id,
          version: revision.version,
          itemCount: revision.itemCount,
        }),
        errorSummary: null,
      },
      select: WORKER_TASK_SELECT,
    });

    return { task: completedTask, revision };
  });

  return result
    ? {
        task: serializeWorkerTask(result.task),
        revision: serializeDatasetRevision(result.revision),
      }
    : null;
}

async function createFrozenCharacterLoraDatasetRevisionInTx(
  tx: Prisma.TransactionClient,
  input: CharacterLoraDatasetRevisionCreateInput,
) {
  const revision = await tx.characterLoraDatasetRevision.create({
    data: {
      id: input.revisionId,
      jobId: input.jobId,
      version: input.version,
      status: "frozen",
      canonicalVersionId: input.canonicalVersionId,
      promptCardVersionId: input.promptCardVersionId,
      captionStrategy: input.captionStrategy,
      itemCount: input.items.length,
      sourceCount: input.sourceCount,
      syntheticCount: input.syntheticCount,
      selectedManifestArtifactId: input.selectedManifestArtifactId,
      metadataJsonlArtifactId: input.metadataJsonlArtifactId,
      captionAuditArtifactId: input.captionAuditArtifactId,
      trainDir: input.trainDir,
      frozenAt: new Date(),
    },
    select: DATASET_REVISION_SELECT,
  });

  for (const item of input.items) {
    await tx.characterLoraDatasetItem.create({
      data: {
        datasetRevisionId: revision.id,
        candidateImageId: item.candidateImageId,
        imageArtifactId: item.imageArtifactId,
        captionArtifactId: item.captionArtifactId,
        captionText: item.captionText,
        repeatCount: item.repeatCount,
        sourceWeight: item.sourceWeight ?? null,
        sortOrder: item.sortOrder,
      },
      select: { id: true },
    });
  }

  await tx.characterLoraCandidateImage.updateMany({
    where: { id: { in: input.items.map((item) => item.candidateImageId) } },
    data: {
      reviewStatus: CharacterLoraImageReviewStatus.included_in_training,
      includedDatasetRevisionId: revision.id,
    },
  });

  const sectionIds = await tx.characterLoraCandidateImage.findMany({
    where: { id: { in: input.items.map((item) => item.candidateImageId) } },
    distinct: ["sectionId"],
    select: { sectionId: true },
  });

  await refreshSectionCounts(
    tx,
    sectionIds.map((section) => section.sectionId).filter((sectionId): sectionId is string => Boolean(sectionId)),
  );

  await tx.characterLoraTrainingJob.update({
    where: { id: input.jobId },
    data: {
      status: CharacterLoraJobStatus.dataset_ready,
      phase: "dataset",
      selectedDatasetRevisionId: revision.id,
    },
    select: { id: true },
  });

  return revision;
}

async function refreshSectionCounts(
  tx: Prisma.TransactionClient,
  sectionIds: string[],
) {
  for (const sectionId of sectionIds) {
    const [keepCount, rejectCount, pendingCount] = await Promise.all([
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

    await tx.characterLoraJobSection.update({
      where: { id: sectionId },
      data: {
        keepCount,
        rejectCount,
        pendingCount,
        status: pendingCount > 0 ? "reviewing" : "reviewed",
      },
      select: { id: true },
    });
  }
}

function buildDefaultCaption(triggerToken: string, sectionName: string | null, visualPrompt: string) {
  const pieces = [
    triggerToken,
    sectionName ? sectionName.toLowerCase() : null,
    visualPrompt.replace(/\s+/g, " ").slice(0, 180),
  ].filter((piece): piece is string => Boolean(piece));

  return pieces.join(", ");
}

function ciContains(value: string) {
  return detectProvider() === "postgresql"
    ? { contains: value, mode: "insensitive" as const }
    : { contains: value };
}

async function ensurePresetCategory(
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
      type: "preset",
    },
    select: { id: true, name: true, slug: true },
  });
}

async function resolveUniquePresetSlug(
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

async function resolveUniqueProjectSlugForRepository(
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

function slugifyForRepository(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function cloneJsonValueForRepository(value: unknown) {
  return value == null
    ? Prisma.DbNull
    : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildBenchmarkMatrixItems(checkpointMatrix: string[], weightMatrix: number[]) {
  return checkpointMatrix.flatMap((checkpointName, checkpointIndex) =>
    weightMatrix.map((weight, weightIndex) => ({
      checkpointName,
      checkpointIndex,
      weight: roundBenchmarkWeight(weight),
      weightIndex,
      matrixIndex: checkpointIndex * weightMatrix.length + weightIndex,
    })),
  );
}

function buildBenchmarkSectionMetadata(input: {
  benchmarkRunId: string;
  baseSectionIndex: number;
  originalSectionName: string;
  originalSortOrder: number;
  matrixItem: ReturnType<typeof buildBenchmarkMatrixItems>[number];
}) {
  return {
    benchmarkRunId: input.benchmarkRunId,
    originalSectionName: input.originalSectionName,
    originalSortOrder: input.originalSortOrder,
    baseSectionIndex: input.baseSectionIndex,
    checkpointName: input.matrixItem.checkpointName,
    checkpointIndex: input.matrixItem.checkpointIndex,
    weight: input.matrixItem.weight,
    weightIndex: input.matrixItem.weightIndex,
    matrixIndex: input.matrixItem.matrixIndex,
  };
}

function decorateBenchmarkPromptBlocks<T extends { label: string; positive: string; negative?: string | null; sortOrder?: number | null }>(
  blocks: T[],
  metadata: ReturnType<typeof buildBenchmarkSectionMetadata>,
) {
  const matrixLabel = [
    `section=${metadata.originalSectionName}`,
    `checkpoint=${shortCheckpointName(metadata.checkpointName)}`,
    `weight=${formatBenchmarkWeight(metadata.weight)}`,
  ].join(" | ");

  return blocks.map((block) => ({
    ...block,
    label: `${block.label} [${matrixLabel}]`,
  }));
}

function buildBenchmarkExtraParams(
  value: unknown,
  metadata: ReturnType<typeof buildBenchmarkSectionMetadata>,
) {
  const base = readJsonRecord(value);
  return toInputJsonValue({
    ...base,
    characterLoraBenchmark: metadata,
  });
}

function buildBenchmarkSectionLoraConfig(loraPath: string, weight: number) {
  return toInputJsonValue({
    lora1: [makeBenchmarkSectionLoraEntry(loraPath, weight, "lora1")],
    lora2: [makeBenchmarkSectionLoraEntry(loraPath, weight, "lora2")],
  });
}

function makeBenchmarkSectionLoraEntry(pathValue: string, weight: number, suffix: string) {
  return {
    id: `lora-${randomUUID()}`,
    path: pathValue,
    weight: roundBenchmarkWeight(weight),
    enabled: true,
    source: "preset",
    sourceLabel: "Character LoRA",
    sourceColor: "78 50% 55%",
    sourceName: "Character LoRA benchmark",
    bindingId: `bind-${suffix}-${randomUUID()}`,
  };
}

function buildBenchmarkMatrixExpansionSummary(input: {
  checkpointMatrix: string[];
  weightMatrix: number[];
  sections: Array<{
    id: string;
    name: string | null;
    sortOrder: number;
    checkpointName: string | null;
    loraConfig: unknown;
    extraParams: unknown;
    promptBlocks: Array<{
      label: string | null;
      positive: string;
    }>;
  }>;
}) {
  const sections = input.sections.map((section) => {
    const metadata = readBenchmarkMetadata(section.extraParams);
    const checkpointName = metadata?.checkpointName ?? section.checkpointName ?? null;
    const weight = metadata?.weight ?? readLoraWeight(section.loraConfig);
    return {
      projectSectionId: section.id,
      sectionName: section.name,
      sortOrder: section.sortOrder,
      originalSectionName: metadata?.originalSectionName ?? section.name,
      baseSectionIndex: metadata?.baseSectionIndex ?? null,
      originalSortOrder: metadata?.originalSortOrder ?? null,
      checkpointName,
      checkpointIndex: metadata?.checkpointIndex ?? inferStringIndex(input.checkpointMatrix, checkpointName),
      weight,
      weightIndex: metadata?.weightIndex ?? inferNumberIndex(input.weightMatrix, weight),
      matrixIndex: metadata?.matrixIndex ?? null,
      promptBlockLabels: section.promptBlocks
        .map((block) => block.label)
        .filter((label): label is string => Boolean(label)),
    };
  });
  const baseKeys = new Set(
    sections.map((section) =>
      section.baseSectionIndex !== null
        ? `index:${section.baseSectionIndex}`
        : `name:${section.originalSectionName ?? section.sectionName ?? section.sortOrder}`,
    ),
  );
  const matrixSize = Math.max(1, input.checkpointMatrix.length * input.weightMatrix.length);
  const baseSectionCount = baseKeys.size > 0 ? baseKeys.size : Math.floor(sections.length / matrixSize);

  return {
    expectedSectionCount: baseSectionCount * input.checkpointMatrix.length * input.weightMatrix.length,
    actualSectionCount: sections.length,
    baseSectionCount,
    checkpointMatrix: input.checkpointMatrix,
    weightMatrix: input.weightMatrix,
    sections,
  };
}

function readBenchmarkMetadata(value: unknown) {
  const metadata = readJsonRecord(readJsonRecord(value).characterLoraBenchmark);
  const originalSectionName = typeof metadata.originalSectionName === "string" ? metadata.originalSectionName : null;
  const checkpointName = typeof metadata.checkpointName === "string" ? metadata.checkpointName : null;
  const weight = typeof metadata.weight === "number" ? metadata.weight : null;
  if (!originalSectionName && !checkpointName && weight === null) {
    return null;
  }

  return {
    originalSectionName,
    originalSortOrder: typeof metadata.originalSortOrder === "number" ? metadata.originalSortOrder : null,
    baseSectionIndex: typeof metadata.baseSectionIndex === "number" ? metadata.baseSectionIndex : null,
    checkpointName,
    checkpointIndex: typeof metadata.checkpointIndex === "number" ? metadata.checkpointIndex : null,
    weight,
    weightIndex: typeof metadata.weightIndex === "number" ? metadata.weightIndex : null,
    matrixIndex: typeof metadata.matrixIndex === "number" ? metadata.matrixIndex : null,
  };
}

function readLoraWeight(value: unknown) {
  const record = readJsonRecord(value);
  for (const key of ["lora1", "lora2"] as const) {
    const entries = record[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const weight = readJsonRecord(entry).weight;
      if (typeof weight === "number" && weight > 0) {
        return roundBenchmarkWeight(weight);
      }
    }
  }
  return null;
}

function readStringArrayFromJson(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function readNumberArrayFromJson(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item) && item > 0)
      .map(roundBenchmarkWeight)
    : [];
}

function readJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    : {};
}

function inferStringIndex(values: string[], value: string | null) {
  if (!value) return null;
  const index = values.indexOf(value);
  return index >= 0 ? index : null;
}

function inferNumberIndex(values: number[], value: number | null) {
  if (value === null) return null;
  const index = values.findIndex((candidate) => roundBenchmarkWeight(candidate) === roundBenchmarkWeight(value));
  return index >= 0 ? index : null;
}

function shortCheckpointName(checkpointName: string) {
  return checkpointName.split(/[\\/]/).pop() ?? checkpointName;
}

function formatBenchmarkWeight(value: number) {
  return String(roundBenchmarkWeight(value));
}

function roundBenchmarkWeight(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeTemplatePromptBlocks(
  value: unknown,
  fallback: { label: string; positive: string; negative?: string | null },
) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ ...fallback, sortOrder: 0 }];
  }

  const blocks = value
    .map((block, index) => {
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        return null;
      }
      const record = block as Record<string, unknown>;
      const positive = typeof record.positive === "string" ? record.positive : "";
      return {
        label: typeof record.label === "string" && record.label.trim() ? record.label : `Block ${index + 1}`,
        positive,
        negative: typeof record.negative === "string" ? record.negative : null,
        sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
      };
    })
    .filter((block): block is { label: string; positive: string; negative: string | null; sortOrder: number } =>
      Boolean(block && (block.positive.trim() || block.negative?.trim())),
    );

  return blocks.length > 0 ? blocks : [{ ...fallback, sortOrder: 0 }];
}

function serializeJobSummary(job: JobSummaryRecord) {
  return {
    id: job.id,
    slug: job.slug,
    characterName: job.characterName,
    triggerToken: job.triggerToken,
    status: job.status,
    phase: job.phase,
    trainingScope: job.trainingScope,
    captionStrategy: job.captionStrategy,
    baseCheckpointName: job.baseCheckpointName,
    baseCheckpointPath: job.baseCheckpointPath,
    baseCheckpointHash: job.baseCheckpointHash,
    baseFamily: job.baseFamily,
    artifactRoot: job.artifactRoot,
    currentCanonicalVersionId: job.currentCanonicalVersionId,
    currentPromptCardVersionId: job.currentPromptCardVersionId,
    selectedDatasetRevisionId: job.selectedDatasetRevisionId,
    promotedPresetId: job.promotedPresetId,
    createdBy: job.createdBy,
    failureSummary: job.failureSummary,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    counts: {
      sourceImages: job._count.sourceImages,
      canonicalVersions: job._count.canonicalVersions,
      promptCardVersions: job._count.promptCardVersions,
      sections: job._count.sections,
      generationRuns: job._count.generationRuns,
      candidateImages: job._count.candidateImages,
      datasetRevisions: job._count.datasetRevisions,
      trainingRuns: job._count.trainingRuns,
      benchmarkRuns: job._count.benchmarkRuns,
      promotionDecisions: job._count.promotionDecisions,
      artifacts: job._count.artifacts,
      workerTasks: job._count.workerTasks,
    },
  };
}

function serializeSourceImage(sourceImage: SourceImageRecord) {
  return {
    id: sourceImage.id,
    jobId: sourceImage.jobId,
    role: sourceImage.role,
    artifactId: sourceImage.artifactId,
    filePath: sourceImage.filePath,
    relativePath: sourceImage.filePath,
    sha256: sourceImage.sha256,
    width: sourceImage.width,
    height: sourceImage.height,
    provenance: sourceImage.provenance,
    sortOrder: sourceImage.sortOrder,
    createdAt: sourceImage.createdAt.toISOString(),
  };
}

function serializeArtifactRef(artifact: ArtifactRefRecord) {
  return {
    id: artifact.id,
    jobId: artifact.jobId,
    kind: artifact.kind,
    relativePath: artifact.relativePath,
    absolutePath: artifact.absolutePath,
    sha256: artifact.sha256,
    byteSize: artifact.byteSize?.toString() ?? null,
    mimeType: artifact.mimeType,
    redactionLevel: artifact.redactionLevel,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt.toISOString(),
  };
}

function serializeGenerationRun(run: GenerationRunRecord) {
  return {
    id: run.id,
    jobId: run.jobId,
    sectionId: run.sectionId,
    kind: run.kind,
    parentRunId: run.parentRunId,
    status: run.status,
    provider: run.provider,
    hostModel: run.hostModel,
    imageModel: run.imageModel,
    hostInstruction: run.hostInstruction,
    visualPrompt: run.visualPrompt,
    negativePrompt: run.negativePrompt,
    toolParams: run.toolParams,
    inputImages: run.inputImages,
    requestArtifactId: run.requestArtifactId,
    responseSummary: run.responseSummary,
    errorSummary: run.errorSummary,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    counts: {
      canonicalVersions: run._count.canonicalVersions,
      candidateImages: run._count.candidateImages,
    },
  };
}

function serializeCanonicalVersion(version: CanonicalVersionRecord) {
  return {
    id: version.id,
    jobId: version.jobId,
    version: version.version,
    status: version.status,
    sourceRunId: version.sourceRunId,
    imageArtifactId: version.imageArtifactId,
    selectedAt: version.selectedAt?.toISOString() ?? null,
    notes: version.notes,
    createdAt: version.createdAt.toISOString(),
  };
}

function serializePromptCardVersion(version: PromptCardVersionRecord) {
  return {
    id: version.id,
    jobId: version.jobId,
    canonicalVersionId: version.canonicalVersionId,
    version: version.version,
    triggerToken: version.triggerToken,
    identityTraits: version.identityTraits,
    outfitTraits: version.outfitTraits,
    negativeTraits: version.negativeTraits,
    finalPromptDraft: version.finalPromptDraft,
    changeReason: version.changeReason,
    createdAt: version.createdAt.toISOString(),
  };
}

function serializeSectionTemplate(template: SectionTemplateRecord) {
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description,
    angleTag: template.angleTag,
    promptTemplate: template.promptTemplate,
    negativeTemplate: template.negativeTemplate,
    targetCandidateCount: template.targetCandidateCount,
    targetKeepCount: template.targetKeepCount,
    sortOrder: template.sortOrder,
    isActive: template.isActive,
  };
}

function serializeJobSection(section: JobSectionRecord) {
  return {
    id: section.id,
    jobId: section.jobId,
    templateId: section.templateId,
    key: section.key,
    name: section.name,
    canonicalVersionId: section.canonicalVersionId,
    promptCardVersionId: section.promptCardVersionId,
    targetCandidateCount: section.targetCandidateCount,
    targetKeepCount: section.targetKeepCount,
    status: section.status,
    keepCount: section.keepCount,
    rejectCount: section.rejectCount,
    pendingCount: section.pendingCount,
    sortOrder: section.sortOrder,
    counts: {
      keep: section.keepCount,
      reject: section.rejectCount,
      pending: section.pendingCount,
      generationRuns: section._count.generationRuns,
      candidateImages: section._count.candidateImages,
    },
    template: section.template
      ? {
          promptTemplate: section.template.promptTemplate,
          negativeTemplate: section.template.negativeTemplate,
          angleTag: section.template.angleTag,
          description: section.template.description,
        }
      : null,
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
  };
}

function serializeCandidateImage(image: CandidateImageRecord) {
  return {
    id: image.id,
    jobId: image.jobId,
    sectionId: image.sectionId,
    generationRunId: image.generationRunId,
    artifactId: image.artifactId,
    filePath: image.filePath,
    relativePath: image.filePath,
    sha256: image.sha256,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize?.toString() ?? null,
    reviewStatus: image.reviewStatus,
    rejectReasons: image.rejectReasons,
    reviewNote: image.reviewNote,
    captionDraft: image.captionDraft,
    reviewedAt: image.reviewedAt?.toISOString() ?? null,
    includedDatasetRevisionId: image.includedDatasetRevisionId,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

function serializeDatasetRevision(revision: DatasetRevisionRecord) {
  return {
    id: revision.id,
    jobId: revision.jobId,
    version: revision.version,
    status: revision.status,
    canonicalVersionId: revision.canonicalVersionId,
    promptCardVersionId: revision.promptCardVersionId,
    captionStrategy: revision.captionStrategy,
    itemCount: revision.itemCount,
    sourceCount: revision.sourceCount,
    syntheticCount: revision.syntheticCount,
    selectedManifestArtifactId: revision.selectedManifestArtifactId,
    metadataJsonlArtifactId: revision.metadataJsonlArtifactId,
    captionAuditArtifactId: revision.captionAuditArtifactId,
    trainDir: revision.trainDir,
    frozenAt: revision.frozenAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    counts: {
      items: revision._count.items,
      includedCandidateImages: revision._count.includedCandidateImages,
    },
  };
}

function serializeTrainingRun(run: TrainingRunRecord) {
  return {
    id: run.id,
    jobId: run.jobId,
    datasetRevisionId: run.datasetRevisionId,
    status: run.status,
    launcher: run.launcher,
    resolvedConfig: run.resolvedConfig,
    configArtifactId: run.configArtifactId,
    dryRunSummaryArtifactId: run.dryRunSummaryArtifactId,
    logArtifactId: run.logArtifactId,
    outputDir: run.outputDir,
    finalSafetensorsArtifactId: run.finalSafetensorsArtifactId,
    finalSha256: run.finalSha256,
    metadataSummary: run.metadataSummary,
    currentStep: run.currentStep,
    targetSteps: run.targetSteps,
    lossSnapshot: run.lossSnapshot,
    cancelRequestedAt: run.cancelRequestedAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    counts: {
      checkpoints: run._count.checkpoints,
      benchmarkRuns: run._count.benchmarkRuns,
    },
  };
}

function serializeBenchmarkRun(run: BenchmarkRunRecord) {
  return {
    id: run.id,
    jobId: run.jobId,
    trainingRunId: run.trainingRunId,
    status: run.status,
    loraAssetId: run.loraAssetId,
    testPresetId: run.testPresetId,
    testProjectId: run.testProjectId,
    templateId: run.templateId,
    checkpointMatrix: run.checkpointMatrix,
    weightMatrix: run.weightMatrix,
    reportArtifactId: run.reportArtifactId,
    recommendedWeight: run.recommendedWeight,
    resultSummary: run.resultSummary,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    counts: {
      promotionDecisions: run._count.promotionDecisions,
    },
  };
}

function serializePromotionDecision(decision: PromotionDecisionRecord) {
  return {
    id: decision.id,
    jobId: decision.jobId,
    benchmarkRunId: decision.benchmarkRunId,
    status: decision.status,
    selectedLoraAssetId: decision.selectedLoraAssetId,
    selectedCheckpoint: decision.selectedCheckpoint,
    defaultRecommendedWeight: decision.defaultRecommendedWeight,
    perVariantWeightOverrides: decision.perVariantWeightOverrides,
    variantPromptDrafts: decision.variantPromptDrafts,
    decisionReason: decision.decisionReason,
    promotedCategoryId: decision.promotedCategoryId,
    promotedPresetId: decision.promotedPresetId,
    reportArtifactId: decision.reportArtifactId,
    decidedAt: decision.decidedAt?.toISOString() ?? null,
    promotedAt: decision.promotedAt?.toISOString() ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  };
}

function serializeLoraAsset(asset: {
  id: string;
  name: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  size: bigint | number | null;
  category: string;
  triggerWords: string | null;
  notes: string | null;
  uploadedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: asset.id,
    name: asset.name,
    fileName: asset.fileName,
    absolutePath: asset.absolutePath,
    relativePath: asset.relativePath,
    size: asset.size === null ? null : Number(asset.size),
    category: asset.category,
    triggerWords: asset.triggerWords,
    notes: asset.notes,
    uploadedAt: asset.uploadedAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function serializeWorkerTask(task: WorkerTaskRecord) {
  return {
    id: task.id,
    jobId: task.jobId,
    workerType: task.workerType,
    targetType: task.targetType,
    targetId: task.targetId,
    status: task.status,
    payload: task.payload,
    leaseOwner: task.leaseOwner,
    leaseExpiresAt: task.leaseExpiresAt?.toISOString() ?? null,
    attemptCount: task.attemptCount,
    progressJson: task.progressJson,
    startedAt: task.startedAt?.toISOString() ?? null,
    heartbeatAt: task.heartbeatAt?.toISOString() ?? null,
    finishedAt: task.finishedAt?.toISOString() ?? null,
    errorSummary: task.errorSummary,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeGpuTaskLock(lock: GpuTaskLockRecord) {
  return {
    id: lock.id,
    taskType: lock.taskType,
    ownerType: lock.ownerType,
    ownerId: lock.ownerId,
    status: lock.status,
    startedAt: lock.startedAt.toISOString(),
    releasedAt: lock.releasedAt?.toISOString() ?? null,
    metadata: lock.metadata,
  };
}

function extractTargetSteps(config: Prisma.InputJsonValue) {
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

function extractTrainingProgressUpdate(progressJson: Prisma.InputJsonValue | undefined) {
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

function hasCancelRequested(value: Prisma.JsonValue | Prisma.InputJsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (value as Record<string, unknown>).cancelRequested === true;
}

function extractCompletionStep(output: CharacterLoraTrainingCompleteOutput) {
  const lastCheckpoint = [...output.checkpoints].sort((a, b) => b.step - a.step)[0];
  return lastCheckpoint?.step ?? null;
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
