import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  serializeCsv,
  compareStrings,
  rate,
  parseNullableNumber,
} from "./csv-utils";

export const VALID_REFERENCE_PROJECT_TITLES = [
  "叶瞬光",
  "大乔",
  "安魂曲",
  "洛茜",
  "花火",
  "西格莉卡",
  "零",
] as const;

export const DEFAULT_MANUAL_EXCLUSION_NAMES = ["单人 · 拎鞋", "第一人称 · 胸压"] as const;

export const DEFAULT_MANUAL_EXCLUSIONS: Phase0ManualExclusion[] = [
  {
    canonicalSectionName: "单人 · 拎鞋",
    reason:
      "Luca confirmed this section is not representative for trash-rate/reference-risk analysis.",
  },
  {
    canonicalSectionName: "第一人称 · 胸压",
    reason:
      "Luca confirmed this section is not representative for trash-rate/reference-risk analysis.",
  },
];

export type Phase0ReviewStatus = "kept" | "trashed" | string;
export type Phase0Flag =
  | "manual_excluded"
  | "low_sample_lt20"
  | "low_project_coverage_lt5"
  | "has_unreviewed";

export interface Phase0ManualExclusion {
  canonicalSectionName: string;
  reason?: string;
}

export interface Phase0SourceRow {
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string | null;
  canonicalSectionName?: string | null;
  sortOrder: number | null;
  runId: string;
  imageId: string;
  filePath: string;
  thumbPath?: string | null;
  reviewStatus: Phase0ReviewStatus | null;
  checkpointName?: string | null;
  loraConfig?: unknown;
}

export interface Phase0LabeledImageRow {
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  canonicalSectionName: string;
  sortOrder: number | null;
  runId: string;
  imageId: string;
  filePath: string;
  thumbPath: string;
  reviewStatus: "kept" | "trashed";
  checkpointName: string;
  loraConfigSummary: string;
  sourceFlags: string;
  manualExcluded: boolean;
  lowSample: boolean;
  lowProjectCoverage: boolean;
  hasUnreviewed: boolean;
}

export interface Phase0ProjectPosition {
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  sortOrder: number | null;
}

export interface Phase0SectionProjectRow {
  canonicalSectionName: string;
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  sortOrder: number | null;
  labeled: number;
  kept: number;
  trashed: number;
  trashRate: number;
  keepRate: number;
  other: number;
  totalImages: number;
  flags: Phase0Flag[];
  checkpointNames: string[];
  loraConfigSummaries: string[];
}

export interface Phase0AggregateRow {
  canonicalSectionName: string;
  projectCoverage: number;
  labeled: number;
  kept: number;
  trashed: number;
  trashRate: number;
  keepRate: number;
  other: number;
  totalImages: number;
  projectPositions: Phase0ProjectPosition[];
  positions: string;
  flags: Phase0Flag[];
  manualExclusionReason: string;
}

export interface Phase0ReportPaths {
  labeledImagesCsv: string;
  aggregateCsv: string;
  sectionProjectCsv: string;
  markdown: string;
  summaryJson: string;
}

export interface Phase0BaselineSummary {
  phase: 0;
  validProjects: number;
  validProjectTitles: string[];
  labeledImages: number;
  canonicalSections: number;
  manualExclusionsLoaded: string[];
  sortOrderVarianceVerified: boolean;
  dbMutated: boolean;
  reproducible: boolean;
  failedCriteria?: string[];
  pass?: boolean;
  kept?: number;
  trashed?: number;
  other?: number;
  totalImages?: number;
  invalidProjectRowsExcluded?: number;
  reportPaths?: Partial<Phase0ReportPaths>;
  sourceDb?: string;
  statsSignature?: string;
  aggregateRows?: Phase0AggregateRow[];
  sectionProjectRows?: Phase0SectionProjectRow[];
  labeledRows?: Phase0LabeledImageRow[];
}

export interface Phase0Baseline {
  summary: Phase0BaselineSummary;
  aggregateRows: Phase0AggregateRow[];
  sectionProjectRows: Phase0SectionProjectRow[];
  labeledRows: Phase0LabeledImageRow[];
  sourceRowsCount: number;
  excludedRowsCount: number;
}

export interface Phase0AggregationOptions {
  validProjectTitles?: readonly string[];
  manualExclusions?: readonly (string | Phase0ManualExclusion)[];
  lowSampleThreshold?: number;
  lowProjectCoverageThreshold?: number;
  dbMutated?: boolean;
  reproducible?: boolean;
  sourceDb?: string;
}

export interface Phase0VerificationResult {
  phase: 0;
  pass: boolean;
  validProjects: number;
  labeledImages: number;
  canonicalSections: number;
  manualExclusionsLoaded: string[];
  sortOrderVarianceVerified: boolean;
  dbMutated: boolean;
  reproducible: boolean;
  failedCriteria: string[];
}

export interface WritePhase0BaselineReportsOptions {
  outputDir: string;
}

export type Phase0SqliteBackend = "auto" | "better-sqlite3" | "node:sqlite";

export interface ReadPhase0RowsFromSqliteOptions {
  sqliteBackend?: Phase0SqliteBackend;
}

export interface CreatePhase0BaselineFromSqliteOptions {
  projectRoot?: string;
  dbPath?: string;
  exclusionPath?: string;
  outDir?: string;
  sqliteBackend?: Phase0SqliteBackend;
}

interface SectionAccumulator {
  canonicalSectionName: string;
  rows: NormalizedSourceRow[];
  projectSections: Map<string, SectionProjectAccumulator>;
  projectIds: Set<string>;
  projectTitles: Set<string>;
  kept: number;
  trashed: number;
  other: number;
}

