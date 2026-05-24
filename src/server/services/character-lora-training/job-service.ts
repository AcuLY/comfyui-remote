import { basename, isAbsolute as pathIsAbsolute, relative as pathRelative } from "node:path";
import { Prisma } from "@/generated/prisma";
import { CharacterLoraJobStatus } from "@/generated/prisma/enums";
import {
  createCharacterLoraJobArtifact,
  createCharacterLoraTrainingJob as createJobInRepository,
  findActiveCharacterLoraTrainingJobByTriggerToken,
  findCharacterLoraTrainingJobBySlug,
  getCharacterLoraTrainingJob as getJobFromRepository,
  instantiateCharacterLoraJobSections as instantiateJobSectionsInRepository,
  listCharacterLoraCandidateImages as listCandidateImagesFromRepository,
  listCharacterLoraCanonicalVersions as listCanonicalVersionsFromRepository,
  listCharacterLoraDatasetRevisions as listDatasetRevisionsFromRepository,
  listCharacterLoraJobSections as listJobSectionsFromRepository,
  listCharacterLoraPromptCardVersions as listPromptCardVersionsFromRepository,
  listCharacterLoraSourceImages as listSourceImagesFromRepository,
  listCharacterLoraTrainingRuns as listTrainingRunsFromRepository,
  listCharacterLoraTrainingJobs as listJobsFromRepository,
  updateCharacterLoraTrainingJob as updateJobInRepository,
  type CharacterLoraTrainingJobSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  ensureCharacterLoraJobRoot,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { getCharacterLoraTrainingTemplateSnapshot } from "@/server/services/character-lora-training/section-template-service";
import {
  CHARACTER_LORA_DEFAULT_DERIVED_TRAINING_STATES,
  characterLoraTrainingScopeSchema,
} from "@/server/character-lora-training/contracts";
import { getModelBaseDir, hashModelFile, ModelAssetError } from "@/server/services/model-asset-service";
import { z } from "zod";

const DEFAULT_CAPTION_STRATEGY = "controllable_identity";
const SLUG_SUFFIX_LENGTH = 6;

const createJobSchema = z
  .object({
    characterName: z.string().trim().min(1),
    triggerToken: z.string().trim().min(1),
    trainingScope: characterLoraTrainingScopeSchema,
    baseCheckpointName: nullableTrimmedStringSchema(),
    baseCheckpointPath: requiredTrimmedStringSchema("baseCheckpointPath is required"),
    baseCheckpointHash: requiredTrimmedStringSchema("baseCheckpointHash is required"),
    baseFamily: nullableTrimmedStringSchema(),
    captionStrategy: nullableTrimmedStringSchema(),
    trainingTemplateId: nullableTrimmedStringSchema(),
    phase: nullableTrimmedStringSchema(),
    createdBy: nullableTrimmedStringSchema(),
  })
  .strict();

const createProjectSchema = z
  .object({
    characterName: nullableTrimmedStringSchema(),
    projectName: nullableTrimmedStringSchema(),
    triggerToken: z.string().trim().min(1),
    checkpointRelativePath: nullableTrimmedStringSchema(),
    checkpointPath: nullableTrimmedStringSchema(),
    trainingTemplateId: nullableTrimmedStringSchema(),
    actor: nullableTrimmedStringSchema(),
    source: nullableTrimmedStringSchema(),
    clientRequestId: nullableTrimmedStringSchema(),
    createdBy: nullableTrimmedStringSchema(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.characterName && !value.projectName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["characterName"],
        message: "characterName or projectName is required",
      });
    }

    if (!value.checkpointRelativePath && !value.checkpointPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkpointRelativePath"],
        message: "checkpointRelativePath or checkpointPath is required",
      });
    }
  });

const updateJobSchema = z
  .object({
    characterName: z.string().trim().min(1).optional(),
    triggerToken: z.string().trim().min(1).optional(),
    trainingScope: characterLoraTrainingScopeSchema.optional(),
    baseCheckpointName: nullableTrimmedStringSchema().optional(),
    baseCheckpointPath: nullableTrimmedStringSchema().optional(),
    baseCheckpointHash: nullableTrimmedStringSchema().optional(),
    baseFamily: nullableTrimmedStringSchema().optional(),
    captionStrategy: z.string().trim().min(1).optional(),
    phase: nullableTrimmedStringSchema().optional(),
    createdBy: nullableTrimmedStringSchema().optional(),
  })
  .strict();

