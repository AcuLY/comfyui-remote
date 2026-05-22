import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { detectProvider } from "@/lib/prisma";

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

type JobSummaryRecord = Prisma.CharacterLoraTrainingJobGetPayload<{
  select: typeof JOB_SUMMARY_SELECT;
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

export async function createCharacterLoraJobArtifact(input: {
  jobId: string;
  kind: "provider_payload" | "prompt" | "training_config" | "dataset_manifest" | "benchmark_report" | "promotion_report";
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