interface SectionProjectAccumulator {
  canonicalSectionName: string;
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  sortOrder: number | null;
  kept: number;
  trashed: number;
  other: number;
  checkpointNames: Set<string>;
  loraConfigSummaries: Set<string>;
}

interface NormalizedSourceRow extends Phase0SourceRow {
  sectionName: string;
  canonicalSectionName: string;
  reviewStatus: string;
  checkpointName: string;
  loraConfigSummary: string;
}

interface SqliteBaselineRow {
  projectId: unknown;
  projectTitle: unknown;
  sectionId: unknown;
  sectionName: unknown;
  sortOrder: unknown;
  runId: unknown;
  imageId: unknown;
  filePath: unknown;
  thumbPath: unknown;
  reviewStatus: unknown;
  checkpointName: unknown;
  loraConfig: unknown;
  resolvedConfigSnapshot: unknown;
}

interface SqliteStatementReader {
  all(...params: unknown[]): unknown[];
}

interface BetterSqliteDatabase {
  pragma(source: string): unknown;
  prepare(sql: string): SqliteStatementReader;
  close(): void;
}

interface BetterSqliteConstructor {
  new (
    filename: string,
    options: { readonly: boolean; fileMustExist: boolean },
  ): BetterSqliteDatabase;
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementReader;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (
    filename: string,
    options?: Record<string, unknown>,
  ) => NodeSqliteDatabase;
}

const FLAG_ORDER: Phase0Flag[] = [
  "manual_excluded",
  "low_sample_lt20",
  "low_project_coverage_lt5",
  "has_unreviewed",
];

const DEFAULT_LOW_SAMPLE_THRESHOLD = 20;
const DEFAULT_LOW_PROJECT_COVERAGE_THRESHOLD = 5;
const SUMMARY_JSON_NAME = "valid-projects-trash-rate-summary.json";

