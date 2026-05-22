import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { detectProvider } from "@/lib/prisma";
import type {
  CharacterLoraArtifactKind,
  CharacterLoraImageGenerationTaskPayload,
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

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