const listJobsSchema = z
  .object({
    q: nullableTrimmedStringSchema().optional(),
    status: nullableTrimmedStringSchema().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export class CharacterLoraTrainingJobServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraTrainingJobServiceError";
  }
}

export async function listCharacterLoraTrainingJobs(input: unknown = {}) {
  const query = parseWithSchema(listJobsSchema, input);
  validateStatusFilter(query.status);

  return listJobsFromRepository({
    q: query.q ?? undefined,
    status: query.status ?? undefined,
    page: query.page,
    pageSize: query.pageSize,
  });
}

export async function getCharacterLoraTrainingJob(jobId: string) {
  const id = normalizeJobId(jobId);
  const job = await getJobFromRepository(id);

  if (!job) {
    throw new CharacterLoraTrainingJobServiceError("Character LoRA training job not found", 404);
  }

  return job;
}

export async function getCharacterLoraTrainingJobOverview(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);
  const [
    sourceImages,
    canonicalVersions,
    promptCardVersions,
    sections,
    candidateImages,
    datasetRevisions,
    trainingRuns,
  ] = await Promise.all([
    listSourceImagesFromRepository(job.id),
    listCanonicalVersionsFromRepository(job.id),
    listPromptCardVersionsFromRepository(job.id),
    listJobSectionsFromRepository(job.id),
    listCandidateImagesFromRepository({ jobId: job.id }),
    listDatasetRevisionsFromRepository(job.id),
    listTrainingRunsFromRepository(job.id),
  ]);

  const currentCanonical =
    canonicalVersions.find((version) => version.id === job.currentCanonicalVersionId) ??
    canonicalVersions.at(-1) ??
    null;
  const currentPromptCard =
    promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ??
    promptCardVersions.at(-1) ??
    null;
  const keptImageCount = candidateImages.filter((image) =>
    image.reviewStatus === "keep" || image.reviewStatus === "included_in_training"
  ).length;
  const latestDatasetRevision = datasetRevisions.at(-1) ?? null;
  const latestTrainingRun = trainingRuns[0] ?? null;
  const completedSections = sections.filter((section) => section.keepCount >= section.targetKeepCount).length;

  return {
    job: {
      id: job.id,
      slug: job.slug,
      characterName: job.characterName,
      triggerToken: job.triggerToken,
      status: job.status,
      phase: job.phase,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    currentStage: deriveOverviewStage({
      job,
      sourceImageCount: sourceImages.length,
      currentCanonicalVersionId: currentCanonical?.id ?? null,
      currentPromptCardVersionId: currentPromptCard?.id ?? null,
      sectionCount: sections.length,
      keptImageCount,
      datasetRevisionCount: datasetRevisions.length,
      latestTrainingStatus: latestTrainingRun?.status ?? null,
    }),
    missingItems: buildOverviewMissingItems({
      job,
      sourceImageCount: sourceImages.length,
      currentCanonicalVersionId: currentCanonical?.id ?? null,
      currentPromptCardVersionId: currentPromptCard?.id ?? null,
      sectionCount: sections.length,
      keptImageCount,
      datasetRevisionCount: datasetRevisions.length,
    }),
    sourceImages: {
      count: sourceImages.length,
    },
    personaReference: {
      currentCanonicalVersionId: currentCanonical?.id ?? null,
      imageArtifactId: currentCanonical?.imageArtifactId ?? null,
      status: currentCanonical?.status ?? null,
      versionCount: canonicalVersions.length,
    },
    promptCard: {
      currentPromptCardVersionId: currentPromptCard?.id ?? null,
      version: currentPromptCard?.version ?? null,
      versionCount: promptCardVersions.length,
      hasFinalPromptDraft: Boolean(currentPromptCard?.finalPromptDraft),
    },
    sections: {
      total: sections.length,
      completed: completedSections,
      active: sections.filter((section) => section.status !== "paused").length,
      paused: sections.filter((section) => section.status === "paused").length,
      targetKeepCount: sections.reduce((sum, section) => sum + section.targetKeepCount, 0),
      keptImageCount,
      items: sections.map((section) => ({
        id: section.id,
        key: section.key,
        name: section.name,
        status: section.status,
        keepCount: section.keepCount,
        rejectCount: section.rejectCount,
        pendingCount: section.pendingCount,
        targetKeepCount: section.targetKeepCount,
        generationRunCount: section.counts.generationRuns,
        candidateImageCount: section.counts.candidateImages,
      })),
    },
    dataset: {
      selectedDatasetRevisionId: job.selectedDatasetRevisionId,
      latestDatasetRevisionId: latestDatasetRevision?.id ?? null,
      versionCount: datasetRevisions.length,
      latestItemCount: latestDatasetRevision?.itemCount ?? null,
    },
    training: {
      latestTrainingRun: latestTrainingRun
        ? {
            id: latestTrainingRun.id,
            status: latestTrainingRun.status,
            currentStep: latestTrainingRun.currentStep,
            targetSteps: latestTrainingRun.targetSteps,
            finalSha256: latestTrainingRun.finalSha256,
            finalSafetensorsArtifactId: latestTrainingRun.finalSafetensorsArtifactId,
            createdAt: latestTrainingRun.createdAt,
            updatedAt: latestTrainingRun.updatedAt,
          }
        : null,
      runCount: trainingRuns.length,
    },
  };
}