export function aggregatePhase0Baseline(
  rows: readonly Phase0SourceRow[],
  options: Phase0AggregationOptions = {},
): Phase0Baseline {
  const validProjectTitles = [...(options.validProjectTitles ?? VALID_REFERENCE_PROJECT_TITLES)];
  const validProjectTitleSet = new Set(validProjectTitles);
  const titleOrder = new Map(validProjectTitles.map((title, index) => [title, index]));
  const manualExclusions = normalizeManualExclusions(options.manualExclusions);
  const manualExclusionByName = new Map(
    manualExclusions.map((exclusion) => [
      normalizeCanonicalSectionName(exclusion.canonicalSectionName),
      exclusion.reason ?? "",
    ]),
  );
  const lowSampleThreshold = options.lowSampleThreshold ?? DEFAULT_LOW_SAMPLE_THRESHOLD;
  const lowProjectCoverageThreshold =
    options.lowProjectCoverageThreshold ?? DEFAULT_LOW_PROJECT_COVERAGE_THRESHOLD;

  const sectionAccumulators = new Map<string, SectionAccumulator>();
  let excludedRowsCount = 0;

  for (const sourceRow of rows) {
    if (!validProjectTitleSet.has(sourceRow.projectTitle)) {
      excludedRowsCount += 1;
      continue;
    }

    const normalizedRow = normalizeSourceRow(sourceRow);
    const section = getOrCreateSectionAccumulator(sectionAccumulators, normalizedRow);
    const sectionProject = getOrCreateSectionProjectAccumulator(
      section,
      normalizedRow,
    );

    section.rows.push(normalizedRow);
    section.projectIds.add(normalizedRow.projectId);
    section.projectTitles.add(normalizedRow.projectTitle);

    if (normalizedRow.reviewStatus === "kept") {
      section.kept += 1;
      sectionProject.kept += 1;
    } else if (normalizedRow.reviewStatus === "trashed") {
      section.trashed += 1;
      sectionProject.trashed += 1;
    } else {
      section.other += 1;
      sectionProject.other += 1;
    }

    if (normalizedRow.checkpointName) {
      sectionProject.checkpointNames.add(normalizedRow.checkpointName);
    }
    if (normalizedRow.loraConfigSummary) {
      sectionProject.loraConfigSummaries.add(normalizedRow.loraConfigSummary);
    }
  }

  const flagsByCanonicalSection = new Map<string, Phase0Flag[]>();
  const aggregateRows = [...sectionAccumulators.values()]
    .map((section) => {
      const labeled = section.kept + section.trashed;
      const totalImages = labeled + section.other;
      const projectPositions = [...section.projectSections.values()]
        .map((sectionProject) => ({
          projectId: sectionProject.projectId,
          projectTitle: sectionProject.projectTitle,
          sectionId: sectionProject.sectionId,
          sectionName: sectionProject.sectionName,
          sortOrder: sectionProject.sortOrder,
        }))
        .sort((left, right) => compareProjectPositions(left, right, titleOrder));
      const projectCoverage = section.projectIds.size;
      const flags = buildFlags({
        canonicalSectionName: section.canonicalSectionName,
        labeled,
        projectCoverage,
        other: section.other,
        manualExclusionByName,
        lowSampleThreshold,
        lowProjectCoverageThreshold,
      });
      flagsByCanonicalSection.set(section.canonicalSectionName, flags);

      return {
        canonicalSectionName: section.canonicalSectionName,
        projectCoverage,
        labeled,
        kept: section.kept,
        trashed: section.trashed,
        trashRate: rate(section.trashed, labeled),
        keepRate: rate(section.kept, labeled),
        other: section.other,
        totalImages,
        projectPositions,
        positions: formatPositions(projectPositions),
        flags,
        manualExclusionReason:
          manualExclusionByName.get(section.canonicalSectionName) ?? "",
      } satisfies Phase0AggregateRow;
    })
    .sort(compareAggregateRows);

  const aggregateSortOrder = new Map(
    aggregateRows.map((row, index) => [row.canonicalSectionName, index]),
  );

  const sectionProjectRows = [...sectionAccumulators.values()]
    .flatMap((section) =>
      [...section.projectSections.values()].map((sectionProject) => {
        const labeled = sectionProject.kept + sectionProject.trashed;
        return {
          canonicalSectionName: sectionProject.canonicalSectionName,
          projectId: sectionProject.projectId,
          projectTitle: sectionProject.projectTitle,
          sectionId: sectionProject.sectionId,
          sectionName: sectionProject.sectionName,
          sortOrder: sectionProject.sortOrder,
          labeled,
          kept: sectionProject.kept,
          trashed: sectionProject.trashed,
          trashRate: rate(sectionProject.trashed, labeled),
          keepRate: rate(sectionProject.kept, labeled),
          other: sectionProject.other,
          totalImages: labeled + sectionProject.other,
          flags: flagsByCanonicalSection.get(sectionProject.canonicalSectionName) ?? [],
          checkpointNames: [...sectionProject.checkpointNames].sort(compareStrings),
          loraConfigSummaries: [...sectionProject.loraConfigSummaries].sort(compareStrings),
        } satisfies Phase0SectionProjectRow;
      }),
    )
    .sort((left, right) =>
      compareByAggregateThenProject(left, right, aggregateSortOrder, titleOrder),
    );

  const labeledRows = [...sectionAccumulators.values()]
    .flatMap((section) =>
      section.rows
        .filter(
          (row): row is NormalizedSourceRow & { reviewStatus: "kept" | "trashed" } =>
            row.reviewStatus === "kept" || row.reviewStatus === "trashed",
        )
        .map((row) => {
          const flags = flagsByCanonicalSection.get(row.canonicalSectionName) ?? [];
          return {
            projectId: row.projectId,
            projectTitle: row.projectTitle,
            sectionId: row.sectionId,
            sectionName: row.sectionName,
            canonicalSectionName: row.canonicalSectionName,
            sortOrder: row.sortOrder,
            runId: row.runId,
            imageId: row.imageId,
            filePath: row.filePath,
            thumbPath: row.thumbPath ?? "",
            reviewStatus: row.reviewStatus,
            checkpointName: row.checkpointName,
            loraConfigSummary: row.loraConfigSummary,
            sourceFlags: flags.join(";"),
            manualExcluded: flags.includes("manual_excluded"),
            lowSample: flags.includes("low_sample_lt20"),
            lowProjectCoverage: flags.includes("low_project_coverage_lt5"),
            hasUnreviewed: flags.includes("has_unreviewed"),
          } satisfies Phase0LabeledImageRow;
        }),
    )
    .sort((left, right) => compareLabeledRows(left, right, aggregateSortOrder, titleOrder));

  const labeledImages = aggregateRows.reduce((sum, row) => sum + row.labeled, 0);
  const kept = aggregateRows.reduce((sum, row) => sum + row.kept, 0);
  const trashed = aggregateRows.reduce((sum, row) => sum + row.trashed, 0);
  const other = aggregateRows.reduce((sum, row) => sum + row.other, 0);
  const summaryBase: Omit<Phase0BaselineSummary, "statsSignature"> = {
    phase: 0,
    validProjects: validProjectTitles.length,
    validProjectTitles,
    labeledImages,
    canonicalSections: aggregateRows.length,
    manualExclusionsLoaded: manualExclusions.map(
      (exclusion) => exclusion.canonicalSectionName,
    ),
    sortOrderVarianceVerified: hasSortOrderVariance(aggregateRows),
    dbMutated: options.dbMutated ?? false,
    reproducible: options.reproducible ?? true,
    kept,
    trashed,
    other,
    totalImages: labeledImages + other,
    invalidProjectRowsExcluded: excludedRowsCount,
    sourceDb: options.sourceDb,
  };
  const statsSignature = computeStatsSignature({
    summary: summaryBase,
    aggregateRows,
    sectionProjectRows,
  });
  const summary: Phase0BaselineSummary = {
    ...summaryBase,
    statsSignature,
  };

  return {
    summary,
    aggregateRows,
    sectionProjectRows,
    labeledRows,
    sourceRowsCount: rows.length,
    excludedRowsCount,
  };
}

export async function writePhase0BaselineReports(
  baseline: Phase0Baseline,
  options: WritePhase0BaselineReportsOptions,
): Promise<Phase0ReportPaths> {
  const outputDir = path.resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const reportPaths: Phase0ReportPaths = {
    labeledImagesCsv: path.join(outputDir, "phase0-labeled-images.csv"),
    aggregateCsv: path.join(outputDir, "valid-projects-trash-rate-by-section.csv"),
    sectionProjectCsv: path.join(
      outputDir,
      "valid-projects-trash-rate-by-section-project.csv",
    ),
    markdown: path.join(outputDir, "valid-projects-trash-rate-by-section.md"),
    summaryJson: path.join(outputDir, SUMMARY_JSON_NAME),
  };

  baseline.summary.reportPaths = reportPaths;
  const verification = verifyPhase0Baseline(baseline.summary);
  baseline.summary.pass = verification.pass;
  baseline.summary.failedCriteria = verification.failedCriteria;

  await writeFile(
    reportPaths.labeledImagesCsv,
    serializeLabeledImagesCsv(baseline.labeledRows),
    "utf8",
  );
  await writeFile(
    reportPaths.aggregateCsv,
    serializeAggregateCsv(baseline.aggregateRows),
    "utf8",
  );
  await writeFile(
    reportPaths.sectionProjectCsv,
    serializeSectionProjectCsv(baseline.sectionProjectRows),
    "utf8",
  );
  await writeFile(
    reportPaths.markdown,
    serializeMarkdownReport(baseline, verification),
    "utf8",
  );
  await writeFile(
    reportPaths.summaryJson,
    `${JSON.stringify(serializeSummaryJson(baseline, verification), null, 2)}\n`,
    "utf8",
  );

  return reportPaths;
}

