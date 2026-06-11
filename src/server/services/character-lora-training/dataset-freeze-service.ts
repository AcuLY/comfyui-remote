/**
 * Dataset freeze operations for character LoRA Phase 3.
 *
 * Extracted from phase3-service.ts — contains dataset freeze preparation,
 * materialization, completion, and provenance classification.
 */
import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";

import { toInputJsonValue } from "@/server/services/character-lora-training/shared/service-utils";
import { CharacterLoraImageReviewStatus } from "@/generated/prisma/enums";
import {
  characterLoraWorkerTaskPayloadSchema,
  type CharacterLoraDatasetFreezeForceOverride,
  type CharacterLoraDatasetFreezeRequest,
  type CharacterLoraDatasetFreezeTaskPayload,
  type CharacterLoraDatasetFreezeWarning,
} from "@/server/character-lora-training/contracts";
import {
  completeDatasetFreezeWorkerTask,
  createCharacterLoraJobArtifact,
  getCharacterLoraArtifact,
  getCharacterLoraCanonicalVersion,
  getCharacterLoraCandidateImage,
  getCharacterLoraGenerationRun,
  getCharacterLoraPromptCardVersion,
  getNextCharacterLoraDatasetRevisionVersion,
  listCharacterLoraCandidateImages as listCandidateImagesFromRepository,
  listCharacterLoraJobSections,
  type CharacterLoraCandidateImageSummary,
} from "@/server/repositories/character-lora-training-repository";
import {
  ensureCharacterLoraDirectory,
  resolveCharacterLoraArtifactPath,
  statCharacterLoraArtifact,
  writeCharacterLoraJsonArtifact,
  writeCharacterLoraTextArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import {
  CharacterLoraPhase3ServiceError,
  assertUniqueIds,
  getExistingJob,
  normalizeCaptionTrigger,
  parseWithSchema,
} from "@/server/services/character-lora-training/phase3-internal";

const DEFAULT_SOURCE_WEIGHT = 1;

export type DatasetFreezePlan = {
  job: Awaited<ReturnType<typeof getExistingJob>>;
  revisionId: string;
  version: number;
  canonicalVersionId: string;
  promptCardVersionId: string;
  keepImages: CharacterLoraCandidateImageSummary[];
  captionStrategy: string;
  repeatCount: number;
  sourceWeight?: number;
  warnings: CharacterLoraDatasetFreezeWarning[];
  forceOverride: CharacterLoraDatasetFreezeForceOverride | null;
};

type DatasetFreezeRevisionInput = {
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
  items: Array<{
    candidateImageId: string;
    imageArtifactId: string;
    captionArtifactId: string;
    captionText: string;
    repeatCount: number;
    sourceWeight?: number | null;
    sortOrder: number;
  }>;
};

export async function prepareDatasetFreezePlan(
  jobId: string,
  parsed: CharacterLoraDatasetFreezeRequest,
): Promise<DatasetFreezePlan> {
  const job = await getExistingJob(jobId);

  if (!job.currentCanonicalVersionId || !job.currentPromptCardVersionId) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze requires selected canonical and prompt card versions", 409);
  }

  await validateDatasetFreezeVersionRefs(
    job.id,
    job.currentCanonicalVersionId,
    job.currentPromptCardVersionId,
  );

  const [sections, keepImages] = await Promise.all([
    listCharacterLoraJobSections(job.id),
    listCandidateImagesFromRepository({
      jobId: job.id,
      reviewStatus: CharacterLoraImageReviewStatus.keep,
    }),
  ]);

  if (keepImages.length === 0) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze requires at least one keep image", 409);
  }

  const warnings = buildDatasetFreezeWarnings(sections, keepImages);
  const forceOverride: CharacterLoraDatasetFreezeForceOverride | null = parsed.force
    ? {
        enabled: true,
        reason: requireForceReason(parsed.forceReason),
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

  return {
    job,
    revisionId: randomUUID(),
    version: await getNextCharacterLoraDatasetRevisionVersion(job.id),
    canonicalVersionId: job.currentCanonicalVersionId,
    promptCardVersionId: job.currentPromptCardVersionId,
    keepImages,
    captionStrategy: parsed.captionStrategy ?? job.captionStrategy,
    repeatCount: parsed.repeatCount ?? 1,
    sourceWeight: parsed.sourceWeight,
    warnings,
    forceOverride,
  };
}

