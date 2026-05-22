import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { createCharacterLoraJobArtifact } from "@/server/repositories/character-lora-training-repository";
import {
  writeCharacterLoraJsonArtifact,
  writeCharacterLoraTextArtifact,
} from "@/server/services/character-lora-training/artifact-service";

type ArtifactRef = {
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

export type CharacterLoraJobReport = Awaited<ReturnType<typeof buildCharacterLoraJobReport>>;

export class CharacterLoraReportServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraReportServiceError";
  }
}

export async function getCharacterLoraJobReport(jobId: string) {
  return buildCharacterLoraJobReport(normalizeJobId(jobId));
}

export async function persistCharacterLoraJobReport(jobId: string) {
  const report = await buildCharacterLoraJobReport(normalizeJobId(jobId));
  const timestamp = compactTimestamp(new Date());
  const jsonPath = `reports/job-report-${timestamp}.json`;
  const markdownPath = `reports/job-report-${timestamp}.md`;
  const markdown = renderCharacterLoraJobReportMarkdown(report);

  const [jsonStat, markdownStat] = await Promise.all([
    writeCharacterLoraJsonArtifact(report.job.artifactRoot, jsonPath, report),
    writeCharacterLoraTextArtifact(report.job.artifactRoot, markdownPath, markdown),
  ]);

  const [jsonArtifact, markdownArtifact] = await Promise.all([
    createCharacterLoraJobArtifact({
      jobId: report.job.id,
      kind: "job_report",
      relativePath: jsonStat.relativePath,
      absolutePath: jsonStat.absolutePath,
      sha256: jsonStat.sha256,
      byteSize: BigInt(jsonStat.byteSize),
      mimeType: "application/json",
      redactionLevel: "path_only",
      metadata: {
        format: "json",
        generatedAt: report.generatedAt,
        mtime: jsonStat.mtime.toISOString(),
      },
    }),
    createCharacterLoraJobArtifact({
      jobId: report.job.id,
      kind: "job_report",
      relativePath: markdownStat.relativePath,
      absolutePath: markdownStat.absolutePath,
      sha256: markdownStat.sha256,
      byteSize: BigInt(markdownStat.byteSize),
      mimeType: "text/markdown",
      redactionLevel: "path_only",
      metadata: {
        format: "markdown",
        generatedAt: report.generatedAt,
        mtime: markdownStat.mtime.toISOString(),
      },
    }),
  ]);

  const artifactRefs = await listArtifactsByIds([jsonArtifact.id, markdownArtifact.id]);
  const persistedReport = await buildCharacterLoraJobReport(report.job.id);

  return {
    report: persistedReport,
    markdown,
    artifacts: {
      json: artifactRefs.find((artifact) => artifact.id === jsonArtifact.id) ?? null,
      markdown: artifactRefs.find((artifact) => artifact.id === markdownArtifact.id) ?? null,
    },
  };
}

