import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import {
  characterLoraCaptionPatchRequestSchema,
  characterLoraDatasetFreezeRequestSchema,
  characterLoraImageGenerationOutputSchema,
  characterLoraImageReviewBatchRequestSchema,
  characterLoraImageReviewStatusSchema,
  characterLoraSectionGenerationRequestSchema,
  characterLoraWorkerTaskCompleteRequestSchema,
  characterLoraWorkerTaskFailRequestSchema,
  characterLoraWorkerTaskHeartbeatRequestSchema,
  characterLoraWorkerTaskLeaseRequestSchema,
  characterLoraWorkerTaskPayloadSchema,
  type CharacterLoraImageProvider,
  type CharacterLoraProviderInputImage,
  type CharacterLoraProviderToolParams,
} from "@/server/character-lora-training/contracts";
import {
  createCharacterLoraJobArtifact,
  createCharacterLoraSectionGenerationRunWithTask,
  createFrozenCharacterLoraDatasetRevision,
  failCharacterLoraWorkerTask,
  getCharacterLoraArtifact,
  getCharacterLoraCandidateImage,
  getCharacterLoraCanonicalVersion,
  getCharacterLoraGenerationRun,
  getCharacterLoraJobSection,
  getCharacterLoraPromptCardVersion,
  getCharacterLoraTrainingJob,
  getCharacterLoraWorkerTask,
  getNextCharacterLoraDatasetRevisionVersion,
  heartbeatCharacterLoraWorkerTask,
  leaseNextCharacterLoraWorkerTask,
  listCharacterLoraCandidateImages as listCandidateImagesFromRepository,
  listCharacterLoraDatasetRevisions as listDatasetRevisionsFromRepository,
  listCharacterLoraJobSections,
  listCharacterLoraSourceImages,
  reviewCharacterLoraCandidateImages,
  updateCharacterLoraCandidateCaption,
  completeImageGenerationWorkerTask,
  type CharacterLoraCandidateImageSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  redactCharacterLoraProviderPayload,
  resolveCharacterLoraArtifactPath,
  statCharacterLoraArtifact,
  writeCharacterLoraJsonArtifact,
  writeCharacterLoraTextArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import {
  CharacterLoraTrainingServiceError,
  completeCharacterLoraTrainingTask,
} from "@/server/services/character-lora-training/training-service";
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

const DEFAULT_LEASE_OWNER = "local-worker";
const DEFAULT_LEASE_SECONDS = 300;

export class CharacterLoraPhase3ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraPhase3ServiceError";
  }
}

