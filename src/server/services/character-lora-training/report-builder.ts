/**
 * Report data assembly for character LoRA job reports.
 *
 * Extracted from report-service.ts — contains buildCharacterLoraJobReport
 * and its data-fetching / data-mapping helpers.
 */
import { readFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { buildDiagnosticSummary, collectStrings } from "@/server/services/character-lora-training/report-diagnostics";

export type ArtifactRef = {
  id: string;
  kind: string;
  relativePath: string;
  absolutePath: string | null;
  sha256: string | null;
  byteSize: string | null;
  mimeType: string | null;
  redactionLevel: string;
  metadata: unknown;
  createdAt: string;
};

export async function buildCharacterLoraJobReport(jobId: string) {
  const job = await db.characterLoraTrainingJob.findUnique({
    where: { id: jobId },
    include: {
      sourceImages: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
      canonicalVersions: { orderBy: [{ version: "asc" }] },
      promptCardVersions: { orderBy: [{ version: "asc" }] },
      sections: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      generationRuns: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      candidateImages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      datasetRevisions: {
        orderBy: [{ version: "asc" }],
        include: {
          items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        },
      },
      trainingRuns: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          checkpoints: { orderBy: [{ step: "asc" }, { id: "asc" }] },
        },
      },
      benchmarkRuns: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      promotionDecisions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      artifacts: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      workerTasks: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
    },
  });

  if (!job) {
    // Import is avoided here — caller catches null and throws the appropriate error
    return null;
  }

  const artifacts = job.artifacts.map(serializeArtifact);
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const reportArtifacts = artifacts
    .filter((artifact) => artifact.kind === "job_report")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const benchmarkProjectIds = job.benchmarkRuns
    .map((run) => run.testProjectId)
    .filter((projectId): projectId is string => Boolean(projectId));
  const benchmarkProjectSummaries = await loadBenchmarkProjectSummaries(benchmarkProjectIds);
  const benchmarkProjectById = new Map(benchmarkProjectSummaries.map((project) => [project.id, project]));
  const requestPayloadByArtifactId = await loadGenerationRequestPayloads(job.generationRuns, artifactById);

  const sourceImages = job.sourceImages.map((image) => ({
    id: image.id,
    role: image.role,
    artifactId: image.artifactId,
    artifact: artifactById.get(image.artifactId) ?? null,
    relativePath: image.filePath,
    sha256: image.sha256,
    width: image.width,
    height: image.height,
    provenance: image.provenance,
    sortOrder: image.sortOrder,
    createdAt: image.createdAt.toISOString(),
  }));

  const canonicalVersions = job.canonicalVersions.map((version) => ({
    id: version.id,
    version: version.version,
    status: version.status,
    canonicalView: version.canonicalView,
    sourceRunId: version.sourceRunId,
    imageArtifactId: version.imageArtifactId,
    artifact: artifactById.get(version.imageArtifactId) ?? null,
    selectedAt: version.selectedAt?.toISOString() ?? null,
    notes: version.notes,
    createdAt: version.createdAt.toISOString(),
  }));

  const promptCardVersions = job.promptCardVersions.map((version) => ({
    id: version.id,
    canonicalVersionId: version.canonicalVersionId,
    version: version.version,
    triggerToken: version.triggerToken,
    identityTraits: version.identityTraits,
    outfitTraits: version.outfitTraits,
    negativeTraits: version.negativeTraits,
    finalPromptDraft: version.finalPromptDraft,
    changeReason: version.changeReason,
    createdAt: version.createdAt.toISOString(),
  }));

  const sections = job.sections.map((section) => ({
    id: section.id,
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
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
  }));

  const generationRuns = job.generationRuns.map((run) => {
    const requestPayload = run.requestArtifactId
      ? requestPayloadByArtifactId.get(run.requestArtifactId) ?? null
      : null;

    return {
      id: run.id,
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
      renderedPrompt: getRequestPayloadRenderedPrompt(requestPayload) ?? run.visualPrompt,
      userInstruction: getRequestPayloadUserInstruction(requestPayload),
      negativePrompt: run.negativePrompt,
      toolParams: run.toolParams,
      inputImageIds: getInputImageIdList(run.inputImages),
      sourceImageIds: getInputSourceImageIdList(run.inputImages),
      inputImages: run.inputImages,
      requestArtifactId: run.requestArtifactId,
      requestArtifact: run.requestArtifactId ? artifactById.get(run.requestArtifactId) ?? null : null,
      requestPayload,
      responseSummary: run.responseSummary,
      errorSummary: run.errorSummary,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  });
  const generationRunById = new Map(generationRuns.map((run) => [run.id, run]));
  const canonicalVersionByArtifactId = new Map(canonicalVersions.map((version) => [version.imageArtifactId, version]));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const buildCandidateImageLineage = (image: (typeof job.candidateImages)[number]) => {
    const generationRun = generationRunById.get(image.generationRunId) ?? null;
    const inputImages = getInputImageArray(generationRun?.inputImages);
    const runCanonicalArtifactId = getCanonicalInputArtifactId(inputImages);
    const runCanonicalVersion = runCanonicalArtifactId
      ? canonicalVersionByArtifactId.get(runCanonicalArtifactId) ?? null
      : null;
    const section = image.sectionId ? sectionById.get(image.sectionId) ?? null : null;

    return {
      sourceGenerationRunId: image.generationRunId,
      sectionId: image.sectionId,
      includedDatasetRevisionId: image.includedDatasetRevisionId,
      generationRun: generationRun
        ? {
            id: generationRun.id,
            kind: generationRun.kind,
            canonicalView: generationRun.canonicalView,
            parentRunId: generationRun.parentRunId,
            status: generationRun.status,
            provider: generationRun.provider,
            hostModel: generationRun.hostModel,
            imageModel: generationRun.imageModel,
            hostInstruction: generationRun.hostInstruction,
            visualPrompt: generationRun.visualPrompt,
            renderedPrompt: generationRun.renderedPrompt,
            userInstruction: generationRun.userInstruction,
            negativePrompt: generationRun.negativePrompt,
            toolParams: generationRun.toolParams,
            inputImageIds: generationRun.inputImageIds,
            sourceImageIds: generationRun.sourceImageIds,
            inputImages,
            requestArtifactId: generationRun.requestArtifactId,
            requestPayload: generationRun.requestPayload,
            createdAt: generationRun.createdAt,
            startedAt: generationRun.startedAt,
            finishedAt: generationRun.finishedAt,
          }
        : null,
      runCanonicalArtifactId,
      runCanonicalVersionId: runCanonicalVersion?.id ?? null,
      sectionCanonicalVersionId: section?.canonicalVersionId ?? null,
      sectionPromptCardVersionId: section?.promptCardVersionId ?? null,
    };
  };

  const candidateImages = job.candidateImages.map((image) => ({
    id: image.id,
    sectionId: image.sectionId,
    generationRunId: image.generationRunId,
    artifactId: image.artifactId,
    artifact: artifactById.get(image.artifactId) ?? null,
    relativePath: image.filePath,
    sha256: image.sha256,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize?.toString() ?? null,
    review: {
      status: image.reviewStatus,
      rejectReasons: image.rejectReasons,
      note: image.reviewNote,
      reviewedAt: image.reviewedAt?.toISOString() ?? null,
    },
    caption: {
      draft: image.captionDraft,
      artifactRefs: artifacts.filter(
        (artifact) => artifact.kind === "caption" && getMetadataString(artifact.metadata, "candidateImageId") === image.id,
      ),
    },
    lineage: buildCandidateImageLineage(image),
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  }));

  const datasetRevisions = job.datasetRevisions.map((revision) => ({
    id: revision.id,
    version: revision.version,
    status: revision.status,
    canonicalVersionId: revision.canonicalVersionId,
    promptCardVersionId: revision.promptCardVersionId,
    captionStrategy: revision.captionStrategy,
    itemCount: revision.itemCount,
    sourceCount: revision.sourceCount,
    syntheticCount: revision.syntheticCount,
    selectedManifestArtifactId: revision.selectedManifestArtifactId,
    selectedManifestArtifact: artifactById.get(revision.selectedManifestArtifactId) ?? null,
    metadataJsonlArtifactId: revision.metadataJsonlArtifactId,
    metadataJsonlArtifact: artifactById.get(revision.metadataJsonlArtifactId) ?? null,
    captionAuditArtifactId: revision.captionAuditArtifactId,
    captionAuditArtifact: revision.captionAuditArtifactId ? artifactById.get(revision.captionAuditArtifactId) ?? null : null,
    trainDir: revision.trainDir,
    frozenAt: revision.frozenAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    items: revision.items.map((item) => ({
      id: item.id,
      candidateImageId: item.candidateImageId,
      imageArtifactId: item.imageArtifactId,
      imageArtifact: artifactById.get(item.imageArtifactId) ?? null,
      captionArtifactId: item.captionArtifactId,
      captionArtifact: artifactById.get(item.captionArtifactId) ?? null,
      captionText: item.captionText,
      repeatCount: item.repeatCount,
      sourceWeight: item.sourceWeight,
      sortOrder: item.sortOrder,
    })),
  }));

  const trainingRuns = job.trainingRuns.map((run) => ({
    id: run.id,
    datasetRevisionId: run.datasetRevisionId,
    status: run.status,
    launcher: run.launcher,
    resolvedConfig: run.resolvedConfig,
    configArtifactId: run.configArtifactId,
    configArtifact: artifactById.get(run.configArtifactId) ?? null,
    dryRunSummaryArtifactId: run.dryRunSummaryArtifactId,
    dryRunSummaryArtifact: run.dryRunSummaryArtifactId ? artifactById.get(run.dryRunSummaryArtifactId) ?? null : null,
    logArtifactId: run.logArtifactId,
    logArtifact: run.logArtifactId ? artifactById.get(run.logArtifactId) ?? null : null,
    outputDir: run.outputDir,
    finalSafetensorsArtifactId: run.finalSafetensorsArtifactId,
    finalSafetensorsArtifact: run.finalSafetensorsArtifactId ? artifactById.get(run.finalSafetensorsArtifactId) ?? null : null,
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
    checkpoints: run.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      step: checkpoint.step,
      artifactId: checkpoint.artifactId,
      artifact: artifactById.get(checkpoint.artifactId) ?? null,
      sha256: checkpoint.sha256,
      metrics: checkpoint.metrics,
      createdAt: checkpoint.createdAt.toISOString(),
    })),
  }));

  const benchmarkRuns = job.benchmarkRuns.map((run) => ({
    id: run.id,
    trainingRunId: run.trainingRunId,
    status: run.status,
    loraAssetId: run.loraAssetId,
    testPresetId: run.testPresetId,
    testProjectId: run.testProjectId,
    templateId: run.templateId,
    checkpointMatrix: run.checkpointMatrix,
    weightMatrix: run.weightMatrix,
    reportArtifactId: run.reportArtifactId,
    reportArtifact: run.reportArtifactId ? artifactById.get(run.reportArtifactId) ?? null : null,
    recommendedWeight: run.recommendedWeight,
    resultSummary: run.resultSummary,
    cleanup: {
      testPresetCleaned: Boolean(run.testPresetCleanedAt),
      testProjectCleaned: Boolean(run.testProjectCleanedAt),
      testPresetCleanedAt: run.testPresetCleanedAt?.toISOString() ?? null,
      testProjectCleanedAt: run.testProjectCleanedAt?.toISOString() ?? null,
      summary: run.cleanupSummary,
    },
    summary: {
      testProjectId: run.testProjectId,
      testPresetId: run.testPresetId,
      testProject: run.testProjectId ? benchmarkProjectById.get(run.testProjectId) ?? null : null,
      testRunIds: collectStrings(run.resultSummary, ["runId", "runIds", "generationRunId", "generationRunIds"]),
      testImageIds: collectStrings(run.resultSummary, ["imageId", "imageIds", "candidateImageId", "candidateImageIds"]),
      reportArtifactId: run.reportArtifactId,
    },
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }));

  const promotionDecisions = job.promotionDecisions.map((decision) => ({
    id: decision.id,
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
    reportArtifact: decision.reportArtifactId ? artifactById.get(decision.reportArtifactId) ?? null : null,
    decidedAt: decision.decidedAt?.toISOString() ?? null,
    promotedAt: decision.promotedAt?.toISOString() ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  }));

  const workerTasks = job.workerTasks.map((task) => ({
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
  }));
  const workerTaskStatusCounts = workerTasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const trainingCommand = process.env.CHARACTER_LORA_TRAINING_COMMAND?.trim();
  const trainingWorkerEnvironment = {
    commandConfigured: Boolean(trainingCommand),
    mode: trainingCommand ? "real-capable" : "dry-run/mock-required",
    commandSource: trainingCommand ? "CHARACTER_LORA_TRAINING_COMMAND" : null,
    runbook: "docs/plans/2026-05-23-character-lora-worker-runbook.md",
    supervisorCommand: "cmd /c npm run character-lora:workers",
    mockSupervisorCommand: "cmd /c npm run character-lora:workers:mock",
    statusEndpoint: "/api/character-lora-training/worker/status",
  };

  const counts = {
    sourceImages: sourceImages.length,
    canonicalVersions: canonicalVersions.length,
    promptCardVersions: promptCardVersions.length,
    sections: sections.length,
    generationRuns: generationRuns.length,
    candidateImages: candidateImages.length,
    keptCandidateImages: candidateImages.filter((image) => image.review.status === "keep" || image.review.status === "included_in_training").length,
    rejectedCandidateImages: candidateImages.filter((image) => image.review.status === "reject").length,
    pendingCandidateImages: candidateImages.filter((image) => image.review.status === "pending").length,
    datasetRevisions: datasetRevisions.length,
    datasetItems: datasetRevisions.reduce((sum, revision) => sum + revision.items.length, 0),
    trainingRuns: trainingRuns.length,
    completedTrainingRuns: trainingRuns.filter((run) => run.status === "done").length,
    benchmarkRuns: benchmarkRuns.length,
    promotionDecisions: promotionDecisions.length,
    workerTasks: workerTasks.length,
    artifacts: artifacts.length,
    reportArtifacts: reportArtifacts.length,
  };

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    job: {
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
      trainingTemplateLabel: formatTrainingTemplateLabel(job.trainingTemplateId, job.trainingTemplateSnapshot),
      createdBy: job.createdBy,
      failureSummary: job.failureSummary,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      counts,
    },
    sourceImages,
    canonicalVersions,
    promptCardVersions,
    sections,
    generationRuns,
    candidateImages,
    datasetRevisions,
    trainingRuns,
    benchmarkRuns,
    benchmarkProjects: benchmarkProjectSummaries,
    promotionDecisions,
    workerTasks,
    workerTaskStatusCounts,
    trainingWorkerEnvironment,
    artifactRefs: artifacts,
    latestReportArtifacts: reportArtifacts.slice(0, 6),
    diagnosticSummary: buildDiagnosticSummary({
      status: job.status,
      counts,
      sections,
      candidateImages,
      datasetRevisions,
      trainingRuns,
      benchmarkRuns,
      promotionDecisions,
      workerTasks,
    }),
  };

  return report;
}

