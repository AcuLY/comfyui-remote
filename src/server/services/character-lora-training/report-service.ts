import { Prisma } from "@/generated/prisma";
import { createCharacterLoraJobArtifact } from "@/server/repositories/character-lora-training-repository";
import {
  writeCharacterLoraJsonArtifact,
  writeCharacterLoraTextArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { buildCharacterLoraJobReport, listArtifactsByIds } from "@/server/services/character-lora-training/report-builder";

export type CharacterLoraJobReport = Awaited<ReturnType<typeof buildCharacterLoraJobReport>> & {};

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
  return getReport(normalizeJobId(jobId));
}

export async function persistCharacterLoraJobReport(jobId: string) {
  const report = await getReport(normalizeJobId(jobId));
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
  const persistedReport = await getReport(report.job.id);

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
    `Template: ${report.job.trainingTemplateLabel}`,
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
    `- Worker tasks: ${coverage.workerTasks}`,
    "",
    "## Worker Tasks",
    "",
    `Training command configured: ${report.trainingWorkerEnvironment.commandConfigured ? "yes" : "no"}`,
    `Training mode: ${report.trainingWorkerEnvironment.mode}`,
    `Supervisor: ${report.trainingWorkerEnvironment.supervisorCommand}`,
    `Mock supervisor: ${report.trainingWorkerEnvironment.mockSupervisorCommand}`,
    `Status endpoint: ${report.trainingWorkerEnvironment.statusEndpoint}`,
    "",
    ...formatBulletLines(
      report.workerTasks
        .filter((task) => task.status === "queued" || task.status === "running" || task.status === "failed")
        .map((task) =>
          `${task.id}: ${task.workerType}/${task.targetType}/${task.status}, leaseOwner=${task.leaseOwner ?? "-"}, heartbeat=${task.heartbeatAt ?? "-"}`,
        ),
    ),
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getReport(jobId: string) {
  const report = await buildCharacterLoraJobReport(jobId);
  if (!report) {
    throw new CharacterLoraReportServiceError("Character LoRA training job not found", 404);
  }
  return report;
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