export async function createCharacterLoraTrainingJob(input: unknown) {
  const parsed = parseWithSchema(createJobSchema, input);
  await assertTriggerTokenAvailable(parsed.triggerToken);

  const slug = await generateUniqueJobSlug(parsed.characterName, parsed.triggerToken);
  const artifactRoot = await ensureCharacterLoraJobRoot(slug);
  const baseCheckpointName = parsed.baseCheckpointName ?? deriveBaseCheckpointName(parsed.baseCheckpointPath);
  const trainingTemplateSnapshot = await getCharacterLoraTrainingTemplateSnapshot({
    id: parsed.trainingTemplateId,
  });
  const captionStrategy = parsed.captionStrategy ?? trainingTemplateSnapshot.captionStrategyDefault ?? DEFAULT_CAPTION_STRATEGY;

  const job = await createJobInRepository({
    slug,
    characterName: parsed.characterName,
    triggerToken: parsed.triggerToken,
    status: CharacterLoraJobStatus.draft,
    phase: parsed.phase,
    trainingScope: toInputJsonValue(parsed.trainingScope),
    captionStrategy,
    baseCheckpointName,
    baseCheckpointPath: parsed.baseCheckpointPath,
    baseCheckpointHash: parsed.baseCheckpointHash,
    baseFamily: parsed.baseFamily,
    artifactRoot,
    trainingTemplateId: trainingTemplateSnapshot.id,
    trainingTemplateSnapshot: toInputJsonValue(trainingTemplateSnapshot),
    createdBy: parsed.createdBy,
  });

  await instantiateJobSectionsInRepository({
    jobId: job.id,
    canonicalVersionId: null,
    promptCardVersionId: null,
    templates: trainingTemplateSnapshot.sectionTemplates,
  });

  await writeInitialJobArtifact(job, {
    ...parsed,
    captionStrategy,
    baseCheckpointName,
    trainingTemplateId: trainingTemplateSnapshot.id,
  });

  return job;
}