export async function enqueueCharacterLoraSectionGenerationRun(sectionId: string, input: unknown = {}) {
  const normalizedSectionId = normalizeId(sectionId, "sectionId");
  const parsed = parseWithSchema(characterLoraSectionGenerationRequestSchema, input);

  if (parsed.inputImages && parsed.sourceImageIds) {
    throw new CharacterLoraPhase3ServiceError("Provide either inputImages or sourceImageIds, not both", 400);
  }

  const section = await getExistingSection(normalizedSectionId);
  const job = await getExistingJob(section.jobId);
  const [canonicalVersion, promptCardVersion] = await Promise.all([
    getCharacterLoraCanonicalVersion(section.canonicalVersionId),
    getCharacterLoraPromptCardVersion(section.promptCardVersionId),
  ]);

  if (!canonicalVersion || canonicalVersion.jobId !== job.id) {
    throw new CharacterLoraPhase3ServiceError("Section canonical version not found for job", 409);
  }

  if (!promptCardVersion || promptCardVersion.jobId !== job.id) {
    throw new CharacterLoraPhase3ServiceError("Section prompt card version not found for job", 409);
  }

  if (parsed.parentRunId) {
    const parentRun = await getCharacterLoraGenerationRun(parsed.parentRunId);
    if (!parentRun || parentRun.sectionId !== normalizedSectionId || parentRun.jobId !== job.id) {
      throw new CharacterLoraPhase3ServiceError("parentRunId must reference a run from this section", 404);
    }
  }

  const provider = parsed.provider ?? DEFAULT_PROVIDER;
  const runId = randomUUID();
  const outputDir = `sections/${section.id}/runs/${runId}`;
  const hostInstruction = parsed.hostInstruction ?? buildDefaultSectionHostInstruction(provider);
  const visualPrompt =
    parsed.visualPrompt ??
    buildDefaultSectionVisualPrompt({
      characterName: job.characterName,
      sectionName: section.name,
      sectionKey: section.key,
      promptCardDraft: promptCardVersion.finalPromptDraft,
      userInstruction: parsed.userInstruction ?? null,
    });
  const inputImages = await resolveSectionInputImages(job.id, canonicalVersion.imageArtifactId, parsed);

  const request = {
    jobId: job.id,
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
  };
  const taskPayload = parseWithSchema(characterLoraWorkerTaskPayloadSchema, {
    taskType: "image_generation",
    jobId: job.id,
    generationRunId: runId,
    request,
  });
  if (taskPayload.taskType !== "image_generation") {
    throw new CharacterLoraPhase3ServiceError("Invalid image generation task payload", 500);
  }

  const requestArtifact = await writeCharacterLoraJsonArtifact(
    job.artifactRoot,
    `${outputDir}/request.redacted.json`,
    redactCharacterLoraProviderPayload({
      purpose: "section_generation_request",
      enqueuedAt: new Date().toISOString(),
      sectionId: section.id,
      parentRunId: parsed.parentRunId ?? null,
      userInstruction: parsed.userInstruction ?? null,
      request,
    }),
  );

  return createCharacterLoraSectionGenerationRunWithTask({
    runId,
    jobId: job.id,
    sectionId: section.id,
    parentRunId: parsed.parentRunId ?? null,
    provider: request.provider,
    hostModel: request.hostModel,
    imageModel: request.imageModel,
    hostInstruction: request.hostInstruction,
    visualPrompt: request.visualPrompt,
    negativePrompt: request.negativePrompt ?? null,
    toolParams: toInputJsonValue(request.toolParams),
    inputImages: toInputJsonValue(request.inputImages),
    requestArtifact: {
      relativePath: requestArtifact.relativePath,
      absolutePath: requestArtifact.absolutePath,
      sha256: requestArtifact.sha256,
      byteSize: BigInt(requestArtifact.byteSize),
      metadata: toInputJsonValue({
        purpose: "section_generation_request",
        redacted: true,
        generationRunId: runId,
        sectionId: section.id,
        provider: request.provider,
        mtime: requestArtifact.mtime.toISOString(),
      }),
    },
    taskPayload,
  });
}

export async function listCharacterLoraCandidateImages(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  await getExistingJob(id);
  const querySchema = z.object({
    sectionId: z.string().trim().min(1).optional(),
    generationRunId: z.string().trim().min(1).optional(),
    reviewStatus: characterLoraImageReviewStatusSchema.optional(),
  }).strict();
  const parsed = parseWithSchema(querySchema, input);

  return listCandidateImagesFromRepository({
    jobId: id,
    sectionId: parsed.sectionId,
    generationRunId: parsed.generationRunId,
    reviewStatus: parsed.reviewStatus as CharacterLoraImageReviewStatus | undefined,
  });
}

export async function reviewCharacterLoraImages(input: unknown) {
  const parsed = parseWithSchema(characterLoraImageReviewBatchRequestSchema, input);
  return reviewCharacterLoraCandidateImages({
    images: parsed.images.map((image) => ({
      imageId: image.imageId,
      reviewStatus: image.reviewStatus,
      rejectReasons: image.rejectReasons ? toInputJsonValue(image.rejectReasons) : null,
      reviewNote: image.reviewNote ?? null,
    })),
  });
}

export async function updateCharacterLoraImageCaption(imageId: string, input: unknown) {
  const id = normalizeId(imageId, "imageId");
  const parsed = parseWithSchema(characterLoraCaptionPatchRequestSchema, input);
  const image = await getExistingCandidateImage(id);
  const job = await getExistingJob(image.jobId);

  return updateCharacterLoraCandidateCaption({
    imageId: id,
    captionDraft: normalizeCaptionTrigger(job.triggerToken, parsed.captionDraft),
  });
}

export async function listCharacterLoraDatasetRevisions(jobId: string) {
  const id = normalizeId(jobId, "jobId");
  await getExistingJob(id);
  return listDatasetRevisionsFromRepository(id);
}

