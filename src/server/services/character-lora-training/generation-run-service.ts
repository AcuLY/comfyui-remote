/**
 * Section generation run operations for character LoRA Phase 3.
 *
 * Extracted from phase3-service.ts — contains enqueue logic, input image
 * resolution, and prompt construction for section generation runs.
 */
import { randomUUID } from "node:crypto";

import { toInputJsonValue } from "@/server/services/character-lora-training/shared/service-utils";
import {
  characterLoraSectionGenerationRequestSchema,
  characterLoraWorkerTaskPayloadSchema,
  type CharacterLoraImageProvider,
  type CharacterLoraProviderInputImage,
  type CharacterLoraProviderToolParams,
} from "@/server/character-lora-training/contracts";
import {
  cancelCharacterLoraGenerationRun as cancelGenerationRunInRepository,
  createCharacterLoraSectionGenerationRunWithTask,
  getCharacterLoraArtifact,
  getCharacterLoraCandidateImage,
  getCharacterLoraCanonicalVersion,
  getCharacterLoraGenerationRun,
  getCharacterLoraPromptCardVersion,
  listCharacterLoraCandidateImages as listCandidateImagesFromRepository,
  listCharacterLoraSourceImages,
  type CharacterLoraCandidateImageSummary,
  type CharacterLoraSourceImageSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  redactCharacterLoraProviderPayload,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import {
  CharacterLoraPhase3ServiceError,
  assertUniqueIds,
  getExistingJob,
  getExistingSection,
  normalizeId,
  parseWithSchema,
} from "@/server/services/character-lora-training/phase3-internal";
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

const characterLoraGenerationCancelRequestSchema = z.object({
  reason: z.string().trim().min(1).optional(),
  requestedBy: z.string().trim().min(1).optional(),
}).strict();

export async function enqueueCharacterLoraSectionGenerationRun(sectionId: string, input: unknown = {}) {
  const normalizedSectionId = normalizeId(sectionId, "sectionId");
  const parsed = parseWithSchema(characterLoraSectionGenerationRequestSchema, input);

  if (parsed.inputImages && parsed.sourceImageIds) {
    throw new CharacterLoraPhase3ServiceError("Provide either inputImages or sourceImageIds, not both", 400);
  }
  if (parsed.inputImages && parsed.previousCandidateImageIds) {
    throw new CharacterLoraPhase3ServiceError("Provide either inputImages or previousCandidateImageIds, not both", 400);
  }

  const section = await getExistingSection(normalizedSectionId);
  if (section.status === "paused") {
    throw new CharacterLoraPhase3ServiceError(
      "Character LoRA section is paused; resume it before enqueueing generation runs",
      409,
      { sectionId: normalizedSectionId, status: section.status },
    );
  }

  const job = await getExistingJob(section.jobId);
  if (!section.canonicalVersionId || !section.promptCardVersionId) {
    throw new CharacterLoraPhase3ServiceError(
      "Section must have current canonical and prompt card lineage before enqueueing generation runs",
      409,
      {
        sectionId: normalizedSectionId,
        canonicalVersionId: section.canonicalVersionId,
        promptCardVersionId: section.promptCardVersionId,
      },
    );
  }

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
  const inputImages = await resolveSectionInputImages(job.id, section.id, canonicalVersion.imageArtifactId, parsed);
  const templateVariables = {
    characterName: job.characterName,
    finalPromptDraft: promptCardVersion.finalPromptDraft,
    sectionName: section.name,
    sectionKey: section.key,
    angleTag: section.template?.angleTag ?? null,
  };
  const sectionTemplatePrompt = renderPromptTemplate(section.template?.promptTemplate ?? null, templateVariables);
  const visualPrompt =
    parsed.visualPrompt ??
    buildDefaultSectionVisualPrompt({
      characterName: job.characterName,
      sectionName: section.name,
      sectionKey: section.key,
      promptCardDraft: promptCardVersion.finalPromptDraft,
      sectionTemplatePrompt,
      userInstruction: parsed.userInstruction ?? null,
      inputImages,
    });
  const renderedPrompt = parsed.renderedPrompt ?? visualPrompt;
  const negativePrompt =
    parsed.negativePrompt ?? renderPromptTemplate(section.template?.negativeTemplate ?? null, templateVariables) ?? undefined;

  const request = {
    jobId: job.id,
    generationRunId: runId,
    provider,
    hostModel: parsed.hostModel ?? DEFAULT_HOST_MODELS[provider],
    imageModel: parsed.imageModel ?? DEFAULT_IMAGE_MODEL,
    hostInstruction,
    visualPrompt,
    renderedPrompt,
    negativePrompt,
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

export async function cancelCharacterLoraGenerationRun(runId: string, input: unknown = {}) {
  const normalizedRunId = normalizeId(runId, "generationRunId");
  const parsed = parseWithSchema(characterLoraGenerationCancelRequestSchema, input);
  const run = await getCharacterLoraGenerationRun(normalizedRunId);

  if (!run) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA generation run not found", 404);
  }

  if (run.status !== "queued" && run.status !== "running") {
    throw new CharacterLoraPhase3ServiceError("Only queued or running generation runs can be cancelled", 409, {
      generationRunId: run.id,
      status: run.status,
    });
  }

  const cancelled = await cancelGenerationRunInRepository({
    generationRunId: run.id,
    reason: parsed.reason ?? null,
    requestedBy: parsed.requestedBy ?? null,
  });

  if (!cancelled) {
    throw new CharacterLoraPhase3ServiceError("Character LoRA generation run not found", 404);
  }

  return cancelled;
}

// ---------------------------------------------------------------------------
// Input image resolution
// ---------------------------------------------------------------------------

async function resolveSectionInputImages(
  jobId: string,
  sectionId: string,
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

  const previousCandidateImages = await resolvePreviousCandidateInputImages({
    jobId,
    sectionId,
    parentRunId: parsed.parentRunId,
    previousCandidateImageIds: parsed.previousCandidateImageIds,
  });
  inputImages.push(...previousCandidateImages.map(candidateImageToPreviousCandidateInput));

  return inputImages;
}

async function resolvePreviousCandidateInputImages(input: {
  jobId: string;
  sectionId: string;
  parentRunId?: string;
  previousCandidateImageIds?: string[];
}) {
  if (input.previousCandidateImageIds) {
    assertUniqueIds(input.previousCandidateImageIds, "previousCandidateImageIds");
    return getPreviousCandidateImagesByIds(input.jobId, input.sectionId, input.previousCandidateImageIds);
  }

  if (!input.parentRunId) {
    return [];
  }

  return listCandidateImagesFromRepository({
    jobId: input.jobId,
    sectionId: input.sectionId,
    generationRunId: input.parentRunId,
  });
}

async function getPreviousCandidateImagesByIds(jobId: string, sectionId: string, candidateImageIds: string[]) {
  const candidateImages = await Promise.all(
    candidateImageIds.map((candidateImageId) => getCharacterLoraCandidateImage(candidateImageId)),
  );
  const candidateById = new Map(
    candidateImages
      .filter((candidateImage): candidateImage is CharacterLoraCandidateImageSummary => Boolean(candidateImage))
      .map((candidateImage) => [candidateImage.id, candidateImage]),
  );
  const missingCandidateImageIds: string[] = [];
  const foreignJobCandidateImageIds: string[] = [];
  const foreignSectionCandidateImageIds: string[] = [];

  for (const candidateImageId of candidateImageIds) {
    const candidateImage = candidateById.get(candidateImageId);

    if (!candidateImage) {
      missingCandidateImageIds.push(candidateImageId);
      continue;
    }

    if (candidateImage.jobId !== jobId) {
      foreignJobCandidateImageIds.push(candidateImageId);
    } else if (candidateImage.sectionId !== sectionId) {
      foreignSectionCandidateImageIds.push(candidateImageId);
    }
  }

  if (
    missingCandidateImageIds.length > 0 ||
    foreignJobCandidateImageIds.length > 0 ||
    foreignSectionCandidateImageIds.length > 0
  ) {
    throw new CharacterLoraPhase3ServiceError("One or more previousCandidateImageIds do not belong to this section", 404, {
      missingCandidateImageIds,
      foreignJobCandidateImageIds,
      foreignSectionCandidateImageIds,
    });
  }

  return candidateImageIds.map((candidateImageId) => candidateById.get(candidateImageId)!);
}

function candidateImageToPreviousCandidateInput(
  candidateImage: CharacterLoraCandidateImageSummary,
): CharacterLoraProviderInputImage {
  return {
    artifactId: candidateImage.artifactId,
    role: "previous_candidate",
    relativePath: candidateImage.relativePath,
    sha256: candidateImage.sha256,
  };
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

// ---------------------------------------------------------------------------
// Prompt construction helpers
// ---------------------------------------------------------------------------

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
  sectionTemplatePrompt?: string | null;
  userInstruction: string | null;
  inputImages: CharacterLoraProviderInputImage[];
}) {
  return [
    "Global rules: single character only; preserve identity, outfit, shoes, accessories, and canonical silhouette; avoid text, logos, watermarks, extra props, extra characters, and background clutter.",
    `Prompt card final draft: ${input.promptCardDraft}`,
    input.sectionTemplatePrompt ? `Section template: ${input.sectionTemplatePrompt}` : null,
    `Section target: ${input.sectionName}; section key: ${input.sectionKey}; character: ${input.characterName}.`,
    input.userInstruction ? `User instruction: ${input.userInstruction}` : "User instruction: none.",
    buildReferenceImageNotes(input.inputImages),
    "Output constraints: produce one clean section-specific LoRA training candidate; keep the requested section target readable and do not average unrelated references together.",
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function renderPromptTemplate(
  template: string | null | undefined,
  variables: {
    characterName: string;
    finalPromptDraft: string;
    sectionName: string;
    sectionKey: string;
    angleTag: string | null;
  },
) {
  const trimmed = template?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/\{\{\s*characterName\s*\}\}/g, variables.characterName)
    .replace(/\{\{\s*finalPromptDraft\s*\}\}/g, variables.finalPromptDraft)
    .replace(/\{\{\s*sectionName\s*\}\}/g, variables.sectionName)
    .replace(/\{\{\s*sectionKey\s*\}\}/g, variables.sectionKey)
    .replace(/\{\{\s*angleTag\s*\}\}/g, variables.angleTag ?? "");
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
