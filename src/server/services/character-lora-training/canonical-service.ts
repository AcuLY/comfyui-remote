import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { CharacterLoraRunStatus } from "@/generated/prisma/enums";
import {
  characterLoraImageGenerationRequestSchema,
  characterLoraImageGenerationTaskPayloadSchema,
  characterLoraImageProviderSchema,
  characterLoraProviderInputImageSchema,
  characterLoraProviderToolParamsSchema,
  type CharacterLoraImageProvider,
  type CharacterLoraProviderInputImage,
  type CharacterLoraProviderToolParams,
} from "@/server/character-lora-training/contracts";
import {
  createCharacterLoraCanonicalGenerationRunWithTask,
  createManualCanonicalVersionFromSourceImage,
  createMockCompletedCanonicalVersion,
  getCharacterLoraArtifact,
  getCharacterLoraCanonicalVersion,
  getCharacterLoraGenerationRun,
  getCharacterLoraSourceImage,
  getCharacterLoraTrainingJob,
  listCharacterLoraSourceImages,
  selectCharacterLoraCanonicalVersion as selectCanonicalVersionInRepository,
  type CharacterLoraSourceImageSummary,
  type CharacterLoraTrainingJobSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  redactCharacterLoraProviderPayload,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { z } from "zod";

const DEFAULT_PROVIDER = "mock-local" satisfies CharacterLoraImageProvider;
const DEFAULT_IMAGE_MODEL = "gpt-image-2" as const;
const DEFAULT_TOOL_PARAMS = {
  size: "1024x1536",
  quality: "high",
  outputFormat: "png",
  background: "opaque",
} satisfies CharacterLoraProviderToolParams;

const DEFAULT_HOST_MODELS = {
  "mock-local": "mock-local",
  "openai-codex": "codex-image-worker",
} satisfies Record<CharacterLoraImageProvider, string>;

const enqueueCanonicalGenerationSchema = z
  .object({
    provider: characterLoraImageProviderSchema.optional(),
    hostModel: trimmedStringSchema().optional(),
    imageModel: z.literal(DEFAULT_IMAGE_MODEL).optional(),
    hostInstruction: trimmedStringSchema().optional(),
    visualPrompt: trimmedStringSchema().optional(),
    renderedPrompt: trimmedStringSchema().optional(),
    negativePrompt: nullableTrimmedStringSchema(),
    toolParams: characterLoraProviderToolParamsSchema.optional(),
    inputImages: z.array(characterLoraProviderInputImageSchema).optional(),
    sourceImageIds: z.array(trimmedStringSchema()).optional(),
  })
  .strict();

const mockCompleteCanonicalSchema = z
  .object({
    sourceImageId: nullableTrimmedStringSchema(),
  })
  .strict();

const registerManualCanonicalSchema = z
  .object({
    sourceImageId: trimmedStringSchema(),
    notes: nullableTrimmedStringSchema(),
  })
  .strict();

export class CharacterLoraCanonicalServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraCanonicalServiceError";
  }
}

export async function enqueueCharacterLoraCanonicalGenerationRun(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  const job = await getExistingJob(id);
  const sourceImages = await listRequiredSourceImages(id);
  const parsed = parseWithSchema(enqueueCanonicalGenerationSchema, input);

  if (parsed.inputImages && parsed.sourceImageIds) {
    throw new CharacterLoraCanonicalServiceError(
      "Provide either inputImages or sourceImageIds, not both",
      400,
    );
  }

  const provider = parsed.provider ?? DEFAULT_PROVIDER;
  const inputImages = resolveProviderInputImages(sourceImages, parsed);
  const runId = randomUUID();
  const outputDir = `generation-runs/${runId}`;
  const hostInstruction =
    parsed.hostInstruction ?? buildDefaultCanonicalHostInstruction(provider);
  const visualPrompt = parsed.visualPrompt ?? buildDefaultCanonicalVisualPrompt(job);

  const request = parseWithSchema(characterLoraImageGenerationRequestSchema, {
    jobId: id,
    generationRunId: runId,
    provider,
    hostModel: parsed.hostModel ?? DEFAULT_HOST_MODELS[provider],
    imageModel: parsed.imageModel ?? DEFAULT_IMAGE_MODEL,
    hostInstruction,
    visualPrompt,
    renderedPrompt: parsed.renderedPrompt,
    negativePrompt: parsed.negativePrompt ?? undefined,
    toolParams: parsed.toolParams ?? DEFAULT_TOOL_PARAMS,
    inputImages,
    outputDir,
  });

  const taskPayload = parseWithSchema(characterLoraImageGenerationTaskPayloadSchema, {
    taskType: "image_generation",
    jobId: id,
    generationRunId: runId,
    request,
  });

  const enqueuedAt = new Date();
  const requestArtifact = await writeCharacterLoraJsonArtifact(
    job.artifactRoot,
    `${outputDir}/request.redacted.json`,
    redactCharacterLoraProviderPayload({
      purpose: "canonical_generation_request",
      enqueuedAt: enqueuedAt.toISOString(),
      request,
    }),
  );

  return createCharacterLoraCanonicalGenerationRunWithTask({
    runId,
    jobId: id,
    provider: request.provider,
    hostModel: request.hostModel,
    imageModel: request.imageModel,
    hostInstruction: request.hostInstruction,
    visualPrompt: request.visualPrompt,
    negativePrompt: request.negativePrompt,
    toolParams: toInputJsonValue(request.toolParams),
    inputImages: toInputJsonValue(request.inputImages),
    requestArtifact: {
      relativePath: requestArtifact.relativePath,
      absolutePath: requestArtifact.absolutePath,
      sha256: requestArtifact.sha256,
      byteSize: BigInt(requestArtifact.byteSize),
      metadata: toInputJsonValue({
        purpose: "canonical_generation_request",
        redacted: true,
        generationRunId: runId,
        provider: request.provider,
        sourceImageCount: request.inputImages.length,
        mtime: requestArtifact.mtime.toISOString(),
      }),
    },
    taskPayload,
  });
}