export function verifyPhase0Baseline(
  summary: Phase0BaselineSummary | Record<string, unknown>,
): Phase0VerificationResult {
  const phase = getNumber(summary, "phase", 0);
  const validProjectTitles = getValidProjectTitles(summary);
  const validProjects = getValidProjectCount(summary, validProjectTitles);
  const labeledImages = getNumber(
    summary,
    "labeledImages",
    getNumber(summary, "totalLabeled", 0),
  );
  const canonicalSections = getNumber(summary, "canonicalSections", 0);
  const manualExclusionsLoaded = getManualExclusionNames(summary);
  const sortOrderVarianceVerified = getBoolean(
    summary,
    "sortOrderVarianceVerified",
    false,
  );
  const dbMutated = getBoolean(summary, "dbMutated", false);
  const statsSignature = getString(summary, "statsSignature", "");
  const reproducible =
    getBoolean(summary, "reproducible", false) && hasStatsSignature(statsSignature);

  const failedCriteria: string[] = [];
  if (phase !== 0) {
    failedCriteria.push("phase_0");
  }
  if (!hasExactValidReferenceProjects(validProjects, validProjectTitles)) {
    failedCriteria.push("valid_reference_projects_only");
  }
  if (labeledImages < 1000) {
    failedCriteria.push("labeled_images_min_1000");
  }
  if (!hasRequiredManualExclusions(manualExclusionsLoaded)) {
    failedCriteria.push("manual_exclusions_loaded");
  }
  if (!sortOrderVarianceVerified) {
    failedCriteria.push("sort_order_variance_verified");
  }
  if (dbMutated) {
    failedCriteria.push("db_not_mutated");
  }
  if (!reproducible) {
    failedCriteria.push("reproducible");
  }

  return {
    phase: 0,
    pass: failedCriteria.length === 0,
    validProjects,
    labeledImages,
    canonicalSections,
    manualExclusionsLoaded,
    sortOrderVarianceVerified,
    dbMutated,
    reproducible,
    failedCriteria,
  };
}

export async function createPhase0BaselineFromSqlite(
  options: CreatePhase0BaselineFromSqliteOptions = {},
): Promise<Phase0Baseline> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const dbPath = path.resolve(
    projectRoot,
    options.dbPath ?? path.join("prisma", "data", "comfyui.db"),
  );
  const exclusionPath = path.resolve(
    projectRoot,
    options.exclusionPath ??
      path.join(
        "docs",
        "plans",
        "auto-review-analysis",
        "reference-section-exclusions.json",
      ),
  );
  const before = await stat(dbPath);
  const manualExclusions = await loadManualExclusions(exclusionPath);
  const rows = await readPhase0RowsFromSqlite(dbPath, VALID_REFERENCE_PROJECT_TITLES, {
    sqliteBackend: options.sqliteBackend,
  });
  const after = await stat(dbPath);
  const dbMutated = before.size !== after.size || before.mtimeMs !== after.mtimeMs;
  const aggregationOptions: Phase0AggregationOptions = {
    manualExclusions,
    dbMutated,
    reproducible: true,
    sourceDb: dbPath,
  };
  const baseline = aggregatePhase0Baseline(rows, aggregationOptions);
  const repeatedBaseline = aggregatePhase0Baseline(rows, aggregationOptions);
  const reproducible =
    hasStatsSignature(baseline.summary.statsSignature) &&
    baseline.summary.statsSignature === repeatedBaseline.summary.statsSignature;

  if (reproducible) return baseline;

  return aggregatePhase0Baseline(rows, {
    ...aggregationOptions,
    reproducible: false,
  });
}

export async function readPhase0RowsFromSqlite(
  dbPath: string,
  validProjectTitles: readonly string[] = VALID_REFERENCE_PROJECT_TITLES,
  options: ReadPhase0RowsFromSqliteOptions = {},
): Promise<Phase0SourceRow[]> {
  const backend = options.sqliteBackend ?? "auto";

  if (backend === "node:sqlite") {
    return readPhase0RowsWithNodeSqlite(dbPath, validProjectTitles);
  }

  if (backend === "better-sqlite3") {
    return readPhase0RowsWithBetterSqlite(dbPath, validProjectTitles);
  }

  try {
    return await readPhase0RowsWithBetterSqlite(dbPath, validProjectTitles);
  } catch (error) {
    if (!isBetterSqliteNativeBindingError(error)) {
      throw error;
    }
    return readPhase0RowsWithNodeSqlite(dbPath, validProjectTitles);
  }
}

async function readPhase0RowsWithBetterSqlite(
  dbPath: string,
  validProjectTitles: readonly string[],
): Promise<Phase0SourceRow[]> {
  const Database = await loadBetterSqliteConstructor();
  const resolvedDbPath = path.resolve(dbPath);
  const db = new Database(resolvedDbPath, { readonly: true, fileMustExist: true });

  try {
    db.pragma("query_only = ON");
    return readPhase0RowsFromPreparedReader(db, validProjectTitles);
  } finally {
    db.close();
  }
}

