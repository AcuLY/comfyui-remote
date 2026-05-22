import { Prisma } from "@/generated/prisma";
import {
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
  CharacterLoraImageGenerationOutput,
  CharacterLoraImageGenerationTaskPayload,
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
      select: { id: true, jobId: true, sectionId: true, includedDatasetRevisionId: true },
    });
    const existingById = new Map(existing.map((image) => [image.id, image]));
    const missingIds = input.images
      .map((image) => image.imageId)
      .filter((imageId) => !existingById.has(imageId));

    if (missingIds.length > 0) {
      throw new Error(`Candidate images not found: ${missingIds.join(", ")}`);
    }

    const frozenIds = existing
      .filter((image) => image.includedDatasetRevisionId)
      .map((image) => image.id);

    if (frozenIds.length > 0) {
      throw new Error(`Included training images cannot be reviewed again: ${frozenIds.join(", ")}`);
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

    await tx.characterLoraWorkerTask.update({
      where: { id: input.taskId },
      data: {
        status: CharacterLoraRunStatus.failed,
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
          status: CharacterLoraRunStatus.failed,
          finishedAt: new Date(),
          lossSnapshot: input.progressJson ?? task.progressJson ?? Prisma.DbNull,
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

export async function createFrozenCharacterLoraDatasetRevision(input: {
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
}) {
  const result = await db.$transaction(async (tx) => {
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
  });

  return serializeDatasetRevision(result);
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

function extractCompletionStep(output: CharacterLoraTrainingCompleteOutput) {
  const lastCheckpoint = [...output.checkpoints].sort((a, b) => b.step - a.step)[0];
  return lastCheckpoint?.step ?? null;
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