export function renderCharacterLoraJobReportMarkdown(report: CharacterLoraJobReport) {
  const coverage = report.diagnosticSummary.coverage;
  const lines = [
    `# Character LoRA Job Report: ${report.job.characterName}`,
    "",
    `Generated: ${report.generatedAt}`,
    `Job: ${report.job.id} / ${report.job.slug}`,
    `Status: ${report.job.status}`,
    `Phase: ${report.job.phase ?? "-"}`,
    "",
    "## Coverage",
    "",
    `- Source images: ${coverage.sourceImages}`,
    `- Canonical versions: ${coverage.canonicalVersions}`,
    `- Prompt card versions: ${coverage.promptCardVersions}`,
    `- Sections: ${coverage.sections}`,
    `- Candidate images: ${coverage.candidateImages}`,
    `- Dataset revisions: ${coverage.datasetRevisions}`,
    `- Training runs: ${coverage.trainingRuns}`,
    `- Benchmark runs: ${coverage.benchmarkRuns}`,
    `- Promotion decisions: ${coverage.promotionDecisions}`,
    "",
    "## Diagnostics",
    "",
    `Recommended return point: ${report.diagnosticSummary.recommendedReturnPoint}`,
    "",
    "Reasons:",
    ...formatBulletLines(report.diagnosticSummary.reasons),
    "",
    "Evidence:",
    ...formatBulletLines(report.diagnosticSummary.evidence),
    "",
    "Actions:",
    ...formatBulletLines(report.diagnosticSummary.actions),
    "",
    `Risk: ${report.diagnosticSummary.risk}`,
    "",
    "## Training",
    "",
    ...formatBulletLines(
      report.trainingRuns.map((run) =>
        `${run.id}: ${run.status}, finalSha=${run.finalSha256 ?? "-"}, checkpoints=${run.checkpoints.length}`,
      ),
    ),
    "",
    "## Benchmark",
    "",
    ...formatBulletLines(
      report.benchmarkRuns.map((run) =>
        `${run.id}: ${run.status}, recommendedWeight=${run.recommendedWeight ?? "-"}, report=${run.reportArtifactId ?? "-"}`,
      ),
    ),
    "",
    "## Promotion",
    "",
    ...formatBulletLines(
      report.promotionDecisions.map((decision) =>
        `${decision.id}: ${decision.status}, preset=${decision.promotedPresetId ?? "-"}, reason=${decision.decisionReason ?? "-"}`,
      ),
    ),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

export function mapCharacterLoraReportError(error: unknown) {
  if (error instanceof CharacterLoraReportServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return {
      message: "Character LoRA training report target not found",
      status: 404,
      details: "Database record was not found",
    };
  }

  return {
    message: "Unexpected character LoRA training report error",
    status: 500,
    details: "An internal error occurred",
  };
}

async function buildCharacterLoraJobReport(jobId: string) {
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
    },
  });

  if (!job) {
    throw new CharacterLoraReportServiceError("Character LoRA training job not found", 404);
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

  const generationRuns = job.generationRuns.map((run) => ({
    id: run.id,
    sectionId: run.sectionId,
    kind: run.kind,
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
    requestArtifact: run.requestArtifactId ? artifactById.get(run.requestArtifactId) ?? null : null,
    responseSummary: run.responseSummary,
    errorSummary: run.errorSummary,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }));

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
    lineage: {
      sourceGenerationRunId: image.generationRunId,
      sectionId: image.sectionId,
      includedDatasetRevisionId: image.includedDatasetRevisionId,
    },
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
    promotedCategoryId: decision.promotedCategoryId,
    promotedPresetId: decision.promotedPresetId,
    reportArtifactId: decision.reportArtifactId,
    reportArtifact: decision.reportArtifactId ? artifactById.get(decision.reportArtifactId) ?? null : null,
    decidedAt: decision.decidedAt?.toISOString() ?? null,
    promotedAt: decision.promotedAt?.toISOString() ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  }));

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
    }),
  };

  return report;
}