export async function freezeCharacterLoraDataset(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  const parsed = parseWithSchema(characterLoraDatasetFreezeRequestSchema, input);
  const job = await getExistingJob(id);

  if (!job.currentCanonicalVersionId || !job.currentPromptCardVersionId) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze requires selected canonical and prompt card versions", 409);
  }

  const [sections, keepImages] = await Promise.all([
    listCharacterLoraJobSections(id),
    listCandidateImagesFromRepository({
      jobId: id,
      reviewStatus: CharacterLoraImageReviewStatus.keep,
    }),
  ]);

  if (keepImages.length === 0) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze requires at least one keep image", 409);
  }

  const warnings = buildDatasetFreezeWarnings(sections, keepImages);
  if (warnings.length > 0 && !parsed.force) {
    throw new CharacterLoraPhase3ServiceError(
      "Each section must reach targetKeepCount before freezing dataset",
      409,
      { warnings },
    );
  }

  const revisionId = randomUUID();
  const version = await getNextCharacterLoraDatasetRevisionVersion(id);
  const captionStrategy = parsed.captionStrategy ?? job.captionStrategy;
  const repeatCount = parsed.repeatCount ?? 1;
  const datasetRoot = `dataset/revisions/${revisionId}`;
  const trainDir = `${datasetRoot}/train`;
  const itemRecords = [];
  const manifestItems = [];
  const auditItems = [];
  const metadataLines = [];

  for (let index = 0; index < keepImages.length; index += 1) {
    const image = keepImages[index];
    const caption = normalizeCaptionTrigger(job.triggerToken, image.captionDraft ?? buildFallbackCaption(job, image));
    const captionPath = `${trainDir}/${String(index + 1).padStart(4, "0")}_${image.id}.txt`;
    const captionArtifactStat = await writeCharacterLoraTextArtifact(job.artifactRoot, captionPath, `${caption}\n`);
    const captionArtifact = await createCharacterLoraJobArtifact({
      jobId: id,
      kind: "caption",
      relativePath: captionArtifactStat.relativePath,
      absolutePath: captionArtifactStat.absolutePath,
      sha256: captionArtifactStat.sha256,
      byteSize: BigInt(captionArtifactStat.byteSize),
      mimeType: "text/plain",
      metadata: toInputJsonValue({
        datasetRevisionId: revisionId,
        candidateImageId: image.id,
        captionStrategy,
      }),
    });

    itemRecords.push({
      candidateImageId: image.id,
      imageArtifactId: image.artifactId,
      captionArtifactId: captionArtifact.id,
      captionText: caption,
      repeatCount,
      sourceWeight: parsed.sourceWeight ?? null,
      sortOrder: index,
    });
    manifestItems.push({
      candidateImageId: image.id,
      imageArtifactId: image.artifactId,
      imagePath: image.relativePath,
      captionPath: captionArtifactStat.relativePath,
      sectionId: image.sectionId,
      generationRunId: image.generationRunId,
      sha256: image.sha256,
      repeatCount,
      sourceWeight: parsed.sourceWeight ?? null,
    });
    metadataLines.push(JSON.stringify({
      file_name: image.relativePath,
      caption,
      candidateImageId: image.id,
      sectionId: image.sectionId,
      generationRunId: image.generationRunId,
      artifactId: image.artifactId,
      sha256: image.sha256,
    }));
    auditItems.push({
      candidateImageId: image.id,
      triggerFirst: caption.split(",")[0]?.trim() === job.triggerToken,
      caption,
      sectionId: image.sectionId,
    });
  }

  const selectedManifest = await writeCharacterLoraJsonArtifact(job.artifactRoot, `${datasetRoot}/selected-manifest.json`, {
    datasetRevisionId: revisionId,
    jobId: id,
    version,
    canonicalVersionId: job.currentCanonicalVersionId,
    promptCardVersionId: job.currentPromptCardVersionId,
    captionStrategy,
    warnings,
    items: manifestItems,
  });
  const metadataJsonl = await writeCharacterLoraTextArtifact(
    job.artifactRoot,
    `${datasetRoot}/metadata.jsonl`,
    `${metadataLines.join("\n")}\n`,
  );
  const captionAudit = await writeCharacterLoraJsonArtifact(job.artifactRoot, `${datasetRoot}/caption-audit.json`, {
    datasetRevisionId: revisionId,
    jobId: id,
    warnings,
    items: auditItems,
  });

  const [selectedManifestArtifact, metadataJsonlArtifact, captionAuditArtifact] = await Promise.all([
    createCharacterLoraJobArtifact({
      jobId: id,
      kind: "dataset_manifest",
      relativePath: selectedManifest.relativePath,
      absolutePath: selectedManifest.absolutePath,
      sha256: selectedManifest.sha256,
      byteSize: BigInt(selectedManifest.byteSize),
      mimeType: "application/json",
      metadata: toInputJsonValue({ datasetRevisionId: revisionId, artifactRole: "selected_manifest" }),
    }),
    createCharacterLoraJobArtifact({
      jobId: id,
      kind: "dataset_manifest",
      relativePath: metadataJsonl.relativePath,
      absolutePath: metadataJsonl.absolutePath,
      sha256: metadataJsonl.sha256,
      byteSize: BigInt(metadataJsonl.byteSize),
      mimeType: "application/jsonl",
      metadata: toInputJsonValue({ datasetRevisionId: revisionId, artifactRole: "metadata_jsonl" }),
    }),
    createCharacterLoraJobArtifact({
      jobId: id,
      kind: "dataset_manifest",
      relativePath: captionAudit.relativePath,
      absolutePath: captionAudit.absolutePath,
      sha256: captionAudit.sha256,
      byteSize: BigInt(captionAudit.byteSize),
      mimeType: "application/json",
      metadata: toInputJsonValue({ datasetRevisionId: revisionId, artifactRole: "caption_audit" }),
    }),
  ]);

  const revision = await createFrozenCharacterLoraDatasetRevision({
    revisionId,
    jobId: id,
    version,
    canonicalVersionId: job.currentCanonicalVersionId,
    promptCardVersionId: job.currentPromptCardVersionId,
    captionStrategy,
    trainDir,
    sourceCount: 0,
    syntheticCount: keepImages.length,
    selectedManifestArtifactId: selectedManifestArtifact.id,
    metadataJsonlArtifactId: metadataJsonlArtifact.id,
    captionAuditArtifactId: captionAuditArtifact.id,
    items: itemRecords,
  });

  return {
    revision,
    summary: {
      itemCount: keepImages.length,
      warnings,
      artifactPaths: {
        selectedManifest: selectedManifest.relativePath,
        metadataJsonl: metadataJsonl.relativePath,
        captionAudit: captionAudit.relativePath,
      },
    },
  };
}

