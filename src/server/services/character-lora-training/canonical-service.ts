import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import { CharacterLoraRunStatus } from "@/generated/prisma/enums";
import {
  characterLoraImageGenerationRequestSchema,
  characterLoraImageGenerationTaskPayloadSchema,
  characterLoraImageProviderSchema,
  characterLoraCanonicalViewSchema,
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
  rejectCharacterLoraCanonicalVersion as rejectCanonicalVersionInRepository,
  selectCharacterLoraCanonicalVersion as selectCanonicalVersionInRepository,
  type CharacterLoraSourceImageSummary,
  type CharacterLoraTrainingJobSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  redactCharacterLoraProviderPayload,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { buildCanonicalViewGenerationPayloads } from "@/lib/character-lora-canonical-views";
import { z } from "zod";

const DEFAULT_PROVIDER = "openai-codex" satisfies CharacterLoraImageProvider;
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
    canonicalView: characterLoraCanonicalViewSchema.optional(),
    visualPrompt: trimmedStringSchema().optional(),
    characterDescription: trimmedStringSchema().optional(),
    finalPromptDraft: trimmedStringSchema().optional(),
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
    canonicalView: characterLoraCanonicalViewSchema.optional(),
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
  const canonicalView = parsed.canonicalView ?? null;
  const inputImages = await resolveProviderInputImages(id, sourceImages, parsed);
  const runId = randomUUID();
  const outputDir = `generation-runs/${runId}`;
  const hostInstruction =
    parsed.hostInstruction ?? buildDefaultCanonicalHostInstruction(provider);
  const visualPrompt = parsed.visualPrompt ?? buildDefaultCanonicalVisualPrompt(job);

  const request = parseWithSchema(characterLoraImageGenerationRequestSchema, {
    jobId: id,
    generationRunId: runId,
    canonicalView: canonicalView ?? undefined,
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
      canonicalView,
      request,
    }),
  );

  return createCharacterLoraCanonicalGenerationRunWithTask({
    runId,
    jobId: id,
    canonicalView,
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

export async function enqueueCharacterLoraCanonicalViewGenerationRuns(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  const job = await getExistingJob(id);
  const parsed = parseWithSchema(enqueueCanonicalGenerationSchema, input);

  if (parsed.inputImages && parsed.sourceImageIds) {
    throw new CharacterLoraCanonicalServiceError(
      "Provide either inputImages or sourceImageIds, not both",
      400,
    );
  }

  const payloads = buildCanonicalViewGenerationPayloads({
    characterName: job.characterName,
    triggerToken: job.triggerToken,
    provider: parsed.provider,
    hostModel: parsed.hostModel,
    imageModel: parsed.imageModel,
    hostInstruction: parsed.hostInstruction,
    visualPrompt: parsed.visualPrompt,
    characterDescription: parsed.characterDescription,
    finalPromptDraft: parsed.finalPromptDraft,
    renderedPrompt: parsed.renderedPrompt,
    negativePrompt: parsed.negativePrompt,
    toolParams: parsed.toolParams,
    inputImages: parsed.inputImages,
    sourceImageIds: parsed.sourceImageIds,
  });

  const runs = [];
  for (const payload of payloads) {
    const { canonicalView, canonicalViewLabel, ...runInput } = payload;
    const run = await enqueueCharacterLoraCanonicalGenerationRun(id, { ...runInput, canonicalView });
    runs.push({ ...run, canonicalView, canonicalViewLabel });
  }

  return runs;
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
    canonicalView: run.canonicalView,
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
    canonicalView: run.canonicalView,
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
    parsed.canonicalView ? `canonicalView=${parsed.canonicalView}` : null,
    `provenance=manual_upload; sourceImageId=${sourceImage.id}; artifactId=${sourceArtifact.id}; artifactPath=${sourceArtifact.relativePath}`,
    parsed.notes ? `operatorNotes=${parsed.notes}` : null,
  ].filter((note): note is string => Boolean(note));

  return createManualCanonicalVersionFromSourceImage({
    jobId: normalizedJobId,
    canonicalView: parsed.canonicalView ?? null,
    imageArtifactId: sourceArtifact.id,
    notes: notes.join("; "),
  });
}

export async function rejectCharacterLoraCanonicalVersion(jobId: string, versionId: string) {
  const normalizedJobId = normalizeId(jobId, "jobId");
  const normalizedVersionId = normalizeId(versionId, "versionId");
  const job = await getExistingJob(normalizedJobId);
  const version = await getCharacterLoraCanonicalVersion(normalizedVersionId);

  if (!version || version.jobId !== normalizedJobId) {
    throw new CharacterLoraCanonicalServiceError("Canonical version not found for this job", 404, {
      jobId: normalizedJobId,
      versionId: normalizedVersionId,
    });
  }

  if (job.currentCanonicalVersionId === normalizedVersionId) {
    throw new CharacterLoraCanonicalServiceError(
      "Current canonical version cannot be rejected",
      409,
      { jobId: normalizedJobId, versionId: normalizedVersionId },
    );
  }

  if (version.status === "selected") {
    throw new CharacterLoraCanonicalServiceError(
      "Selected canonical version cannot be rejected",
      409,
      { jobId: normalizedJobId, versionId: normalizedVersionId, status: version.status },
    );
  }

  if (version.status === "superseded") {
    throw new CharacterLoraCanonicalServiceError(
      "Superseded canonical version cannot be rejected",
      409,
      { jobId: normalizedJobId, versionId: normalizedVersionId, status: version.status },
    );
  }

  if (version.status === "rejected") {
    throw new CharacterLoraCanonicalServiceError(
      "Canonical version is already rejected",
      409,
      { jobId: normalizedJobId, versionId: normalizedVersionId, status: version.status },
    );
  }

  if (version.status !== "candidate") {
    throw new CharacterLoraCanonicalServiceError(
      "Only candidate canonical versions can be rejected",
      409,
      { jobId: normalizedJobId, versionId: normalizedVersionId, status: version.status },
    );
  }

  const rejected = await rejectCanonicalVersionInRepository({
    jobId: normalizedJobId,
    canonicalVersionId: normalizedVersionId,
  });

  if (!rejected) {
    const latest = await getCharacterLoraCanonicalVersion(normalizedVersionId);

    throw new CharacterLoraCanonicalServiceError(
      "Only candidate canonical versions can be rejected",
      409,
      {
        jobId: normalizedJobId,
        versionId: normalizedVersionId,
        status: latest?.status ?? "missing",
      },
    );
  }

  return rejected;
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

  if (version.status === "rejected") {
    throw new CharacterLoraCanonicalServiceError(
      "Rejected canonical version cannot be selected",
      409,
      { jobId: normalizedJobId, versionId: normalizedVersionId, status: version.status },
    );
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

async function resolveProviderInputImages(
  jobId: string,
  sourceImages: CharacterLoraSourceImageSummary[],
  parsed: z.infer<typeof enqueueCanonicalGenerationSchema>,
) {
  if (parsed.inputImages) {
    return validateExplicitCanonicalInputImages(jobId, sourceImages, parsed.inputImages);
  }

  if (parsed.sourceImageIds) {
    return resolveProviderInputImagesBySourceIds(sourceImages, parsed.sourceImageIds);
  }

  return sourceImages.map(sourceImageToProviderInput);
}

async function validateExplicitCanonicalInputImages(
  jobId: string,
  sourceImages: CharacterLoraSourceImageSummary[],
  inputImages: CharacterLoraProviderInputImage[],
) {
  if (inputImages.length === 0) {
    throw new CharacterLoraCanonicalServiceError("inputImages must include at least one image", 400);
  }

  const uniqueArtifactIds = new Set(inputImages.map((inputImage) => inputImage.artifactId));
  if (uniqueArtifactIds.size !== inputImages.length) {
    throw new CharacterLoraCanonicalServiceError("inputImages must not contain duplicate artifacts", 400);
  }

  const artifacts = await Promise.all(
    inputImages.map((inputImage) => getCharacterLoraArtifact(inputImage.artifactId)),
  );
  const sourceById = new Map(sourceImages.map((sourceImage) => [sourceImage.id, sourceImage]));
  const missingArtifactIds: string[] = [];
  const foreignArtifactIds: string[] = [];
  const mismatchedArtifactIds: string[] = [];
  const missingSourceImageIds: string[] = [];
  const mismatchedSourceImageIds: string[] = [];

  for (let index = 0; index < inputImages.length; index += 1) {
    const inputImage = inputImages[index];
    const artifact = artifacts[index];

    if (!artifact) {
      missingArtifactIds.push(inputImage.artifactId);
    } else if (artifact.jobId !== jobId) {
      foreignArtifactIds.push(inputImage.artifactId);
    } else if (
      artifact.relativePath !== inputImage.relativePath ||
      !artifact.sha256 ||
      artifact.sha256.toLowerCase() !== inputImage.sha256.toLowerCase()
    ) {
      mismatchedArtifactIds.push(inputImage.artifactId);
    }

    if (!inputImage.sourceImageId) {
      continue;
    }

    const sourceImage = sourceById.get(inputImage.sourceImageId);
    if (!sourceImage) {
      missingSourceImageIds.push(inputImage.sourceImageId);
    } else if (sourceImage.artifactId !== inputImage.artifactId) {
      mismatchedSourceImageIds.push(inputImage.sourceImageId);
    }
  }

  if (missingArtifactIds.length > 0 || foreignArtifactIds.length > 0) {
    throw new CharacterLoraCanonicalServiceError("One or more inputImages do not belong to this job", 404, {
      missingArtifactIds,
      foreignArtifactIds,
    });
  }

  if (mismatchedArtifactIds.length > 0) {
    throw new CharacterLoraCanonicalServiceError("One or more inputImages do not match the stored artifact", 409, {
      artifactIds: mismatchedArtifactIds,
    });
  }

  if (missingSourceImageIds.length > 0 || mismatchedSourceImageIds.length > 0) {
    throw new CharacterLoraCanonicalServiceError("One or more inputImages source references are invalid", 404, {
      missingSourceImageIds,
      mismatchedSourceImageIds,
    });
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
    return "Create a local image_generation task record for canonical payload validation. Do not call external providers and do not include secrets or private paths in stored payloads.";
  }

  return "Call the image generation worker with the provided canonical request fields. Forward inputImages, visualPrompt, renderedPrompt, toolParams, and outputDir unchanged. Do not add credentials, private paths, or extra prompt text.";
}

function buildDefaultCanonicalVisualPrompt(job: CharacterLoraTrainingJobSummary) {
  return [
    `Single character canonical/reference sheet for ${job.characterName}.`,
    "Use a plain white or neutral background with clean lighting.",
    "Front-facing full-body composition with the complete character visible.",
    "Preserve identity, face, hair, outfit, shoes, accessories, and overall silhouette from the source images for LoRA training.",
    `Use trigger token "${job.triggerToken}" as metadata only; do not render text in the image.`,
    "No text, logo, watermark, extra props, extra characters, or background clutter.",
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