async function readPhase0RowsWithNodeSqlite(
  dbPath: string,
  validProjectTitles: readonly string[],
): Promise<Phase0SourceRow[]> {
  const { DatabaseSync } = await loadNodeSqliteModule();
  const resolvedDbPath = path.resolve(dbPath);
  const db = new DatabaseSync(resolvedDbPath, { readOnly: true });

  try {
    db.exec("pragma query_only = ON");
    return readPhase0RowsFromPreparedReader(db, validProjectTitles);
  } finally {
    db.close();
  }
}

async function loadBetterSqliteConstructor(): Promise<BetterSqliteConstructor> {
  const betterSqliteModule = (await import("better-sqlite3")) as unknown as {
    default?: BetterSqliteConstructor;
  } & BetterSqliteConstructor;
  return betterSqliteModule.default ?? betterSqliteModule;
}

async function loadNodeSqliteModule(): Promise<NodeSqliteModule> {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    if (args[0] === "ExperimentalWarning" && String(warning).includes("SQLite")) {
      return process;
    }
    return (originalEmitWarning as (...warningArgs: unknown[]) => NodeJS.Process)(
      warning,
      ...args,
    );
  }) as typeof process.emitWarning;

  try {
    const nodeSqliteSpecifier = "node:sqlite";
    return (await import(nodeSqliteSpecifier)) as unknown as NodeSqliteModule;
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

function readPhase0RowsFromPreparedReader(
  db: { prepare(sql: string): SqliteStatementReader },
  validProjectTitles: readonly string[],
): Phase0SourceRow[] {
  return (db.prepare(buildPhase0RowsSql(validProjectTitles)).all(
    ...validProjectTitles,
  ) as SqliteBaselineRow[]).map(mapSqliteRow);
}

function buildPhase0RowsSql(validProjectTitles: readonly string[]): string {
  const placeholders = validProjectTitles.map(() => "?").join(", ");
  const projectOrderCase = validProjectTitles
    .map((title, index) => `when ${sqlStringLiteral(title)} then ${index}`)
    .join(" ");

  return `
    select
      p.id as projectId,
      p.title as projectTitle,
      s.id as sectionId,
      coalesce(s.name, '') as sectionName,
      s.sortOrder as sortOrder,
      r.id as runId,
      i.id as imageId,
      i.filePath as filePath,
      i.thumbPath as thumbPath,
      i.reviewStatus as reviewStatus,
      coalesce(s.checkpointName, p.checkpointName, '') as checkpointName,
      s.loraConfig as loraConfig,
      r.resolvedConfigSnapshot as resolvedConfigSnapshot
    from ImageResult i
    join Run r on r.id = i.runId
    join Project p on p.id = r.projectId
    join ProjectSection s on s.id = r.projectSectionId
    where p.title in (${placeholders})
    order by
      case p.title ${projectOrderCase} else 999 end asc,
      s.name asc,
      s.sortOrder asc,
      r.createdAt asc,
      r.id asc,
      i.createdAt asc,
      i.id asc
  `;
}

function isBetterSqliteNativeBindingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const nodeError = error as Error & { code?: unknown };
  const code = typeof nodeError.code === "string" ? nodeError.code : "";
  const message = `${error.message}\n${error.stack ?? ""}`;

  return (
    code === "ERR_DLOPEN_FAILED" ||
    /better_sqlite3\.node/i.test(message) ||
    /invalid ELF header/i.test(message) ||
    /wrong ELF class/i.test(message) ||
    /not a valid Win32 application/i.test(message) ||
    /Could not locate the bindings file/i.test(message) ||
    /Cannot find module .*better[-_]sqlite3/i.test(message) ||
    /NODE_MODULE_VERSION/i.test(message) ||
    /was compiled against a different Node\.js version/i.test(message) ||
    /Module did not self-register/i.test(message)
  );
}

export async function loadManualExclusions(
  exclusionPath: string,
): Promise<Phase0ManualExclusion[]> {
  try {
    const content = await readFile(exclusionPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    return normalizeManualExclusions(extractManualExclusions(parsed));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return normalizeManualExclusions();
    }
    throw error;
  }
}

export function getDefaultPhase0OutputDir(projectRoot = process.cwd()): string {
  return path.join(projectRoot, "docs", "plans", "auto-review-analysis");
}

export function getDefaultPhase0SummaryPath(projectRoot = process.cwd()): string {
  return path.join(getDefaultPhase0OutputDir(projectRoot), SUMMARY_JSON_NAME);
}

function normalizeManualExclusions(
  manualExclusions: readonly (string | Phase0ManualExclusion)[] = [],
): Phase0ManualExclusion[] {
  const byName = new Map<string, Phase0ManualExclusion>();
  for (const exclusion of DEFAULT_MANUAL_EXCLUSIONS) {
    byName.set(exclusion.canonicalSectionName, { ...exclusion });
  }
  for (const exclusion of manualExclusions) {
    if (typeof exclusion === "string") {
      const canonicalSectionName = normalizeCanonicalSectionName(exclusion);
      byName.set(canonicalSectionName, {
        ...(byName.get(canonicalSectionName) ?? {}),
        canonicalSectionName,
      });
    } else if (exclusion && exclusion.canonicalSectionName) {
      const canonicalSectionName = normalizeCanonicalSectionName(
        exclusion.canonicalSectionName,
      );
      byName.set(canonicalSectionName, {
        ...(byName.get(canonicalSectionName) ?? {}),
        canonicalSectionName,
        reason: exclusion.reason ?? byName.get(canonicalSectionName)?.reason,
      });
    }
  }

  const defaultNames = new Set<string>(DEFAULT_MANUAL_EXCLUSION_NAMES);
  const defaults = DEFAULT_MANUAL_EXCLUSION_NAMES.map((name) => byName.get(name)).filter(
    (exclusion): exclusion is Phase0ManualExclusion => Boolean(exclusion),
  );
  const extras = [...byName.values()]
    .filter((exclusion) => !defaultNames.has(exclusion.canonicalSectionName))
    .sort((left, right) =>
      compareStrings(left.canonicalSectionName, right.canonicalSectionName),
    );
  return [...defaults, ...extras];
}