export async function leaseNextCharacterLoraTask(input: unknown) {
  const parsed = parseWithSchema(characterLoraWorkerTaskLeaseRequestSchema, input);
  const leaseOwner = parsed.leaseOwner ?? DEFAULT_LEASE_OWNER;
  return leaseNextCharacterLoraWorkerTask({
    workerType: parsed.workerType as CharacterLoraWorkerType,
    leaseOwner,
    leaseExpiresAt: new Date(Date.now() + (parsed.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS) * 1000),
  });
}

export async function heartbeatCharacterLoraTask(taskId: string, input: unknown = {}) {
  const id = normalizeId(taskId, "taskId");
  const parsed = parseWithSchema(characterLoraWorkerTaskHeartbeatRequestSchema, input);

  const task = await heartbeatCharacterLoraWorkerTask({
    taskId: id,
    leaseOwner: parsed.leaseOwner,
    leaseExpiresAt: parsed.leaseDurationSeconds
      ? new Date(Date.now() + parsed.leaseDurationSeconds * 1000)
      : undefined,
    progressJson: parsed.progressJson ? toInputJsonValue(parsed.progressJson) : undefined,
  });

  if (!task) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return task;
}

export async function completeCharacterLoraTask(taskId: string, input: unknown) {
  const id = normalizeId(taskId, "taskId");
  const parsed = parseWithSchema(characterLoraWorkerTaskCompleteRequestSchema, input);
  const payload = await getTaskPayload(id, parsed.leaseOwner);

  if (payload.taskType === "training") {
    return completeCharacterLoraTrainingTask(id, {
      leaseOwner: parsed.leaseOwner,
      output: parsed.output,
    });
  }

  if (payload.taskType !== "image_generation") {
    throw new CharacterLoraPhase3ServiceError("Worker task completion is not supported for this task type", 409);
  }

  const imageOutput = parseWithSchema(characterLoraImageGenerationOutputSchema, parsed.output);
  const job = await getExistingJob(payload.jobId);
  const responseSummary = await writeCharacterLoraJsonArtifact(
    job.artifactRoot,
    imageOutput.responseSummaryPath,
    redactCharacterLoraProviderPayload({
      completedAt: new Date().toISOString(),
      generationRunId: payload.generationRunId,
      output: imageOutput,
    }),
  );
  const imageArtifacts = await Promise.all(
    imageOutput.images.map(async (image) => {
      const resolved = resolveCharacterLoraArtifactPath(job.artifactRoot, image.relativePath);
      const stat = await statArtifactIfExists(job.artifactRoot, image.relativePath);

      return {
        relativePath: resolved.relativePath,
        absolutePath: resolved.absolutePath,
        sha256: stat?.sha256 ?? image.sha256,
        width: image.width ?? null,
        height: image.height ?? null,
        byteSize: stat ? BigInt(stat.byteSize) : null,
        metadata: toInputJsonValue({
          generationRunId: payload.generationRunId,
          metadataPath: image.metadataPath ?? null,
        }),
      };
    }),
  );

  const result = await completeImageGenerationWorkerTask({
    taskId: id,
    leaseOwner: parsed.leaseOwner,
    output: imageOutput,
    imageArtifacts,
    responseSummaryArtifact: {
      relativePath: responseSummary.relativePath,
      absolutePath: responseSummary.absolutePath,
      sha256: responseSummary.sha256,
      byteSize: BigInt(responseSummary.byteSize),
      metadata: toInputJsonValue({
        generationRunId: payload.generationRunId,
        artifactRole: "response_summary",
      }),
    },
  });

  if (!result) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return result;
}