export async function listArtifactsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const artifacts = await db.characterLoraArtifact.findMany({
    where: { id: { in: ids } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return artifacts.map(serializeArtifact);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadBenchmarkProjectSummaries(projectIds: string[]) {
  if (projectIds.length === 0) return [];

  const projects = await db.project.findMany({
    where: { id: { in: Array.from(new Set(projectIds)) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      checkpointName: true,
      createdAt: true,
      updatedAt: true,
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          checkpointName: true,
          runs: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              status: true,
              runIndex: true,
              comfyPromptId: true,
              executionMeta: true,
              outputDir: true,
              errorMessage: true,
              startedAt: true,
              finishedAt: true,
              createdAt: true,
              images: {
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  filePath: true,
                  width: true,
                  height: true,
                  fileSize: true,
                  reviewStatus: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    slug: project.slug,
    status: project.status,
    checkpointName: project.checkpointName,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    sections: project.sections.map((section) => ({
      id: section.id,
      name: section.name,
      sortOrder: section.sortOrder,
      checkpointName: section.checkpointName,
      runs: section.runs.map((run) => ({
        id: run.id,
        status: run.status,
        runIndex: run.runIndex,
        comfyPromptId: run.comfyPromptId,
        executionMeta: run.executionMeta,
        outputDir: run.outputDir,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt?.toISOString() ?? null,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
        images: run.images.map((image) => ({
          id: image.id,
          filePath: image.filePath,
          width: image.width,
          height: image.height,
          fileSize: image.fileSize?.toString() ?? null,
          reviewStatus: image.reviewStatus,
          createdAt: image.createdAt.toISOString(),
        })),
      })),
    })),
  }));
}

function formatTrainingTemplateLabel(templateId: string | null, snapshot: unknown) {
  if (!templateId) {
    return "Legacy / no template";
  }

  const record = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : {};
  const name = typeof record.name === "string" && record.name.trim() ? record.name : "LoRA Template";
  const key = typeof record.key === "string" && record.key.trim() ? record.key : templateId;

  return `${name} / ${key}`;
}

function serializeArtifact(artifact: {
  id: string;
  kind: string;
  relativePath: string;
  absolutePath: string | null;
  sha256: string | null;
  byteSize: bigint | number | null;
  mimeType: string | null;
  redactionLevel: string;
  metadata: unknown;
  createdAt: Date;
}): ArtifactRef {
  return {
    id: artifact.id,
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

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

async function loadGenerationRequestPayloads(
  generationRuns: Array<{ requestArtifactId: string | null }>,
  artifactById: Map<string, ArtifactRef>,
) {
  const artifactIds = Array.from(
    new Set(generationRuns.map((run) => run.requestArtifactId).filter((id): id is string => Boolean(id))),
  );

  const entries = await Promise.all(
    artifactIds.map(async (artifactId) => {
      const artifact = artifactById.get(artifactId);
      if (!artifact?.absolutePath) {
        return null;
      }

      const payload = await readJsonRecordFile(artifact.absolutePath);
      return payload ? ([artifactId, payload] as const) : null;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry)));
}

async function readJsonRecordFile(absolutePath: string) {
  try {
    const parsed = JSON.parse(await readFile(absolutePath, "utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getInputImageArray(inputImages: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(inputImages)) {
    return inputImages.filter(isRecord);
  }

  return isRecord(inputImages) ? [inputImages] : [];
}

function getInputImageIdList(inputImages: unknown) {
  return getUniqueStringFieldValues(getInputImageArray(inputImages), "artifactId");
}

function getInputSourceImageIdList(inputImages: unknown) {
  return getUniqueStringFieldValues(getInputImageArray(inputImages), "sourceImageId");
}

function getRequestPayloadRenderedPrompt(payload: Record<string, unknown> | null) {
  const request = getRequestPayloadRequest(payload);
  return getStringField(request, "renderedPrompt") ?? getStringField(payload, "renderedPrompt");
}

function getRequestPayloadUserInstruction(payload: Record<string, unknown> | null) {
  const request = getRequestPayloadRequest(payload);
  return getStringField(payload, "userInstruction") ?? getStringField(request, "userInstruction");
}

function getRequestPayloadRequest(payload: Record<string, unknown> | null) {
  const request = payload?.request;
  return isRecord(request) ? request : null;
}

function getStringField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getUniqueStringFieldValues(items: Array<Record<string, unknown>>, key: string) {
  const values = new Set<string>();
  for (const item of items) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) {
      values.add(value);
    }
  }
  return Array.from(values);
}

function getCanonicalInputArtifactId(inputImages: Array<Record<string, unknown>>) {
  const canonical = inputImages.find((image) => image.role === "canonical");
  return typeof canonical?.artifactId === "string" ? canonical.artifactId : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