export async function createCharacterLoraTrainingProject(input: unknown) {
  const parsed = parseWithSchema(createProjectSchema, input);
  const characterName = parsed.characterName ?? parsed.projectName;
  const checkpointPath = parsed.checkpointRelativePath ?? parsed.checkpointPath;

  if (!characterName || !checkpointPath) {
    throw new CharacterLoraTrainingJobServiceError("characterName/projectName and checkpoint path are required", 400);
  }

  const [checkpoint, trainingTemplateSnapshot] = await Promise.all([
    hashModelFile("checkpoint", normalizeCheckpointRelativePath(checkpointPath)),
    getCharacterLoraTrainingTemplateSnapshot({
      id: parsed.trainingTemplateId,
    }),
  ]);

  return createCharacterLoraTrainingJob({
    characterName,
    triggerToken: parsed.triggerToken,
    trainingScope: {
      purpose: "character_identity",
      primaryOutfitOrForm: "external-agent-managed",
      scopeNote: "Created through the Character LoRA v2 lightweight project facade.",
      advancedExperiment: false,
      mixingPolicy: {
        allowMixedCharacters: false,
        allowMultipleOfficialOutfits: false,
        note: "Default v2 policy: external agent manages prompt card and dataset scope after creation.",
      },
      derivedStates: [...CHARACTER_LORA_DEFAULT_DERIVED_TRAINING_STATES],
    },
    captionStrategy: trainingTemplateSnapshot.captionStrategyDefault ?? DEFAULT_CAPTION_STRATEGY,
    phase: "setup",
    baseCheckpointName: checkpoint.name,
    baseCheckpointPath: checkpoint.absolutePath,
    baseCheckpointHash: checkpoint.sha256,
    // Checkpoint model assets do not currently expose baseFamily metadata without a schema change.
    // Keep the job snapshot nullable and let expert/report views surface the missing metadata.
    baseFamily: trainingTemplateSnapshot.baseFamily,
    trainingTemplateId: trainingTemplateSnapshot.id,
    createdBy: parsed.createdBy ?? buildFacadeCreatedBy(parsed),
  });
}

export async function updateCharacterLoraTrainingJob(jobId: string, input: unknown) {
  const id = normalizeJobId(jobId);
  const current = await getCharacterLoraTrainingJob(id);

  if (current.status !== CharacterLoraJobStatus.draft) {
    throw new CharacterLoraTrainingJobServiceError(
      "Only draft character LoRA training jobs can be updated",
      409,
      { status: current.status },
    );
  }

  const parsed = parseWithSchema(updateJobSchema, input);

  if (Object.keys(parsed).length === 0) {
    throw new CharacterLoraTrainingJobServiceError("No supported fields provided", 400, {
      supportedFields: Object.keys(updateJobSchema.shape),
    });
  }

  const normalized = normalizeUpdateJobInput(parsed, current);

  if (normalized.triggerToken) {
    await assertTriggerTokenAvailable(normalized.triggerToken, { excludeJobId: id });
  }

  return updateJobInRepository(id, {
    ...normalized,
    trainingScope: normalized.trainingScope ? toInputJsonValue(normalized.trainingScope) : undefined,
  });
}

export function mapCharacterLoraTrainingJobError(error: unknown) {
  if (error instanceof CharacterLoraTrainingJobServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof ModelAssetError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "Character LoRA training job already exists",
        status: 409,
        details: "Database uniqueness check failed",
      };
    }

    if (error.code === "P2025") {
      return {
        message: "Character LoRA training job not found",
        status: 404,
        details: "Database record was not found",
      };
    }

    return {
      message: "Character LoRA training database request failed",
      status: 500,
      details: "Database operation failed",
    };
  }

  return {
    message: "Unexpected character LoRA training job error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function writeInitialJobArtifact(
  job: CharacterLoraTrainingJobSummary,
  input: z.infer<typeof createJobSchema> & {
    captionStrategy: string;
    baseCheckpointName: string;
    trainingTemplateId: string;
  },
) {
  const artifact = await writeCharacterLoraJsonArtifact(job.artifactRoot, "job.json", {
    id: job.id,
    slug: job.slug,
    characterName: input.characterName,
    triggerToken: input.triggerToken,
    status: job.status,
    phase: input.phase,
    trainingScope: input.trainingScope,
    captionStrategy: input.captionStrategy,
    baseCheckpointName: input.baseCheckpointName,
    baseCheckpointPath: input.baseCheckpointPath,
    baseCheckpointHash: input.baseCheckpointHash,
    baseFamily: input.baseFamily,
    trainingTemplateId: input.trainingTemplateId,
    createdBy: input.createdBy,
    createdAt: job.createdAt,
  });

  await createCharacterLoraJobArtifact({
    jobId: job.id,
    kind: "provider_payload",
    relativePath: artifact.relativePath,
    absolutePath: artifact.absolutePath,
    sha256: artifact.sha256,
    byteSize: BigInt(artifact.byteSize),
    mimeType: "application/json",
    metadata: {
      purpose: "initial_job_snapshot",
      mtime: artifact.mtime.toISOString(),
    },
  });
}