export async function mockCompleteCharacterLoraCanonicalGenerationRun(runId: string, input: unknown = {}) {
  const id = normalizeId(runId, "runId");
  const parsed = parseWithSchema(mockCompleteCanonicalSchema, input);
  const run = await getExistingGenerationRun(id);

  if (run.kind !== "canonical" || run.sectionId !== null) {
    throw new CharacterLoraCanonicalServiceError(
      "Generation run is not a canonical generation run",
      409,
      { kind: run.kind, sectionId: run.sectionId },
    );
  }

  if (
    run.status !== CharacterLoraRunStatus.queued &&
    run.status !== CharacterLoraRunStatus.running
  ) {
    throw new CharacterLoraCanonicalServiceError(
      "Only queued or running canonical generation runs can be mock-completed",
      409,
      { status: run.status },
    );
  }

  const job = await getExistingJob(run.jobId);
  const sourceImages = await listRequiredSourceImages(run.jobId);
  const sourceImage = resolveMockSourceImage(sourceImages, parsed.sourceImageId);
  const sourceArtifact = await getCharacterLoraArtifact(sourceImage.artifactId);

  if (!sourceArtifact) {
    throw new CharacterLoraCanonicalServiceError("Source image artifact not found", 404, {
      sourceImageId: sourceImage.id,
      artifactId: sourceImage.artifactId,
    });
  }

  if (sourceArtifact.jobId !== run.jobId) {
    throw new CharacterLoraCanonicalServiceError(
      "Source image artifact does not belong to this job",
      409,
      { sourceArtifactJobId: sourceArtifact.jobId, runJobId: run.jobId },
    );
  }

  const completedAt = new Date();
  const responseSummary = {
    provider: "mock-local",
    mode: "mock-complete-canonical",
    generationRunId: run.id,
    sourceImageId: sourceImage.id,
    reusedSourceArtifact: true,
    canonicalArtifact: {
      artifactId: sourceArtifact.id,
      relativePath: sourceArtifact.relativePath,
      sha256: sourceArtifact.sha256,
    },
    notes: "Mock canonical image reuses the selected source image artifact; no binary was generated.",
    completedAt: completedAt.toISOString(),
  };

  const canonicalVersion = await createMockCompletedCanonicalVersion({
    generationRunId: run.id,
    jobId: job.id,
    imageArtifactId: sourceArtifact.id,
    notes: `mock canonical from source image ${sourceImage.id}; reused artifact ${sourceArtifact.id}`,
    responseSummary: toInputJsonValue(responseSummary),
  });

  return {
    canonicalVersion,
    generationRun: await getCharacterLoraGenerationRun(run.id),
  };
}

