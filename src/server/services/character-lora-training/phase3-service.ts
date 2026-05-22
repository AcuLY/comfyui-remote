import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";

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
  type CharacterLoraSourceImageSummary,
  type CharacterLoraCandidateImageSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  ensureCharacterLoraDirectory,
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
const DEFAULT_SOURCE_WEIGHT = 1;

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
  const inputImages = await resolveSectionInputImages(job.id, canonicalVersion.imageArtifactId, parsed);
  const visualPrompt =
    parsed.visualPrompt ??
    buildDefaultSectionVisualPrompt({
      characterName: job.characterName,
      sectionName: section.name,
      sectionKey: section.key,
      promptCardDraft: promptCardVersion.finalPromptDraft,
      userInstruction: parsed.userInstruction ?? null,
      inputImages,
    });
  const renderedPrompt = parsed.renderedPrompt ?? visualPrompt;

  const request = {
    jobId: job.id,
    generationRunId: runId,
    provider,
    hostModel: parsed.hostModel ?? DEFAULT_HOST_MODELS[provider],
    imageModel: parsed.imageModel ?? DEFAULT_IMAGE_MODEL,
    hostInstruction,
    visualPrompt,
    renderedPrompt,
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
  const forceOverride = parsed.force
    ? {
        enabled: true,
        reason: parsed.forceReason ?? null,
        warningCount: warnings.length,
      }
    : null;
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
  const provenancePolicy = buildDatasetProvenancePolicy();
  let sourceCount = 0;
  let syntheticCount = 0;

  for (let index = 0; index < keepImages.length; index += 1) {
    const image = keepImages[index];
    const [originalArtifact, generationRun] = await Promise.all([
      getCharacterLoraArtifact(image.artifactId),
      getCharacterLoraGenerationRun(image.generationRunId),
    ]);

    if (!originalArtifact || originalArtifact.jobId !== id) {
      throw new CharacterLoraPhase3ServiceError("Candidate image artifact is missing for dataset freeze", 409, {
        candidateImageId: image.id,
        artifactId: image.artifactId,
      });
    }

    if (!generationRun || generationRun.jobId !== id) {
      throw new CharacterLoraPhase3ServiceError("Candidate generation run is missing for dataset freeze", 409, {
        candidateImageId: image.id,
        generationRunId: image.generationRunId,
      });
    }

    const provenance = classifyDatasetItemProvenance({
      image,
      imageArtifact: originalArtifact,
      generationRun,
    });
    if (provenance.origin === "source") {
      sourceCount += 1;
    } else {
      syntheticCount += 1;
    }

    const itemWeight = resolveDatasetItemTrainingWeight({
      origin: provenance.origin,
      repeatCount,
      requestedSourceWeight: parsed.sourceWeight,
    });
    const stem = `${String(index + 1).padStart(4, "0")}_${image.id}`;
    const imagePath = `${trainDir}/${stem}${getTrainingImageExtension(originalArtifact.relativePath)}`;
    const materializedImage = await copyDatasetTrainingImage({
      jobRoot: job.artifactRoot,
      sourceRelativePath: originalArtifact.relativePath,
      targetRelativePath: imagePath,
    });
    const materializedImageArtifact = await createCharacterLoraJobArtifact({
      jobId: id,
      kind: "candidate_image",
      relativePath: materializedImage.relativePath,
      absolutePath: materializedImage.absolutePath,
      sha256: materializedImage.sha256,
      byteSize: BigInt(materializedImage.byteSize),
      mimeType: originalArtifact.mimeType,
      metadata: toInputJsonValue({
        datasetRevisionId: revisionId,
        candidateImageId: image.id,
        artifactRole: "dataset_train_image",
        originalArtifactId: originalArtifact.id,
        originalRelativePath: originalArtifact.relativePath,
        provenance,
      }),
    });
    const caption = normalizeCaptionTrigger(job.triggerToken, image.captionDraft ?? buildFallbackCaption(job, image));
    const captionPath = `${trainDir}/${stem}.txt`;
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
        imageArtifactId: materializedImageArtifact.id,
        imagePath: materializedImage.relativePath,
      }),
    });

    itemRecords.push({
      candidateImageId: image.id,
      imageArtifactId: materializedImageArtifact.id,
      captionArtifactId: captionArtifact.id,
      captionText: caption,
      repeatCount: itemWeight.repeatCount,
      sourceWeight: itemWeight.sourceWeight,
      sortOrder: index,
    });
    manifestItems.push({
      candidateImageId: image.id,
      imageArtifactId: materializedImageArtifact.id,
      originalImageArtifactId: originalArtifact.id,
      originalImagePath: originalArtifact.relativePath,
      imagePath: materializedImage.relativePath,
      fileName: materializedImage.datasetFileName,
      captionPath: captionArtifactStat.relativePath,
      sectionId: image.sectionId,
      generationRunId: image.generationRunId,
      sha256: materializedImage.sha256,
      originalSha256: image.sha256,
      origin: provenance.origin,
      provenance,
      repeatCount: itemWeight.repeatCount,
      sourceWeight: itemWeight.sourceWeight,
    });
    metadataLines.push(JSON.stringify({
      file_name: materializedImage.datasetFileName,
      caption,
      candidateImageId: image.id,
      sectionId: image.sectionId,
      generationRunId: image.generationRunId,
      artifactId: materializedImageArtifact.id,
      originalArtifactId: originalArtifact.id,
      sha256: materializedImage.sha256,
      origin: provenance.origin,
      repeatCount: itemWeight.repeatCount,
      sourceWeight: itemWeight.sourceWeight,
    }));
    auditItems.push({
      candidateImageId: image.id,
      triggerFirst: caption.split(",")[0]?.trim() === job.triggerToken,
      caption,
      sectionId: image.sectionId,
      generationRunId: image.generationRunId,
      origin: provenance.origin,
      provenanceBasis: provenance.basis,
      imagePath: materializedImage.relativePath,
      originalImagePath: originalArtifact.relativePath,
      repeatCount: itemWeight.repeatCount,
      sourceWeight: itemWeight.sourceWeight,
    });
  }

  const selectedManifest = await writeCharacterLoraJsonArtifact(job.artifactRoot, `${datasetRoot}/selected-manifest.json`, {
    datasetRevisionId: revisionId,
    jobId: id,
    version,
    canonicalVersionId: job.currentCanonicalVersionId,
    promptCardVersionId: job.currentPromptCardVersionId,
    captionStrategy,
    trainDir,
    sourceCount,
    syntheticCount,
    requestedRepeatCount: repeatCount,
    requestedSourceWeight: parsed.sourceWeight ?? null,
    provenancePolicy,
    forceOverride,
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
    sourceCount,
    syntheticCount,
    provenancePolicy,
    forceOverride,
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
    sourceCount,
    syntheticCount,
    selectedManifestArtifactId: selectedManifestArtifact.id,
    metadataJsonlArtifactId: metadataJsonlArtifact.id,
    captionAuditArtifactId: captionAuditArtifact.id,
    items: itemRecords,
  });

  return {
    revision,
    summary: {
      itemCount: keepImages.length,
      sourceCount,
      syntheticCount,
      warnings,
      forceOverride,
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
    return validateExplicitSectionInputImages(jobId, parsed.inputImages);
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
      sourceImageId: sourceImage.id,
      role: sourceImageRoleToProviderRole(sourceImage.role),
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

async function validateExplicitSectionInputImages(
  jobId: string,
  inputImages: CharacterLoraProviderInputImage[],
) {
  if (inputImages.length === 0) {
    throw new CharacterLoraPhase3ServiceError("inputImages must include at least one image", 400);
  }

  const [artifacts, sourceImages] = await Promise.all([
    Promise.all(inputImages.map((inputImage) => getCharacterLoraArtifact(inputImage.artifactId))),
    inputImages.some((inputImage) => inputImage.sourceImageId)
      ? listCharacterLoraSourceImages(jobId)
      : Promise.resolve([]),
  ]);
  const sourceById = new Map(sourceImages.map((sourceImage) => [sourceImage.id, sourceImage]));
  const missingArtifactIds: string[] = [];
  const foreignArtifactIds: string[] = [];
  const mismatchedArtifactIds: string[] = [];
  const missingSourceImageIds: string[] = [];
  const mismatchedSourceImageIds: string[] = [];

  for (const [index, inputImage] of inputImages.entries()) {
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
    throw new CharacterLoraPhase3ServiceError("One or more inputImages do not belong to this job", 404, {
      missingArtifactIds,
      foreignArtifactIds,
    });
  }

  if (mismatchedArtifactIds.length > 0) {
    throw new CharacterLoraPhase3ServiceError("One or more inputImages do not match the stored artifact", 409, {
      artifactIds: mismatchedArtifactIds,
    });
  }

  if (missingSourceImageIds.length > 0) {
    throw new CharacterLoraPhase3ServiceError("One or more inputImages sourceImageIds do not belong to this job", 404, {
      sourceImageIds: missingSourceImageIds,
    });
  }

  if (mismatchedSourceImageIds.length > 0) {
    throw new CharacterLoraPhase3ServiceError("One or more inputImages sourceImageIds do not match the artifactId", 409, {
      sourceImageIds: mismatchedSourceImageIds,
    });
  }

  return inputImages;
}

function sourceImageRoleToProviderRole(
  sourceRole: CharacterLoraSourceImageSummary["role"],
): CharacterLoraProviderInputImage["role"] {
  if (sourceRole === "setting") {
    return "setting";
  }

  if (sourceRole === "local_reference") {
    return "local_reference";
  }

  if (sourceRole === "rerun_reference") {
    return "previous_candidate";
  }

  return "source";
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
    return "Create a local image_generation task record for section payload validation. Do not call external providers and do not include secrets or private paths in stored payloads.";
  }

  return "Call the image generation worker with the provided section request fields. Forward inputImages, visualPrompt, renderedPrompt, toolParams, and outputDir unchanged. Do not add credentials, private paths, or extra prompt text.";
}

function buildDefaultSectionVisualPrompt(input: {
  characterName: string;
  sectionName: string;
  sectionKey: string;
  promptCardDraft: string;
  userInstruction: string | null;
  inputImages: CharacterLoraProviderInputImage[];
}) {
  return [
    "Global rules: single character only; preserve identity, outfit, shoes, accessories, and canonical silhouette; avoid text, logos, watermarks, extra props, extra characters, and background clutter.",
    `Prompt card final draft: ${input.promptCardDraft}`,
    `Section target: ${input.sectionName}; section key: ${input.sectionKey}; character: ${input.characterName}.`,
    input.userInstruction ? `User instruction: ${input.userInstruction}` : "User instruction: none.",
    buildReferenceImageNotes(input.inputImages),
    "Output constraints: produce one clean section-specific LoRA training candidate; keep the requested section target readable and do not average unrelated references together.",
  ]
    .join(" ");
}

function buildReferenceImageNotes(inputImages: CharacterLoraProviderInputImage[]) {
  const counts = inputImages.reduce<Record<CharacterLoraProviderInputImage["role"], number>>(
    (accumulator, inputImage) => {
      accumulator[inputImage.role] += 1;
      return accumulator;
    },
    { canonical: 0, source: 0, setting: 0, local_reference: 0, previous_candidate: 0 },
  );

  return [
    "Reference image notes: use each image role deliberately; do not average or blend all references.",
    `canonical (${counts.canonical}): primary identity, outfit, shoes, accessories, and silhouette anchor.`,
    `source (${counts.source}): supporting identity evidence; resolve conflicts in favor of the canonical anchor and prompt card.`,
    `setting (${counts.setting}): environment or lighting context only, not identity or outfit evidence.`,
    `local_reference (${counts.local_reference}): targeted local detail or operator correction reference.`,
    `previous_candidate (${counts.previous_candidate}): prior generated candidate for comparison; keep intentional corrections and avoid copying its errors.`,
  ].join(" ");
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

function buildDatasetProvenancePolicy() {
  return {
    sourceRules: [
      "candidate artifact kind is source_image",
      "generation run kind is an explicit source candidate/direct source/manual canonical import",
    ],
    syntheticRules: [
      "candidate output from a section or canonical generation run",
      "candidate with no direct source artifact marker",
    ],
    conservativeAssumption:
      "CharacterLoraCandidateImage currently requires generationRunId, so generated outputs are classified as synthetic even when their run used source/canonical input images.",
  };
}

function classifyDatasetItemProvenance(input: {
  image: CharacterLoraCandidateImageSummary;
  imageArtifact: NonNullable<Awaited<ReturnType<typeof getCharacterLoraArtifact>>>;
  generationRun: NonNullable<Awaited<ReturnType<typeof getCharacterLoraGenerationRun>>>;
}) {
  const artifactKind = input.imageArtifact.kind;
  const generationRunKind = input.generationRun.kind;
  const directSourceRunKinds = new Set(["source_candidate", "source", "direct_source", "manual_source", "manual_canonical"]);

  if (artifactKind === "source_image") {
    return {
      origin: "source" as const,
      basis: "artifact_kind:source_image",
      artifactKind,
      generationRunKind,
      conservative: false,
      note: "Candidate points directly at a source image artifact.",
    };
  }

  if (directSourceRunKinds.has(generationRunKind)) {
    return {
      origin: "source" as const,
      basis: `generation_run_kind:${generationRunKind}`,
      artifactKind,
      generationRunKind,
      conservative: true,
      note: "Run kind indicates a direct source/manual canonical import; current schema still stores generationRunId on candidate images.",
    };
  }

  return {
    origin: "synthetic" as const,
    basis: `generation_run_kind:${generationRunKind};artifact_kind:${artifactKind}`,
    artifactKind,
    generationRunKind,
    conservative: true,
    note: "Candidate is treated as generated output. Input source/canonical references on the run do not make the output a direct source image.",
  };
}

function resolveDatasetItemTrainingWeight(input: {
  origin: "source" | "synthetic";
  repeatCount: number;
  requestedSourceWeight?: number;
}) {
  if (input.origin !== "source") {
    return {
      repeatCount: input.repeatCount,
      sourceWeight: null,
    };
  }

  const sourceWeight = input.requestedSourceWeight ?? DEFAULT_SOURCE_WEIGHT;

  return {
    repeatCount: sourceWeight > DEFAULT_SOURCE_WEIGHT
      ? Math.max(input.repeatCount, Math.ceil(input.repeatCount * sourceWeight))
      : input.repeatCount,
    sourceWeight,
  };
}

function getTrainingImageExtension(relativePath: string) {
  const extension = path.posix.extname(relativePath);
  if (!extension) {
    throw new CharacterLoraPhase3ServiceError("Candidate image path must include a file extension", 409, {
      relativePath,
    });
  }
  return extension;
}

async function copyDatasetTrainingImage(input: {
  jobRoot: string;
  sourceRelativePath: string;
  targetRelativePath: string;
}) {
  await statCharacterLoraArtifact(input.jobRoot, input.sourceRelativePath);
  const sourcePath = resolveCharacterLoraArtifactPath(input.jobRoot, input.sourceRelativePath);
  const targetPath = resolveCharacterLoraArtifactPath(input.jobRoot, input.targetRelativePath);

  await ensureCharacterLoraDirectory(path.dirname(targetPath.absolutePath));
  await copyFile(sourcePath.absolutePath, targetPath.absolutePath);

  const copiedStat = await statCharacterLoraArtifact(input.jobRoot, targetPath.relativePath);

  return {
    ...copiedStat,
    datasetFileName: `train/${path.posix.basename(copiedStat.relativePath)}`,
  };
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