export function buildDatasetFreezeTaskPayload(plan: DatasetFreezePlan): CharacterLoraDatasetFreezeTaskPayload {
  const payload = parseWithSchema(characterLoraWorkerTaskPayloadSchema, {
    taskType: "dataset_freeze",
    jobId: plan.job.id,
    datasetRevisionId: plan.revisionId,
    canonicalVersionId: plan.canonicalVersionId,
    promptCardVersionId: plan.promptCardVersionId,
    version: plan.version,
    keepImageIds: plan.keepImages.map((image) => image.id),
    captionStrategy: plan.captionStrategy,
    repeatCount: plan.repeatCount,
    ...(plan.sourceWeight === undefined ? {} : { sourceWeight: plan.sourceWeight }),
    forceOverride: plan.forceOverride,
    warnings: plan.warnings,
  });

  if (payload.taskType !== "dataset_freeze") {
    throw new CharacterLoraPhase3ServiceError("Invalid dataset freeze task payload", 500);
  }

  return payload;
}

export function buildQueuedDatasetFreezeSummary(plan: DatasetFreezePlan) {
  return {
    itemCount: plan.keepImages.length,
    keepImageIds: plan.keepImages.map((image) => image.id),
    captionStrategy: plan.captionStrategy,
    repeatCount: plan.repeatCount,
    sourceWeight: plan.sourceWeight ?? null,
    warnings: plan.warnings,
    forceOverride: plan.forceOverride,
  };
}

export async function completeCharacterLoraDatasetFreezeTask(
  taskId: string,
  leaseOwner: string | undefined,
  payload: CharacterLoraDatasetFreezeTaskPayload,
) {
  const job = await getExistingJob(payload.jobId);
  await validateDatasetFreezeVersionRefs(
    job.id,
    payload.canonicalVersionId,
    payload.promptCardVersionId,
  );

  const keepImages = await getDatasetFreezeSnapshotImages(job.id, payload.keepImageIds);
  const materialized = await materializeCharacterLoraDatasetFreeze({
    job,
    revisionId: payload.datasetRevisionId,
    version: payload.version,
    canonicalVersionId: payload.canonicalVersionId,
    promptCardVersionId: payload.promptCardVersionId,
    keepImages,
    captionStrategy: payload.captionStrategy,
    repeatCount: payload.repeatCount,
    sourceWeight: payload.sourceWeight,
    warnings: payload.warnings,
    forceOverride: payload.forceOverride ?? null,
  });
  const result = await completeDatasetFreezeWorkerTask({
    taskId,
    leaseOwner,
    revision: materialized.revision,
    progressJson: toInputJsonValue({
      completed: true,
      datasetRevisionId: payload.datasetRevisionId,
      version: payload.version,
      itemCount: materialized.summary.itemCount,
      sourceCount: materialized.summary.sourceCount,
      syntheticCount: materialized.summary.syntheticCount,
    }),
  });

  if (!result) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return {
    ...result,
    summary: materialized.summary,
  };
}