function normalizeSourceRow(sourceRow: Phase0SourceRow): NormalizedSourceRow {
  const sectionName = normalizeCanonicalSectionName(sourceRow.sectionName ?? "未命名 section");
  const canonicalSectionName = normalizeCanonicalSectionName(
    sourceRow.canonicalSectionName ?? sectionName,
  );
  return {
    ...sourceRow,
    sectionName,
    canonicalSectionName,
    sortOrder: parseNullableNumber(sourceRow.sortOrder),
    reviewStatus: String(sourceRow.reviewStatus ?? "").trim().toLowerCase(),
    checkpointName: String(sourceRow.checkpointName ?? "").trim(),
    loraConfigSummary: summarizeLoraConfig(sourceRow.loraConfig),
  };
}

function normalizeCanonicalSectionName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function getOrCreateSectionAccumulator(
  sections: Map<string, SectionAccumulator>,
  row: NormalizedSourceRow,
): SectionAccumulator {
  const existing = sections.get(row.canonicalSectionName);
  if (existing) return existing;

  const section: SectionAccumulator = {
    canonicalSectionName: row.canonicalSectionName,
    rows: [],
    projectSections: new Map(),
    projectIds: new Set(),
    projectTitles: new Set(),
    kept: 0,
    trashed: 0,
    other: 0,
  };
  sections.set(row.canonicalSectionName, section);
  return section;
}

function getOrCreateSectionProjectAccumulator(
  section: SectionAccumulator,
  row: NormalizedSourceRow,
): SectionProjectAccumulator {
  const key = `${row.projectId}\u0000${row.sectionId}`;
  const existing = section.projectSections.get(key);
  if (existing) return existing;

  const sectionProject: SectionProjectAccumulator = {
    canonicalSectionName: row.canonicalSectionName,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sortOrder: row.sortOrder,
    kept: 0,
    trashed: 0,
    other: 0,
    checkpointNames: new Set(),
    loraConfigSummaries: new Set(),
  };
  section.projectSections.set(key, sectionProject);
  return sectionProject;
}

function buildFlags(input: {
  canonicalSectionName: string;
  labeled: number;
  projectCoverage: number;
  other: number;
  manualExclusionByName: Map<string, string>;
  lowSampleThreshold: number;
  lowProjectCoverageThreshold: number;
}): Phase0Flag[] {
  const flags = new Set<Phase0Flag>();
  if (input.manualExclusionByName.has(input.canonicalSectionName)) {
    flags.add("manual_excluded");
  }
  if (input.labeled < input.lowSampleThreshold) {
    flags.add("low_sample_lt20");
  }
  if (input.projectCoverage < input.lowProjectCoverageThreshold) {
    flags.add("low_project_coverage_lt5");
  }
  if (input.other > 0) {
    flags.add("has_unreviewed");
  }
  return FLAG_ORDER.filter((flag) => flags.has(flag));
}

function hasSortOrderVariance(aggregateRows: readonly Phase0AggregateRow[]): boolean {
  return aggregateRows.some((row) => {
    const sortOrders = new Set(
      row.projectPositions
        .map((position) => position.sortOrder)
        .filter((sortOrder): sortOrder is number => typeof sortOrder === "number"),
    );
    return row.projectPositions.length >= 2 && sortOrders.size >= 2;
  });
}

function compareAggregateRows(left: Phase0AggregateRow, right: Phase0AggregateRow): number {
  return (
    right.trashRate - left.trashRate ||
    right.labeled - left.labeled ||
    compareStrings(left.canonicalSectionName, right.canonicalSectionName)
  );
}

function compareByAggregateThenProject(
  left: Phase0SectionProjectRow,
  right: Phase0SectionProjectRow,
  aggregateSortOrder: Map<string, number>,
  titleOrder: Map<string, number>,
): number {
  return (
    (aggregateSortOrder.get(left.canonicalSectionName) ?? Number.MAX_SAFE_INTEGER) -
      (aggregateSortOrder.get(right.canonicalSectionName) ?? Number.MAX_SAFE_INTEGER) ||
    projectTitleIndex(left.projectTitle, titleOrder) -
      projectTitleIndex(right.projectTitle, titleOrder) ||
    compareNullableNumbers(left.sortOrder, right.sortOrder) ||
    compareStrings(left.sectionId, right.sectionId)
  );
}

function compareProjectPositions(
  left: Phase0ProjectPosition,
  right: Phase0ProjectPosition,
  titleOrder: Map<string, number>,
): number {
  return (
    projectTitleIndex(left.projectTitle, titleOrder) -
      projectTitleIndex(right.projectTitle, titleOrder) ||
    compareNullableNumbers(left.sortOrder, right.sortOrder) ||
    compareStrings(left.sectionId, right.sectionId)
  );
}

function compareLabeledRows(
  left: Phase0LabeledImageRow,
  right: Phase0LabeledImageRow,
  aggregateSortOrder: Map<string, number>,
  titleOrder: Map<string, number>,
): number {
  return (
    projectTitleIndex(left.projectTitle, titleOrder) -
      projectTitleIndex(right.projectTitle, titleOrder) ||
    (aggregateSortOrder.get(left.canonicalSectionName) ?? Number.MAX_SAFE_INTEGER) -
      (aggregateSortOrder.get(right.canonicalSectionName) ?? Number.MAX_SAFE_INTEGER) ||
    compareNullableNumbers(left.sortOrder, right.sortOrder) ||
    compareStrings(left.runId, right.runId) ||
    compareStrings(left.imageId, right.imageId)
  );
}

