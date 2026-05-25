import type {
  ArtifactRefRecord,
  BenchmarkRunRecord,
  BenchmarkTemplateRecord,
  CandidateImageRecord,
  CanonicalVersionRecord,
  DatasetRevisionRecord,
  GenerationRunRecord,
  GpuTaskLockRecord,
  JobSectionRecord,
  JobSummaryRecord,
  PromotionDecisionRecord,
  PromptCardVersionRecord,
  SectionTemplateRecord,
  SourceImageRecord,
  TrainingRunRecord,
  TrainingTemplateRecord,
  WorkerTaskRecord,
  CharacterLoraBenchmarkCleanupBlocker,
} from "./types";
import { CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT } from "./types";

export function serializeBenchmarkTemplate(template: BenchmarkTemplateRecord) {
  const sectionCount = template._count.sections;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    sectionCount,
    isUsable: sectionCount >= CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function serializeJobSummary(job: JobSummaryRecord) {
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
    trainingTemplateId: job.trainingTemplateId,
    trainingTemplateSnapshot: job.trainingTemplateSnapshot,
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

export function serializeTrainingTemplate(template: TrainingTemplateRecord) {
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description,
    baseFamily: template.baseFamily,
    captionStrategyDefault: template.captionStrategyDefault,
    canonicalDefaults: template.canonicalDefaults,
    promptCardDefaults: template.promptCardDefaults,
    trainingDefaults: template.trainingDefaults,
    benchmarkDefaults: template.benchmarkDefaults,
    promotionDefaults: template.promotionDefaults,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    counts: {
      sectionTemplates: template._count.sectionTemplates,
      jobs: template._count.jobs,
    },
  };
}

export function serializeSourceImage(sourceImage: SourceImageRecord) {
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

export function serializeArtifactRef(artifact: ArtifactRefRecord) {
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

export function serializeGenerationRun(run: GenerationRunRecord) {
  return {
    id: run.id,
    jobId: run.jobId,
    sectionId: run.sectionId,
    kind: run.kind,
    canonicalView: run.canonicalView,
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

export function serializeCanonicalVersion(version: CanonicalVersionRecord) {
  return {
    id: version.id,
    jobId: version.jobId,
    version: version.version,
    status: version.status,
    canonicalView: version.canonicalView,
    sourceRunId: version.sourceRunId,
    imageArtifactId: version.imageArtifactId,
    selectedAt: version.selectedAt?.toISOString() ?? null,
    notes: version.notes,
    createdAt: version.createdAt.toISOString(),
  };
}

export function serializePromptCardVersion(version: PromptCardVersionRecord) {
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

export function serializeSectionTemplate(template: SectionTemplateRecord) {
  return {
    id: template.id,
    trainingTemplateId: template.trainingTemplateId,
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

export function serializeJobSection(section: JobSectionRecord) {
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
    template: section.template
      ? {
          promptTemplate: section.template.promptTemplate,
          negativeTemplate: section.template.negativeTemplate,
          angleTag: section.template.angleTag,
          description: section.template.description,
        }
      : null,
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
  };
}

export function serializeCandidateImage(image: CandidateImageRecord) {
  return {
    id: image.id,
    jobId: image.jobId,
    sectionId: image.sectionId,
    generationRunId: image.generationRunId,
    artifactId: image.artifactId,
    filePath: image.filePath,
    relativePath: image.filePath,
    sha256: image.sha256,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize?.toString() ?? null,
    reviewStatus: image.reviewStatus,
    rejectReasons: image.rejectReasons,
    reviewNote: image.reviewNote,
    captionDraft: image.captionDraft,
    reviewedAt: image.reviewedAt?.toISOString() ?? null,
    includedDatasetRevisionId: image.includedDatasetRevisionId,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

export function serializeDatasetRevision(revision: DatasetRevisionRecord) {
  return {
    id: revision.id,
    jobId: revision.jobId,
    version: revision.version,
    status: revision.status,
    canonicalVersionId: revision.canonicalVersionId,
    promptCardVersionId: revision.promptCardVersionId,
    captionStrategy: revision.captionStrategy,
    itemCount: revision.itemCount,
    sourceCount: revision.sourceCount,
    syntheticCount: revision.syntheticCount,
    selectedManifestArtifactId: revision.selectedManifestArtifactId,
    metadataJsonlArtifactId: revision.metadataJsonlArtifactId,
    captionAuditArtifactId: revision.captionAuditArtifactId,
    trainDir: revision.trainDir,
    frozenAt: revision.frozenAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    counts: {
      items: revision._count.items,
      includedCandidateImages: revision._count.includedCandidateImages,
    },
  };
}

export function serializeTrainingRun(run: TrainingRunRecord) {
  return {
    id: run.id,
    jobId: run.jobId,
    datasetRevisionId: run.datasetRevisionId,
    status: run.status,
    launcher: run.launcher,
    resolvedConfig: run.resolvedConfig,
    configArtifactId: run.configArtifactId,
    dryRunSummaryArtifactId: run.dryRunSummaryArtifactId,
    logArtifactId: run.logArtifactId,
    outputDir: run.outputDir,
    finalSafetensorsArtifactId: run.finalSafetensorsArtifactId,
    finalSha256: run.finalSha256,
    metadataSummary: run.metadataSummary,
    currentStep: run.currentStep,
    targetSteps: run.targetSteps,
    lossSnapshot: run.lossSnapshot,
    cancelRequestedAt: run.cancelRequestedAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    counts: {
      checkpoints: run._count.checkpoints,
      benchmarkRuns: run._count.benchmarkRuns,
    },
  };
}

export function serializeBenchmarkRun(run: BenchmarkRunRecord) {
  return {
    id: run.id,
    jobId: run.jobId,
    trainingRunId: run.trainingRunId,
    status: run.status,
    loraAssetId: run.loraAssetId,
    testPresetId: run.testPresetId,
    testProjectId: run.testProjectId,
    templateId: run.templateId,
    checkpointMatrix: run.checkpointMatrix,
    weightMatrix: run.weightMatrix,
    reportArtifactId: run.reportArtifactId,
    recommendedWeight: run.recommendedWeight,
    resultSummary: run.resultSummary,
    cleanup: {
      testPresetCleaned: Boolean(run.testPresetCleanedAt),
      testProjectCleaned: Boolean(run.testProjectCleanedAt),
      testPresetCleanedAt: run.testPresetCleanedAt?.toISOString() ?? null,
      testProjectCleanedAt: run.testProjectCleanedAt?.toISOString() ?? null,
      summary: run.cleanupSummary,
    },
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    counts: {
      promotionDecisions: run._count.promotionDecisions,
    },
  };
}

export function serializePromotionDecision(decision: PromotionDecisionRecord) {
  return {
    id: decision.id,
    jobId: decision.jobId,
    benchmarkRunId: decision.benchmarkRunId,
    status: decision.status,
    selectedLoraAssetId: decision.selectedLoraAssetId,
    selectedCheckpoint: decision.selectedCheckpoint,
    defaultRecommendedWeight: decision.defaultRecommendedWeight,
    perVariantWeightOverrides: decision.perVariantWeightOverrides,
    variantPromptDrafts: decision.variantPromptDrafts,
    decisionReason: decision.decisionReason,
    rejectedReturnPoint: decision.rejectedReturnPoint,
    promotedCategoryId: decision.promotedCategoryId,
    promotedPresetId: decision.promotedPresetId,
    reportArtifactId: decision.reportArtifactId,
    decidedAt: decision.decidedAt?.toISOString() ?? null,
    promotedAt: decision.promotedAt?.toISOString() ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  };
}

export function serializeLoraAsset(asset: {
  id: string;
  name: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  size: bigint | number | null;
  category: string;
  triggerWords: string | null;
  notes: string | null;
  uploadedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: asset.id,
    name: asset.name,
    fileName: asset.fileName,
    absolutePath: asset.absolutePath,
    relativePath: asset.relativePath,
    size: asset.size === null ? null : Number(asset.size),
    category: asset.category,
    triggerWords: asset.triggerWords,
    notes: asset.notes,
    uploadedAt: asset.uploadedAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function serializeWorkerTask(task: WorkerTaskRecord) {
  return {
    id: task.id,
    jobId: task.jobId,
    workerType: task.workerType,
    targetType: task.targetType,
    targetId: task.targetId,
    status: task.status,
    payload: task.payload,
    leaseOwner: task.leaseOwner,
    leaseExpiresAt: task.leaseExpiresAt?.toISOString() ?? null,
    attemptCount: task.attemptCount,
    progressJson: task.progressJson,
    startedAt: task.startedAt?.toISOString() ?? null,
    heartbeatAt: task.heartbeatAt?.toISOString() ?? null,
    finishedAt: task.finishedAt?.toISOString() ?? null,
    errorSummary: task.errorSummary,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeGpuTaskLock(lock: GpuTaskLockRecord) {
  return {
    id: lock.id,
    taskType: lock.taskType,
    ownerType: lock.ownerType,
    ownerId: lock.ownerId,
    status: lock.status,
    startedAt: lock.startedAt.toISOString(),
    releasedAt: lock.releasedAt?.toISOString() ?? null,
    metadata: lock.metadata,
  };
}

// ReturnType-based exported type aliases
export type CharacterLoraTrainingJobSummary = ReturnType<typeof serializeJobSummary>;
export type CharacterLoraTrainingTemplateSummary = ReturnType<typeof serializeTrainingTemplate>;
export type CharacterLoraSourceImageSummary = ReturnType<typeof serializeSourceImage>;
export type CharacterLoraArtifactRefSummary = ReturnType<typeof serializeArtifactRef>;
export type CharacterLoraGenerationRunSummary = ReturnType<typeof serializeGenerationRun>;
export type CharacterLoraCanonicalVersionSummary = ReturnType<typeof serializeCanonicalVersion>;
export type CharacterLoraPromptCardVersionSummary = ReturnType<typeof serializePromptCardVersion>;
export type CharacterLoraSectionTemplateSummary = ReturnType<typeof serializeSectionTemplate>;
export type CharacterLoraJobSectionSummary = ReturnType<typeof serializeJobSection>;
export type CharacterLoraCandidateImageSummary = ReturnType<typeof serializeCandidateImage>;
export type CharacterLoraDatasetRevisionSummary = ReturnType<typeof serializeDatasetRevision>;
export type CharacterLoraTrainingRunSummary = ReturnType<typeof serializeTrainingRun>;
export type CharacterLoraBenchmarkRunSummary = ReturnType<typeof serializeBenchmarkRun>;
export type CharacterLoraPromotionDecisionSummary = ReturnType<typeof serializePromotionDecision>;
export type CharacterLoraWorkerTaskSummary = ReturnType<typeof serializeWorkerTask>;
export type CharacterLoraGpuTaskLockSummary = ReturnType<typeof serializeGpuTaskLock>;

export type CharacterLoraBenchmarkCleanupRepositoryResult = {
  benchmarkRun: CharacterLoraBenchmarkRunSummary;
  cleanup: Record<string, unknown>;
  blockers: CharacterLoraBenchmarkCleanupBlocker[];
  dryRun: boolean;
  canCleanup: boolean;
};