export async function materializeCharacterLoraDatasetFreeze(input: DatasetFreezePlan): Promise<{
  revision: DatasetFreezeRevisionInput;
  summary: {
    itemCount: number;
    sourceCount: number;
    syntheticCount: number;
    warnings: CharacterLoraDatasetFreezeWarning[];
    forceOverride: CharacterLoraDatasetFreezeForceOverride | null;
    artifactPaths: {
      selectedManifest: string;
      metadataJsonl: string;
      captionAudit: string;
    };
  };
}> {
  const datasetRoot = `dataset/revisions/${input.revisionId}`;
  const trainDir = `${datasetRoot}/train`;
  const itemRecords: DatasetFreezeRevisionInput["items"] = [];
  const manifestItems: Array<Record<string, unknown>> = [];
  const auditItems: Array<Record<string, unknown>> = [];
  const metadataLines: string[] = [];
  const provenancePolicy = buildDatasetProvenancePolicy();
  let sourceCount = 0;
  let syntheticCount = 0;

  for (let index = 0; index < input.keepImages.length; index += 1) {
    const image = input.keepImages[index];
    const [originalArtifact, generationRun] = await Promise.all([
      getCharacterLoraArtifact(image.artifactId),
      getCharacterLoraGenerationRun(image.generationRunId),
    ]);

    if (!originalArtifact || originalArtifact.jobId !== input.job.id) {
      throw new CharacterLoraPhase3ServiceError("Candidate image artifact is missing for dataset freeze", 409, {
        candidateImageId: image.id,
        artifactId: image.artifactId,
      });
    }

    if (!generationRun || generationRun.jobId !== input.job.id) {
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
      repeatCount: input.repeatCount,
      requestedSourceWeight: input.sourceWeight,
    });
    const stem = `${String(index + 1).padStart(4, "0")}_${image.id}`;
    const imagePath = `${trainDir}/${stem}${getTrainingImageExtension(originalArtifact.relativePath)}`;
    const materializedImage = await copyDatasetTrainingImage({
      jobRoot: input.job.artifactRoot,
      sourceRelativePath: originalArtifact.relativePath,
      targetRelativePath: imagePath,
    });
    const materializedImageArtifact = await createCharacterLoraJobArtifact({
      jobId: input.job.id,
      kind: "candidate_image",
      relativePath: materializedImage.relativePath,
      absolutePath: materializedImage.absolutePath,
      sha256: materializedImage.sha256,
      byteSize: BigInt(materializedImage.byteSize),
      mimeType: originalArtifact.mimeType,
      metadata: toInputJsonValue({
        datasetRevisionId: input.revisionId,
        candidateImageId: image.id,
        artifactRole: "dataset_train_image",
        originalArtifactId: originalArtifact.id,
        originalRelativePath: originalArtifact.relativePath,
        provenance,
      }),
    });
    const caption = normalizeCaptionTrigger(
      input.job.triggerToken,
      image.captionDraft ?? buildFallbackCaption(input.job, image),
    );
    const captionPath = `${trainDir}/${stem}.txt`;
    const captionArtifactStat = await writeCharacterLoraTextArtifact(input.job.artifactRoot, captionPath, `${caption}\n`);
    const captionArtifact = await createCharacterLoraJobArtifact({
      jobId: input.job.id,
      kind: "caption",
      relativePath: captionArtifactStat.relativePath,
      absolutePath: captionArtifactStat.absolutePath,
      sha256: captionArtifactStat.sha256,
      byteSize: BigInt(captionArtifactStat.byteSize),
      mimeType: "text/plain",
      metadata: toInputJsonValue({
        datasetRevisionId: input.revisionId,
        candidateImageId: image.id,
        captionStrategy: input.captionStrategy,
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
      triggerFirst: caption.split(",")[0]?.trim() === input.job.triggerToken,
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

  const selectedManifest = await writeCharacterLoraJsonArtifact(input.job.artifactRoot, `${datasetRoot}/selected-manifest.json`, {
    datasetRevisionId: input.revisionId,
    jobId: input.job.id,
    version: input.version,
    canonicalVersionId: input.canonicalVersionId,
    promptCardVersionId: input.promptCardVersionId,
    captionStrategy: input.captionStrategy,
    trainDir,
    sourceCount,
    syntheticCount,
    requestedRepeatCount: input.repeatCount,
    requestedSourceWeight: input.sourceWeight ?? null,
    provenancePolicy,
    forceOverride: input.forceOverride,
    warnings: input.warnings,
    items: manifestItems,
  });
  const metadataJsonl = await writeCharacterLoraTextArtifact(
    input.job.artifactRoot,
    `${datasetRoot}/metadata.jsonl`,
    `${metadataLines.join("\n")}\n`,
  );
  const captionAudit = await writeCharacterLoraJsonArtifact(input.job.artifactRoot, `${datasetRoot}/caption-audit.json`, {
    datasetRevisionId: input.revisionId,
    jobId: input.job.id,
    sourceCount,
    syntheticCount,
    provenancePolicy,
    forceOverride: input.forceOverride,
    warnings: input.warnings,
    items: auditItems,
  });

  const [selectedManifestArtifact, metadataJsonlArtifact, captionAuditArtifact] = await Promise.all([
    createCharacterLoraJobArtifact({
      jobId: input.job.id,
      kind: "dataset_manifest",
      relativePath: selectedManifest.relativePath,
      absolutePath: selectedManifest.absolutePath,
      sha256: selectedManifest.sha256,
      byteSize: BigInt(selectedManifest.byteSize),
      mimeType: "application/json",
      metadata: toInputJsonValue({ datasetRevisionId: input.revisionId, artifactRole: "selected_manifest" }),
    }),
    createCharacterLoraJobArtifact({
      jobId: input.job.id,
      kind: "dataset_manifest",
      relativePath: metadataJsonl.relativePath,
      absolutePath: metadataJsonl.absolutePath,
      sha256: metadataJsonl.sha256,
      byteSize: BigInt(metadataJsonl.byteSize),
      mimeType: "application/jsonl",
      metadata: toInputJsonValue({ datasetRevisionId: input.revisionId, artifactRole: "metadata_jsonl" }),
    }),
    createCharacterLoraJobArtifact({
      jobId: input.job.id,
      kind: "dataset_manifest",
      relativePath: captionAudit.relativePath,
      absolutePath: captionAudit.absolutePath,
      sha256: captionAudit.sha256,
      byteSize: BigInt(captionAudit.byteSize),
      mimeType: "application/json",
      metadata: toInputJsonValue({ datasetRevisionId: input.revisionId, artifactRole: "caption_audit" }),
    }),
  ]);

  return {
    revision: {
      revisionId: input.revisionId,
      jobId: input.job.id,
      version: input.version,
      canonicalVersionId: input.canonicalVersionId,
      promptCardVersionId: input.promptCardVersionId,
      captionStrategy: input.captionStrategy,
      trainDir,
      sourceCount,
      syntheticCount,
      selectedManifestArtifactId: selectedManifestArtifact.id,
      metadataJsonlArtifactId: metadataJsonlArtifact.id,
      captionAuditArtifactId: captionAuditArtifact.id,
      items: itemRecords,
    },
    summary: {
      itemCount: input.keepImages.length,
      sourceCount,
      syntheticCount,
      warnings: input.warnings,
      forceOverride: input.forceOverride,
      artifactPaths: {
        selectedManifest: selectedManifest.relativePath,
        metadataJsonl: metadataJsonl.relativePath,
        captionAudit: captionAudit.relativePath,
      },
    },
  };
}

export async function getDatasetFreezeSnapshotImages(jobId: string, keepImageIds: string[]) {
  assertUniqueIds(keepImageIds, "keepImageIds");
  const images = await Promise.all(keepImageIds.map((imageId) => getCharacterLoraCandidateImage(imageId)));
  const missingImageIds: string[] = [];
  const foreignImageIds: string[] = [];
  const byId = new Map<string, CharacterLoraCandidateImageSummary>();

  for (let index = 0; index < keepImageIds.length; index += 1) {
    const imageId = keepImageIds[index];
    const image = images[index];
    if (!image) {
      missingImageIds.push(imageId);
      continue;
    }
    if (image.jobId !== jobId) {
      foreignImageIds.push(imageId);
      continue;
    }
    byId.set(image.id, image);
  }

  if (missingImageIds.length > 0 || foreignImageIds.length > 0) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze payload references images outside this job", 404, {
      missingImageIds,
      foreignImageIds,
    });
  }

  return keepImageIds.map((imageId) => byId.get(imageId) as CharacterLoraCandidateImageSummary);
}

export async function validateDatasetFreezeVersionRefs(
  jobId: string,
  canonicalVersionId: string,
  promptCardVersionId: string,
) {
  const [canonicalVersion, promptCardVersion] = await Promise.all([
    getCharacterLoraCanonicalVersion(canonicalVersionId),
    getCharacterLoraPromptCardVersion(promptCardVersionId),
  ]);

  if (!canonicalVersion || canonicalVersion.jobId !== jobId) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze canonical version not found for job", 409);
  }

  if (!promptCardVersion || promptCardVersion.jobId !== jobId) {
    throw new CharacterLoraPhase3ServiceError("Dataset freeze prompt card version not found for job", 409);
  }
}

export { createCharacterLoraDatasetFreezeWorkerTask, createFrozenCharacterLoraDatasetRevision } from "@/server/repositories/character-lora-training-repository";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireForceReason(forceReason: string | undefined) {
  if (!forceReason) {
    throw new CharacterLoraPhase3ServiceError("forceReason is required when forcing dataset freeze", 400);
  }
  return forceReason;
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