export async function registerManualCharacterLoraCanonicalVersion(jobId: string, input: unknown) {
  const normalizedJobId = normalizeId(jobId, "jobId");
  const parsed = parseWithSchema(registerManualCanonicalSchema, input);

  await getExistingJob(normalizedJobId);

  const sourceImage = await getCharacterLoraSourceImage(parsed.sourceImageId);

  if (!sourceImage || sourceImage.jobId !== normalizedJobId) {
    throw new CharacterLoraCanonicalServiceError("Source image not found for this job", 404, {
      jobId: normalizedJobId,
      sourceImageId: parsed.sourceImageId,
    });
  }

  if (sourceImage.role !== "manual_canonical") {
    throw new CharacterLoraCanonicalServiceError(
      "Manual canonical registration requires a manual_canonical source image",
      409,
      { sourceImageId: sourceImage.id, role: sourceImage.role },
    );
  }

  const sourceArtifact = await getCharacterLoraArtifact(sourceImage.artifactId);

  if (!sourceArtifact) {
    throw new CharacterLoraCanonicalServiceError("Source image artifact not found", 404, {
      sourceImageId: sourceImage.id,
      artifactId: sourceImage.artifactId,
    });
  }

  if (sourceArtifact.jobId !== normalizedJobId) {
    throw new CharacterLoraCanonicalServiceError(
      "Source image artifact does not belong to this job",
      409,
      { sourceArtifactJobId: sourceArtifact.jobId, jobId: normalizedJobId },
    );
  }

  if (sourceArtifact.kind !== "source_image") {
    throw new CharacterLoraCanonicalServiceError(
      "Manual canonical source artifact must be a source_image artifact",
      409,
      { artifactId: sourceArtifact.id, kind: sourceArtifact.kind },
    );
  }

  const notes = [
    `provenance=manual_upload; sourceImageId=${sourceImage.id}; sourceRole=${sourceImage.role}; artifactId=${sourceArtifact.id}; artifactPath=${sourceArtifact.relativePath}`,
    parsed.notes ? `operatorNotes=${parsed.notes}` : null,
  ].filter((note): note is string => Boolean(note));

  return createManualCanonicalVersionFromSourceImage({
    jobId: normalizedJobId,
    imageArtifactId: sourceArtifact.id,
    notes: notes.join("; "),
  });
}

export async function selectCharacterLoraCanonicalVersion(jobId: string, versionId: string) {
  const normalizedJobId = normalizeId(jobId, "jobId");
  const normalizedVersionId = normalizeId(versionId, "versionId");

  await getExistingJob(normalizedJobId);

  const version = await getCharacterLoraCanonicalVersion(normalizedVersionId);

  if (!version || version.jobId !== normalizedJobId) {
    throw new CharacterLoraCanonicalServiceError("Canonical version not found for this job", 404, {
      jobId: normalizedJobId,
      versionId: normalizedVersionId,
    });
  }

  return selectCanonicalVersionInRepository({
    jobId: normalizedJobId,
    canonicalVersionId: normalizedVersionId,
  });
}

export function mapCharacterLoraCanonicalError(error: unknown) {
  if (error instanceof CharacterLoraCanonicalServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "Character LoRA canonical record already exists",
        status: 409,
        details: "Database uniqueness check failed",
      };
    }

    if (error.code === "P2025") {
      return {
        message: "Character LoRA canonical record not found",
        status: 404,
        details: "Database record was not found",
      };
    }

    if (error.code === "P2003") {
      return {
        message: "Character LoRA canonical record references missing data",
        status: 409,
        details: "Database relation check failed",
      };
    }

    return {
      message: "Character LoRA canonical database request failed",
      status: 500,
      details: "Database operation failed",
    };
  }

  return {
    message: "Unexpected character LoRA canonical error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function getExistingJob(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);

  if (!job) {
    throw new CharacterLoraCanonicalServiceError("Character LoRA training job not found", 404);
  }

  return job;
}

async function getExistingGenerationRun(runId: string) {
  const run = await getCharacterLoraGenerationRun(runId);

  if (!run) {
    throw new CharacterLoraCanonicalServiceError("Character LoRA generation run not found", 404);
  }

  return run;
}

async function listRequiredSourceImages(jobId: string) {
  const sourceImages = await listCharacterLoraSourceImages(jobId);

  if (sourceImages.length === 0) {
    throw new CharacterLoraCanonicalServiceError(
      "Canonical generation requires at least one source image",
      409,
      { jobId },
    );
  }

  return sourceImages;
}

function resolveProviderInputImages(
  sourceImages: CharacterLoraSourceImageSummary[],
  parsed: z.infer<typeof enqueueCanonicalGenerationSchema>,
) {
  if (parsed.inputImages) {
    return validateExplicitProviderInputImages(sourceImages, parsed.inputImages);
  }

  if (parsed.sourceImageIds) {
    return resolveProviderInputImagesBySourceIds(sourceImages, parsed.sourceImageIds);
  }

  return sourceImages.map(sourceImageToProviderInput);
}