export async function failCharacterLoraTask(taskId: string, input: unknown) {
  const id = normalizeId(taskId, "taskId");
  const parsed = parseWithSchema(characterLoraWorkerTaskFailRequestSchema, input);
  const task = await failCharacterLoraWorkerTask({
    taskId: id,
    leaseOwner: parsed.leaseOwner,
    errorSummary: parsed.errorSummary,
    progressJson: parsed.providerError ? toInputJsonValue({ providerError: parsed.providerError }) : undefined,
  });

  if (!task) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return task;
}

export function mapCharacterLoraPhase3Error(error: unknown) {
  if (error instanceof CharacterLoraTrainingServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof CharacterLoraPhase3ServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { message: "Character LoRA Phase 3 record already exists", status: 409 };
    }
    if (error.code === "P2025") {
      return { message: "Character LoRA Phase 3 record not found", status: 404 };
    }
    if (error.code === "P2003") {
      return { message: "Character LoRA Phase 3 record references missing data", status: 409 };
    }
  }

  if (error instanceof Error) {
    return { message: error.message, status: 400 };
  }

  return {
    message: "Unexpected character LoRA Phase 3 error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function getTaskPayload(taskId: string, leaseOwner?: string) {
  const task = await getCharacterLoraWorkerTask(taskId);

  if (!task || task.status !== "running") {
    throw new CharacterLoraPhase3ServiceError("Worker task not found or not running", 404);
  }

  if (leaseOwner && task.leaseOwner !== leaseOwner) {
    throw new CharacterLoraPhase3ServiceError("Worker task lease owner mismatch", 404);
  }

  return parseWithSchema(characterLoraWorkerTaskPayloadSchema, task.payload);
}