async function generateUniqueJobSlug(characterName: string, triggerToken: string) {
  const base = slugify(`${characterName}-${triggerToken}`) || "character-lora-job";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = `${base}-${Date.now().toString(36)}${attempt ? `-${attempt}` : ""}-${randomSlugSuffix()}`;
    const existing = await findCharacterLoraTrainingJobBySlug(slug);

    if (!existing) {
      return slug;
    }
  }

  throw new CharacterLoraTrainingJobServiceError("Unable to generate a unique character LoRA job slug", 409);
}

function normalizeJobId(jobId: string) {
  const normalized = jobId.trim();

  if (!normalized) {
    throw new CharacterLoraTrainingJobServiceError("jobId is required", 400);
  }

  return normalized;
}

function validateStatusFilter(status: string | null | undefined) {
  if (!status) {
    return;
  }

  if (!Object.values(CharacterLoraJobStatus).includes(status as never)) {
    throw new CharacterLoraTrainingJobServiceError("status must be a valid character LoRA job status", 400, {
      supportedStatuses: Object.values(CharacterLoraJobStatus),
    });
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraTrainingJobServiceError("Invalid character LoRA training job request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function nullableTrimmedStringSchema() {
  return z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional();
}

function requiredTrimmedStringSchema(message: string) {
  return z.string().trim().min(1, message);
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertTriggerTokenAvailable(triggerToken: string, options: { excludeJobId?: string } = {}) {
  const existing = await findActiveCharacterLoraTrainingJobByTriggerToken({
    triggerToken,
    excludeJobId: options.excludeJobId,
  });

  if (!existing) {
    return;
  }

  throw new CharacterLoraTrainingJobServiceError(
    `triggerToken "${triggerToken}" is already used by active character LoRA job "${existing.characterName}"`,
    409,
    {
      triggerToken,
      existingJobId: existing.id,
      existingSlug: existing.slug,
      existingStatus: existing.status,
    },
  );
}

function normalizeUpdateJobInput(
  parsed: z.infer<typeof updateJobSchema>,
  current: CharacterLoraTrainingJobSummary,
) {
  const normalized = { ...parsed };

  if (!hasAnyOwn(parsed, ["baseCheckpointName", "baseCheckpointPath", "baseCheckpointHash", "baseFamily"])) {
    return normalized;
  }

  const baseCheckpoint = {
    baseCheckpointPath: hasOwn(parsed, "baseCheckpointPath")
      ? parsed.baseCheckpointPath
      : current.baseCheckpointPath,
    baseCheckpointHash: hasOwn(parsed, "baseCheckpointHash")
      ? parsed.baseCheckpointHash
      : current.baseCheckpointHash,
    baseFamily: hasOwn(parsed, "baseFamily") ? parsed.baseFamily : current.baseFamily,
  };

  assertCompleteBaseCheckpoint(baseCheckpoint);

  if (parsed.baseCheckpointName === null || (parsed.baseCheckpointName === undefined && !current.baseCheckpointName)) {
    normalized.baseCheckpointName = deriveBaseCheckpointName(baseCheckpoint.baseCheckpointPath);
  }

  return normalized;
}

function assertCompleteBaseCheckpoint(input: {
  baseCheckpointPath: string | null | undefined;
  baseCheckpointHash: string | null | undefined;
  baseFamily: string | null | undefined;
}): asserts input is { baseCheckpointPath: string; baseCheckpointHash: string; baseFamily: string } {
  const missingFields = [
    input.baseCheckpointPath ? null : "baseCheckpointPath",
    input.baseCheckpointHash ? null : "baseCheckpointHash",
    input.baseFamily ? null : "baseFamily",
  ].filter((field): field is string => Boolean(field));

  if (missingFields.length === 0) {
    return;
  }

  throw new CharacterLoraTrainingJobServiceError(
    "baseCheckpointPath, baseCheckpointHash and baseFamily are required for character LoRA jobs",
    400,
    { missingFields },
  );
}

function hasAnyOwn(value: object, keys: string[]) {
  return keys.some((key) => hasOwn(value, key));
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function deriveBaseCheckpointName(baseCheckpointPath: string) {
  const checkpointName = basename(baseCheckpointPath.replace(/\\/g, "/"));
  return checkpointName || baseCheckpointPath;
}

function normalizeCheckpointRelativePath(rawPath: string) {
  const normalized = rawPath.trim().replace(/\\/g, "/");
  if (!normalized) {
    return normalized;
  }

  if (!pathIsAbsolute(normalized)) {
    return normalized;
  }

  const baseDir = getModelBaseDir("checkpoint");
  if (!baseDir) {
    return normalized;
  }

  const relativePath = pathRelative(baseDir, normalized).replace(/\\/g, "/");
  if (!relativePath || relativePath.startsWith("..") || pathIsAbsolute(relativePath)) {
    return normalized;
  }

  return relativePath;
}

function buildFacadeCreatedBy(input: z.infer<typeof createProjectSchema>) {
  const actor = input.actor ?? null;
  const source = input.source ?? null;
  const clientRequestId = input.clientRequestId ?? null;

  if (!actor && !source && !clientRequestId) {
    return null;
  }

  return [
    actor ? `actor:${actor}` : null,
    source ? `source:${source}` : null,
    clientRequestId ? `clientRequestId:${clientRequestId}` : null,
  ].filter(Boolean).join(" ");
}

function deriveOverviewStage(input: {
  job: CharacterLoraTrainingJobSummary;
  sourceImageCount: number;
  currentCanonicalVersionId: string | null;
  currentPromptCardVersionId: string | null;
  sectionCount: number;
  keptImageCount: number;
  datasetRevisionCount: number;
  latestTrainingStatus: string | null;
}) {
  if (input.job.status === "trained" || input.latestTrainingStatus === "done") {
    return { key: "trained", status: input.job.status };
  }
  if (input.latestTrainingStatus === "queued" || input.latestTrainingStatus === "running") {
    return { key: "training", status: input.job.status };
  }
  if (input.datasetRevisionCount > 0 || input.job.selectedDatasetRevisionId) {
    return { key: "dataset", status: input.job.status };
  }
  if (input.keptImageCount > 0) {
    return { key: "review", status: input.job.status };
  }
  if (input.sectionCount > 0 && input.currentPromptCardVersionId) {
    return { key: "sections", status: input.job.status };
  }
  if (input.currentPromptCardVersionId) {
    return { key: "prompt_card", status: input.job.status };
  }
  if (input.currentCanonicalVersionId) {
    return { key: "persona_reference", status: input.job.status };
  }
  if (input.sourceImageCount > 0) {
    return { key: "source_images", status: input.job.status };
  }

  return { key: "created", status: input.job.status };
}

function buildOverviewMissingItems(input: {
  job: CharacterLoraTrainingJobSummary;
  sourceImageCount: number;
  currentCanonicalVersionId: string | null;
  currentPromptCardVersionId: string | null;
  sectionCount: number;
  keptImageCount: number;
  datasetRevisionCount: number;
}) {
  const items: Array<{ code: string; label: string; blocking: boolean }> = [];

  if (!input.job.baseCheckpointPath || !input.job.baseCheckpointHash) {
    items.push({ code: "checkpoint_snapshot", label: "checkpoint path/hash", blocking: true });
  }
  if (!input.job.baseFamily) {
    items.push({ code: "checkpoint_base_family", label: "checkpoint base family", blocking: false });
  }
  if (input.sourceImageCount === 0) {
    items.push({ code: "source_images", label: "source images", blocking: true });
  }
  if (!input.currentCanonicalVersionId) {
    items.push({ code: "persona_reference", label: "selected persona reference", blocking: true });
  }
  if (!input.currentPromptCardVersionId) {
    items.push({ code: "prompt_card", label: "current prompt card", blocking: true });
  }
  if (input.sectionCount === 0) {
    items.push({ code: "sections", label: "training sections", blocking: true });
  }
  if (input.keptImageCount === 0) {
    items.push({ code: "kept_images", label: "kept training images", blocking: true });
  }
  if (input.datasetRevisionCount === 0) {
    items.push({ code: "dataset_revision", label: "dataset revision", blocking: true });
  }

  return items;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function randomSlugSuffix() {
  return Math.random().toString(36).slice(2, 2 + SLUG_SUFFIX_LENGTH);
}
