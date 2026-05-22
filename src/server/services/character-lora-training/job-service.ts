import { Prisma } from "@/generated/prisma";
import { CharacterLoraJobStatus } from "@/generated/prisma/enums";
import {
  createCharacterLoraJobArtifact,
  createCharacterLoraTrainingJob as createJobInRepository,
  findCharacterLoraTrainingJobBySlug,
  getCharacterLoraTrainingJob as getJobFromRepository,
  listCharacterLoraTrainingJobs as listJobsFromRepository,
  updateCharacterLoraTrainingJob as updateJobInRepository,
  type CharacterLoraTrainingJobSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  ensureCharacterLoraJobRoot,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { z } from "zod";

const DEFAULT_CAPTION_STRATEGY = "controllable_identity";
const SLUG_SUFFIX_LENGTH = 6;

const trainingScopeSchema = z.record(z.string(), z.unknown()).refine(
  (value) => Object.keys(value).length > 0,
  "trainingScope must not be empty",
);

const createJobSchema = z
  .object({
    characterName: z.string().trim().min(1),
    triggerToken: z.string().trim().min(1),
    trainingScope: trainingScopeSchema,
    baseCheckpointName: nullableTrimmedStringSchema(),
    baseCheckpointPath: nullableTrimmedStringSchema(),
    baseCheckpointHash: nullableTrimmedStringSchema(),
    baseFamily: nullableTrimmedStringSchema(),
    captionStrategy: z.string().trim().min(1).default(DEFAULT_CAPTION_STRATEGY),
    phase: nullableTrimmedStringSchema(),
    createdBy: nullableTrimmedStringSchema(),
  })
  .strict();

const updateJobSchema = z
  .object({
    characterName: z.string().trim().min(1).optional(),
    triggerToken: z.string().trim().min(1).optional(),
    trainingScope: trainingScopeSchema.optional(),
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

export async function createCharacterLoraTrainingJob(input: unknown) {
  const parsed = parseWithSchema(createJobSchema, input);
  const slug = await generateUniqueJobSlug(parsed.characterName, parsed.triggerToken);
  const artifactRoot = await ensureCharacterLoraJobRoot(slug);

  const job = await createJobInRepository({
    slug,
    characterName: parsed.characterName,
    triggerToken: parsed.triggerToken,
    status: CharacterLoraJobStatus.draft,
    phase: parsed.phase,
    trainingScope: toInputJsonValue(parsed.trainingScope),
    captionStrategy: parsed.captionStrategy,
    baseCheckpointName: parsed.baseCheckpointName,
    baseCheckpointPath: parsed.baseCheckpointPath,
    baseCheckpointHash: parsed.baseCheckpointHash,
    baseFamily: parsed.baseFamily,
    artifactRoot,
    createdBy: parsed.createdBy,
  });

  await writeInitialJobArtifact(job, parsed);

  return job;
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

  return updateJobInRepository(id, {
    ...parsed,
    trainingScope: parsed.trainingScope ? toInputJsonValue(parsed.trainingScope) : undefined,
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
  input: z.infer<typeof createJobSchema>,
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

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