async function listArtifactsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const artifacts = await db.characterLoraArtifact.findMany({
    where: { id: { in: ids } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return artifacts.map(serializeArtifact);
}

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

function buildDiagnosticSummary(input: {
  status: string;
  counts: Record<string, number>;
  sections: Array<{ key: string; keepCount: number; rejectCount: number; pendingCount: number; targetKeepCount: number }>;
  candidateImages: Array<{ id: string; review: { status: string }; caption: { draft: string | null } }>;
  datasetRevisions: Array<{ id: string; status: string; itemCount: number }>;
  trainingRuns: Array<{ id: string; status: string; finalSha256: string | null; logArtifactId: string | null }>;
  benchmarkRuns: Array<{ id: string; status: string; reportArtifactId: string | null; resultSummary: unknown }>;
  promotionDecisions: Array<{ id: string; status: string; decisionReason: string | null; promotedPresetId: string | null }>;
}) {
  const reasons: string[] = [];
  const evidence: string[] = [];
  const actions: string[] = [];
  let recommendedReturnPoint: "source" | "canonical" | "prompt" | "sections" | "dataset_ready" | "trained" | "benchmark_review" | "promotion_ready" = "source";
  let risk: "low" | "medium" | "high" = "medium";
  const hasCompletedTraining = input.trainingRuns.some((run) => run.status === "done" && run.finalSha256);
  const hasCompletedBenchmark = input.benchmarkRuns.some((run) => run.status === "done");
  const hasPromotionDecision = input.promotionDecisions.some((decision) => decision.status === "approved" || decision.status === "promoted");
  const hasFullPromotionPath =
    input.counts.sourceImages > 0 &&
    input.counts.canonicalVersions > 0 &&
    input.counts.promptCardVersions > 0 &&
    input.counts.datasetRevisions > 0 &&
    hasCompletedTraining &&
    hasCompletedBenchmark &&
    hasPromotionDecision;

  if (hasFullPromotionPath) {
    recommendedReturnPoint = "promotion_ready";
    reasons.push("The full source-to-promotion chain has at least one completed path.");
    actions.push("Keep this report with the promoted LoRA artifact for future rollback/diagnostics.");
    risk = "low";
  } else if (input.counts.sourceImages === 0) {
    reasons.push("No source images are registered.");
    actions.push("Upload source/reference images before generating canonical images.");
    risk = "high";
  } else if (input.counts.canonicalVersions === 0) {
    recommendedReturnPoint = "canonical";
    reasons.push("No canonical version is available.");
    actions.push("Generate and select a canonical image.");
    risk = "high";
  } else if (input.counts.promptCardVersions === 0) {
    recommendedReturnPoint = "prompt";
    reasons.push("No prompt card version is available.");
    actions.push("Create a prompt card tied to the selected canonical version.");
    risk = "high";
  } else if (input.counts.sections === 0 || input.sections.some((section) => section.keepCount < section.targetKeepCount)) {
    recommendedReturnPoint = "sections";
    reasons.push("Section coverage is incomplete.");
    actions.push("Generate/review section candidates until each section reaches its keep target.");
    risk = "high";
  } else if (input.counts.datasetRevisions === 0) {
    recommendedReturnPoint = "dataset_ready";
    reasons.push("No frozen dataset revision is available.");
    actions.push("Freeze a dataset revision from kept/captioned candidates.");
    risk = "high";
  } else if (!hasCompletedTraining) {
    recommendedReturnPoint = "trained";
    reasons.push("No completed training run with finalSha256 is available.");
    actions.push("Complete training and verify final safetensors hash/log artifacts.");
    risk = "high";
  } else if (!hasCompletedBenchmark) {
    recommendedReturnPoint = "benchmark_review";
    reasons.push("No completed benchmark run is available.");
    actions.push("Run benchmark matrix and capture report/test project output.");
    risk = "medium";
  } else if (!hasPromotionDecision) {
    recommendedReturnPoint = "promotion_ready";
    reasons.push("No approved/promoted promotion decision is available.");
    actions.push("Review benchmark evidence and create a promotion decision.");
    risk = "medium";
  }

  const missingCaptions = input.candidateImages.filter((image) =>
    (image.review.status === "keep" || image.review.status === "included_in_training") && !image.caption.draft,
  );
  const missingBenchmarkReports = input.benchmarkRuns.filter((run) => run.status === "done" && !run.reportArtifactId);

  evidence.push(`sourceImages=${input.counts.sourceImages}`);
  evidence.push(`canonicalVersions=${input.counts.canonicalVersions}`);
  evidence.push(`promptCardVersions=${input.counts.promptCardVersions}`);
  evidence.push(`sections=${input.counts.sections}`);
  evidence.push(`candidateImages=${input.counts.candidateImages}, keep=${input.counts.keptCandidateImages}, reject=${input.counts.rejectedCandidateImages}, pending=${input.counts.pendingCandidateImages}`);
  evidence.push(`datasetRevisions=${input.counts.datasetRevisions}, datasetItems=${input.counts.datasetItems}`);
  evidence.push(`trainingRuns=${input.counts.trainingRuns}, completed=${input.counts.completedTrainingRuns}`);
  evidence.push(`benchmarkRuns=${input.counts.benchmarkRuns}`);
  evidence.push(`promotionDecisions=${input.counts.promotionDecisions}`);

  if (missingCaptions.length > 0) {
    reasons.push(`${missingCaptions.length} kept candidate image(s) have no caption draft.`);
    actions.push("Add captions to all kept candidates before re-freezing the dataset.");
    risk = risk === "low" ? "medium" : risk;
  }

  if (missingBenchmarkReports.length > 0) {
    reasons.push(`${missingBenchmarkReports.length} completed benchmark run(s) have no report artifact.`);
    actions.push("Persist benchmark report artifacts for every completed benchmark.");
    risk = risk === "low" ? "medium" : risk;
  }

  return {
    recommendedReturnPoint,
    reasons,
    evidence,
    actions,
    risk,
    coverage: {
      sourceImages: input.counts.sourceImages,
      canonicalVersions: input.counts.canonicalVersions,
      promptCardVersions: input.counts.promptCardVersions,
      sections: input.counts.sections,
      candidateImages: input.counts.candidateImages,
      datasetRevisions: input.counts.datasetRevisions,
      datasetItems: input.counts.datasetItems,
      trainingRuns: input.counts.trainingRuns,
      benchmarkRuns: input.counts.benchmarkRuns,
      promotionDecisions: input.counts.promotionDecisions,
    },
  };
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

function normalizeJobId(jobId: string) {
  const normalized = jobId.trim();

  if (!normalized) {
    throw new CharacterLoraReportServiceError("jobId is required", 400);
  }

  return normalized;
}

function compactTimestamp(date: Date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

function formatBulletLines(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function collectStrings(value: unknown, keys: string[]) {
  const found = new Set<string>();
  collectStringsFromValue(value, new Set(keys), found);
  return Array.from(found);
}

function collectStringsFromValue(value: unknown, keys: Set<string>, found: Set<string>) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringsFromValue(item, keys, found);
    }
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.has(key)) {
      if (typeof nestedValue === "string") {
        found.add(nestedValue);
      } else if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (typeof item === "string") found.add(item);
        }
      }
    }

    collectStringsFromValue(nestedValue, keys, found);
  }
}