function projectTitleIndex(projectTitle: string, titleOrder: Map<string, number>): number {
  return titleOrder.get(projectTitle) ?? Number.MAX_SAFE_INTEGER;
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function formatPositions(projectPositions: readonly Phase0ProjectPosition[]): string {
  return projectPositions
    .map((position) => `${position.projectTitle}:${position.sortOrder ?? ""}`)
    .join(",");
}

function serializeLabeledImagesCsv(rows: readonly Phase0LabeledImageRow[]): string {
  return serializeCsv(
    [
      "projectId",
      "projectTitle",
      "sectionId",
      "sectionName",
      "canonicalSectionName",
      "sortOrder",
      "runId",
      "imageId",
      "filePath",
      "thumbPath",
      "reviewStatus",
      "checkpointName",
      "loraConfigSummary",
      "sourceFlags",
    ],
    rows.map((row) => [
      row.projectId,
      row.projectTitle,
      row.sectionId,
      row.sectionName,
      row.canonicalSectionName,
      row.sortOrder,
      row.runId,
      row.imageId,
      row.filePath,
      row.thumbPath,
      row.reviewStatus,
      row.checkpointName,
      row.loraConfigSummary,
      row.sourceFlags,
    ]),
  );
}

function serializeAggregateCsv(rows: readonly Phase0AggregateRow[]): string {
  return serializeCsv(
    [
      "canonicalSectionName",
      "projectCoverage",
      "labeled",
      "kept",
      "trashed",
      "trashRate",
      "keepRate",
      "other",
      "totalImages",
      "positions",
      "flags",
      "manualExclusionReason",
    ],
    rows.map((row) => [
      row.canonicalSectionName,
      row.projectCoverage,
      row.labeled,
      row.kept,
      row.trashed,
      row.trashRate,
      row.keepRate,
      row.other,
      row.totalImages,
      row.positions,
      row.flags.join(";"),
      row.manualExclusionReason,
    ]),
  );
}

function serializeSectionProjectCsv(rows: readonly Phase0SectionProjectRow[]): string {
  return serializeCsv(
    [
      "canonicalSectionName",
      "projectId",
      "projectTitle",
      "sectionId",
      "sectionName",
      "sortOrder",
      "labeled",
      "kept",
      "trashed",
      "trashRate",
      "keepRate",
      "other",
      "totalImages",
      "flags",
      "checkpointNames",
      "loraConfigSummaries",
    ],
    rows.map((row) => [
      row.canonicalSectionName,
      row.projectId,
      row.projectTitle,
      row.sectionId,
      row.sectionName,
      row.sortOrder,
      row.labeled,
      row.kept,
      row.trashed,
      row.trashRate,
      row.keepRate,
      row.other,
      row.totalImages,
      row.flags.join(";"),
      row.checkpointNames.join(";"),
      row.loraConfigSummaries.join(";"),
    ]),
  );
}

function serializeMarkdownReport(
  baseline: Phase0Baseline,
  verification: Phase0VerificationResult,
): string {
  const lines: string[] = [
    "## Phase 0 historical baseline",
    "",
    `- Pass: ${verification.pass ? "true" : "false"}`,
    `- Valid projects: ${baseline.summary.validProjects} (${baseline.summary.validProjectTitles.join(", ")})`,
    `- Labeled images: ${baseline.summary.labeledImages}`,
    `- Canonical sections: ${baseline.summary.canonicalSections}`,
    `- Manual exclusions loaded: ${baseline.summary.manualExclusionsLoaded.join(", ")}`,
    `- Sort-order variance verified: ${baseline.summary.sortOrderVarianceVerified}`,
    `- DB mutated: ${baseline.summary.dbMutated}`,
    `- Reproducible: ${baseline.summary.reproducible}`,
    "",
    "### Acceptance verification",
    "",
    "| Criterion | Status |",
    "| --- | --- |",
    `| valid_reference_projects_only | ${verification.failedCriteria.includes("valid_reference_projects_only") ? "FAIL" : "PASS"} |`,
    `| labeled_images_min_1000 | ${verification.failedCriteria.includes("labeled_images_min_1000") ? "FAIL" : "PASS"} |`,
    `| manual_exclusions_loaded | ${verification.failedCriteria.includes("manual_exclusions_loaded") ? "FAIL" : "PASS"} |`,
    `| sort_order_variance_verified | ${verification.failedCriteria.includes("sort_order_variance_verified") ? "FAIL" : "PASS"} |`,
    `| db_not_mutated | ${verification.failedCriteria.includes("db_not_mutated") ? "FAIL" : "PASS"} |`,
    `| reproducible | ${verification.failedCriteria.includes("reproducible") ? "FAIL" : "PASS"} |`,
    "",
    "### Trash rate by canonical section",
    "",
    "| canonicalSectionName | projectCoverage | labeled | kept | trashed | trashRate | keepRate | flags | positions |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  ];

  for (const row of baseline.aggregateRows) {
    lines.push(
      `| ${escapeMarkdownTableCell(row.canonicalSectionName)} | ${row.projectCoverage} | ${row.labeled} | ${row.kept} | ${row.trashed} | ${row.trashRate} | ${row.keepRate} | ${escapeMarkdownTableCell(row.flags.join(";"))} | ${escapeMarkdownTableCell(row.positions)} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function serializeSummaryJson(
  baseline: Phase0Baseline,
  verification: Phase0VerificationResult,
): Record<string, unknown> {
  return {
    phase: 0,
    pass: verification.pass,
    validProjects: baseline.summary.validProjects,
    validProjectTitles: baseline.summary.validProjectTitles,
    labeledImages: baseline.summary.labeledImages,
    totalLabeled: baseline.summary.labeledImages,
    canonicalSections: baseline.summary.canonicalSections,
    manualExclusionsLoaded: baseline.summary.manualExclusionsLoaded,
    sortOrderVarianceVerified: baseline.summary.sortOrderVarianceVerified,
    dbMutated: baseline.summary.dbMutated,
    reproducible: baseline.summary.reproducible,
    failedCriteria: verification.failedCriteria,
    kept: baseline.summary.kept,
    trashed: baseline.summary.trashed,
    other: baseline.summary.other,
    totalImages: baseline.summary.totalImages,
    invalidProjectRowsExcluded: baseline.summary.invalidProjectRowsExcluded,
    statsSignature: baseline.summary.statsSignature,
    sourceDb: baseline.summary.sourceDb,
    reportPaths: baseline.summary.reportPaths,
    top20Raw: baseline.aggregateRows.slice(0, 20),
  };
}

function computeStatsSignature(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function summarizeLoraConfig(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = typeof value === "string" ? parseJson(value, value) : value;
  if (typeof parsed === "string") return parsed.trim();
  return stableStringify(parsed);
}

function mapSqliteRow(row: SqliteBaselineRow): Phase0SourceRow {
  const snapshot = parseJson(row.resolvedConfigSnapshot, {}) as Record<string, unknown>;
  const snapshotCheckpoint = textFromUnknown(snapshot.checkpointName);
  const snapshotLoraConfig = snapshot.loraConfig ?? snapshot.loras ?? snapshot.lora;

  return {
    projectId: textFromUnknown(row.projectId),
    projectTitle: textFromUnknown(row.projectTitle),
    sectionId: textFromUnknown(row.sectionId),
    sectionName: textFromUnknown(row.sectionName),
    sortOrder: parseNullableNumber(row.sortOrder),
    runId: textFromUnknown(row.runId),
    imageId: textFromUnknown(row.imageId),
    filePath: textFromUnknown(row.filePath),
    thumbPath: textFromUnknown(row.thumbPath),
    reviewStatus: textFromUnknown(row.reviewStatus),
    checkpointName: textFromUnknown(row.checkpointName) || snapshotCheckpoint,
    loraConfig: row.loraConfig ?? snapshotLoraConfig,
  };
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

function textFromUnknown(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function extractManualExclusions(parsed: unknown): (string | Phase0ManualExclusion)[] {
  if (Array.isArray(parsed)) {
    return parsed as (string | Phase0ManualExclusion)[];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const object = parsed as Record<string, unknown>;
  if (Array.isArray(object.excludedCanonicalSections)) {
    return object.excludedCanonicalSections as (string | Phase0ManualExclusion)[];
  }
  if (Array.isArray(object.manualExclusions)) {
    return object.manualExclusions as (string | Phase0ManualExclusion)[];
  }
  if (Array.isArray(object.manualExclusionsLoaded)) {
    return object.manualExclusionsLoaded as string[];
  }
  return [];
}

function getNumber(
  summary: Phase0BaselineSummary | Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = (summary as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getBoolean(
  summary: Phase0BaselineSummary | Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = (summary as Record<string, unknown>)[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function getString(
  summary: Phase0BaselineSummary | Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = (summary as Record<string, unknown>)[key];
  if (typeof value === "string") return value;
  return fallback;
}

function hasStatsSignature(statsSignature: unknown): boolean {
  return typeof statsSignature === "string" && statsSignature.trim().length > 0;
}

function getValidProjectTitles(
  summary: Phase0BaselineSummary | Record<string, unknown>,
): string[] {
  const object = summary as Record<string, unknown>;
  if (Array.isArray(object.validProjectTitles)) {
    return object.validProjectTitles.map(String);
  }
  if (Array.isArray(object.validProjects)) {
    return object.validProjects.map(String);
  }
  return [];
}

function getValidProjectCount(
  summary: Phase0BaselineSummary | Record<string, unknown>,
  validProjectTitles: readonly string[],
): number {
  const object = summary as Record<string, unknown>;
  if (typeof object.validProjects === "number") return object.validProjects;
  if (Array.isArray(object.validProjects)) return object.validProjects.length;
  return validProjectTitles.length;
}

function getManualExclusionNames(
  summary: Phase0BaselineSummary | Record<string, unknown>,
): string[] {
  const object = summary as Record<string, unknown>;
  if (Array.isArray(object.manualExclusionsLoaded)) {
    return object.manualExclusionsLoaded.map(String);
  }
  if (Array.isArray(object.manualExclusions)) {
    return object.manualExclusions
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          return String(
            (entry as Record<string, unknown>).canonicalSectionName ?? "",
          );
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function hasExactValidReferenceProjects(
  validProjects: number,
  validProjectTitles: readonly string[],
): boolean {
  return (
    validProjects === VALID_REFERENCE_PROJECT_TITLES.length &&
    validProjectTitles.length === VALID_REFERENCE_PROJECT_TITLES.length &&
    VALID_REFERENCE_PROJECT_TITLES.every(
      (title, index) => validProjectTitles[index] === title,
    )
  );
}

function hasRequiredManualExclusions(manualExclusionsLoaded: readonly string[]): boolean {
  const loaded = new Set(manualExclusionsLoaded);
  return DEFAULT_MANUAL_EXCLUSION_NAMES.every((name) => loaded.has(name));
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