async function resolveSectionInputImages(
  jobId: string,
  canonicalArtifactId: string,
  parsed: z.infer<typeof characterLoraSectionGenerationRequestSchema>,
) {
  if (parsed.inputImages) {
    if (parsed.inputImages.length === 0) {
      throw new CharacterLoraPhase3ServiceError("inputImages must include at least one image", 400);
    }
    return parsed.inputImages;
  }

  const canonicalArtifact = await getCharacterLoraArtifact(canonicalArtifactId);
  if (!canonicalArtifact?.sha256) {
    throw new CharacterLoraPhase3ServiceError("Canonical artifact is missing sha256", 409);
  }

  const inputImages: CharacterLoraProviderInputImage[] = [
    {
      artifactId: canonicalArtifact.id,
      role: "canonical",
      relativePath: canonicalArtifact.relativePath,
      sha256: canonicalArtifact.sha256,
    },
  ];
  const sourceImages = await listCharacterLoraSourceImages(jobId);
  const selectedSourceIds = parsed.sourceImageIds ? new Set(parsed.sourceImageIds) : null;

  for (const sourceImage of sourceImages) {
    if (selectedSourceIds && !selectedSourceIds.has(sourceImage.id)) {
      continue;
    }

    inputImages.push({
      artifactId: sourceImage.artifactId,
      role: sourceImage.role === "setting" ? "setting" : "source",
      relativePath: sourceImage.relativePath,
      sha256: sourceImage.sha256,
    });
  }

  if (selectedSourceIds) {
    const found = new Set(sourceImages.map((sourceImage) => sourceImage.id));
    const missing = parsed.sourceImageIds?.filter((sourceImageId) => !found.has(sourceImageId)) ?? [];
    if (missing.length > 0) {
      throw new CharacterLoraPhase3ServiceError("One or more source images were not found for this job", 404, {
        sourceImageIds: missing,
      });
    }
  }

  return inputImages;
}

async function getExistingJob(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);
  if (!job) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA training job not found", 404);
  }
  return job;
}

async function getExistingSection(sectionId: string) {
  const section = await getCharacterLoraJobSection(sectionId);
  if (!section) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA section not found", 404);
  }
  return section;
}

async function getExistingCandidateImage(imageId: string) {
  const image = await getCharacterLoraCandidateImage(imageId);
  if (!image) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA candidate image not found", 404);
  }
  return image;
}

function buildDefaultSectionHostInstruction(provider: CharacterLoraImageProvider) {
  if (provider === "mock-local") {
    return "Create a section candidate image generation task for local worker validation. Do not call external providers and do not include secrets in stored payloads.";
  }

  return "Create section-specific Character LoRA training images from supplied artifact references. Use image generation only through the worker and do not include credentials or private paths in provider payloads.";
}

function buildDefaultSectionVisualPrompt(input: {
  characterName: string;
  sectionName: string;
  sectionKey: string;
  promptCardDraft: string;
  userInstruction: string | null;
}) {
  return [
    input.promptCardDraft,
    `Generate a ${input.sectionName} training candidate for ${input.characterName}.`,
    `Section key: ${input.sectionKey}. Keep identity, outfit, shoes, accessories, and canonical silhouette consistent.`,
    input.userInstruction ? `User correction for this run: ${input.userInstruction}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function buildDatasetFreezeWarnings(
  sections: Awaited<ReturnType<typeof listCharacterLoraJobSections>>,
  keepImages: CharacterLoraCandidateImageSummary[],
) {
  const keepCountBySection = new Map<string, number>();
  for (const image of keepImages) {
    if (image.sectionId) {
      keepCountBySection.set(image.sectionId, (keepCountBySection.get(image.sectionId) ?? 0) + 1);
    }
  }

  return sections
    .filter((section) => (keepCountBySection.get(section.id) ?? 0) < section.targetKeepCount)
    .map((section) => ({
      sectionId: section.id,
      sectionKey: section.key,
      targetKeepCount: section.targetKeepCount,
      actualKeepCount: keepCountBySection.get(section.id) ?? 0,
    }));
}

function buildFallbackCaption(
  job: Awaited<ReturnType<typeof getExistingJob>>,
  image: CharacterLoraCandidateImageSummary,
) {
  return `${job.triggerToken}, ${job.characterName}, ${image.sectionId ?? "training candidate"}`;
}

function normalizeCaptionTrigger(triggerToken: string, caption: string) {
  const trigger = triggerToken.trim();
  const parts = caption
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== trigger);

  return [trigger, ...parts].join(", ");
}

async function statArtifactIfExists(jobRoot: string, relativePath: string) {
  try {
    return await statCharacterLoraArtifact(jobRoot, relativePath);
  } catch {
    return null;
  }
}

function normalizeId(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new CharacterLoraPhase3ServiceError(`${fieldName} is required`, 400);
  }
  return normalized;
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraPhase3ServiceError("Invalid character LoRA Phase 3 request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