function validateExplicitProviderInputImages(
  sourceImages: CharacterLoraSourceImageSummary[],
  inputImages: CharacterLoraProviderInputImage[],
) {
  if (inputImages.length === 0) {
    throw new CharacterLoraCanonicalServiceError("inputImages must include at least one image", 400);
  }

  const sourceByArtifactId = new Map(sourceImages.map((sourceImage) => [sourceImage.artifactId, sourceImage]));
  const missingArtifactIds: string[] = [];
  const mismatchedArtifactIds: string[] = [];

  for (const inputImage of inputImages) {
    const sourceImage = sourceByArtifactId.get(inputImage.artifactId);

    if (!sourceImage) {
      missingArtifactIds.push(inputImage.artifactId);
      continue;
    }

    if (
      inputImage.relativePath !== sourceImage.relativePath ||
      inputImage.sha256.toLowerCase() !== sourceImage.sha256.toLowerCase()
    ) {
      mismatchedArtifactIds.push(inputImage.artifactId);
    }
  }

  if (missingArtifactIds.length > 0) {
    throw new CharacterLoraCanonicalServiceError(
      "One or more inputImages do not belong to this job's source images",
      404,
      { artifactIds: missingArtifactIds },
    );
  }

  if (mismatchedArtifactIds.length > 0) {
    throw new CharacterLoraCanonicalServiceError(
      "One or more inputImages do not match the stored source image artifact",
      409,
      { artifactIds: mismatchedArtifactIds },
    );
  }

  return inputImages;
}

function resolveProviderInputImagesBySourceIds(
  sourceImages: CharacterLoraSourceImageSummary[],
  sourceImageIds: string[],
) {
  if (sourceImageIds.length === 0) {
    throw new CharacterLoraCanonicalServiceError("sourceImageIds must include at least one image", 400);
  }

  const uniqueIds = new Set(sourceImageIds);

  if (uniqueIds.size !== sourceImageIds.length) {
    throw new CharacterLoraCanonicalServiceError("sourceImageIds must not contain duplicates", 400);
  }

  const sourceById = new Map(sourceImages.map((sourceImage) => [sourceImage.id, sourceImage]));
  const missingIds = sourceImageIds.filter((sourceImageId) => !sourceById.has(sourceImageId));

  if (missingIds.length > 0) {
    throw new CharacterLoraCanonicalServiceError(
      "One or more source images were not found for this job",
      404,
      { sourceImageIds: missingIds },
    );
  }

  return sourceImageIds.map((sourceImageId) => sourceImageToProviderInput(sourceById.get(sourceImageId)!));
}

function resolveMockSourceImage(
  sourceImages: CharacterLoraSourceImageSummary[],
  sourceImageId: string | null | undefined,
) {
  if (!sourceImageId) {
    return sourceImages[0];
  }

  const sourceImage = sourceImages.find((candidate) => candidate.id === sourceImageId);

  if (!sourceImage) {
    throw new CharacterLoraCanonicalServiceError("Source image not found for generation run job", 404, {
      sourceImageId,
    });
  }

  return sourceImage;
}

function sourceImageToProviderInput(sourceImage: CharacterLoraSourceImageSummary): CharacterLoraProviderInputImage {
  return {
    artifactId: sourceImage.artifactId,
    role: sourceRoleToProviderRole(sourceImage.role),
    relativePath: sourceImage.relativePath,
    sha256: sourceImage.sha256,
  };
}

function sourceRoleToProviderRole(sourceRole: string): CharacterLoraProviderInputImage["role"] {
  if (sourceRole === "setting") {
    return "setting";
  }

  if (sourceRole === "local_reference" || sourceRole === "rerun_reference") {
    return "local_reference";
  }

  if (sourceRole === "manual_canonical") {
    return "canonical";
  }

  return "source";
}

function buildDefaultCanonicalHostInstruction(provider: CharacterLoraImageProvider) {
  if (provider === "mock-local") {
    return "Create a canonical Character LoRA generation run for local link validation. Do not call external providers and do not include secrets in stored payloads.";
  }

  return "Create a canonical Character LoRA reference image from the supplied artifact references. Use only the input images as visual reference and do not include credentials, auth tokens, or private paths in provider payloads.";
}

function buildDefaultCanonicalVisualPrompt(job: CharacterLoraTrainingJobSummary) {
  return [
    `Create a clean canonical reference image for ${job.characterName}.`,
    `Preserve identity, face, hair, outfit, and overall silhouette from the source images for LoRA training.`,
    `Use trigger token "${job.triggerToken}" as metadata only; do not render text in the image.`,
    "Prefer a neutral background, clear lighting, and a full-body or three-quarter composition with readable details.",
  ].join(" ");
}

function normalizeId(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new CharacterLoraCanonicalServiceError(`${fieldName} is required`, 400);
  }

  return normalized;
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraCanonicalServiceError("Invalid character LoRA canonical request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function trimmedStringSchema() {
  return z.string().trim().min(1);
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
