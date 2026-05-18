import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  aggregatePhase0Baseline,
  DEFAULT_MANUAL_EXCLUSION_NAMES,
  readPhase0RowsFromSqlite,
  VALID_REFERENCE_PROJECT_TITLES,
  verifyPhase0Baseline,
  writePhase0BaselineReports,
  type Phase0BaselineSummary,
  type Phase0SourceRow,
} from "./src/server/quality/phase0-baseline";
import {
  parseVerifyArgs,
  verifyPhase0BaselineSummaryFile,
} from "./scripts/quality/verify";

function sourceRow(overrides: Partial<Phase0SourceRow>): Phase0SourceRow {
  return {
    projectId: "project-1",
    projectTitle: "叶瞬光",
    sectionId: "section-1",
    sectionName: "单人 · 背手站立",
    sortOrder: 1,
    runId: "run-1",
    imageId: "image-1",
    filePath: "/images/image-1.png",
    thumbPath: "/images/thumbs/image-1.webp",
    reviewStatus: "kept",
    checkpointName: "checkpoint-a.safetensors",
    loraConfig: { lora1: [{ name: "lora-a", strength: 0.8 }] },
    ...overrides,
  };
}

function validSummary(overrides: Partial<Phase0BaselineSummary> = {}): Phase0BaselineSummary {
  return {
    phase: 0,
    validProjects: VALID_REFERENCE_PROJECT_TITLES.length,
    validProjectTitles: [...VALID_REFERENCE_PROJECT_TITLES],
    labeledImages: 1000,
    canonicalSections: 68,
    manualExclusionsLoaded: [...DEFAULT_MANUAL_EXCLUSION_NAMES],
    sortOrderVarianceVerified: true,
    dbMutated: false,
    reproducible: true,
    aggregateRows: [],
    sectionProjectRows: [],
    labeledRows: [],
    reportPaths: {},
    statsSignature: "test-signature",
    ...overrides,
  };
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
  };
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (filename: string, options?: Record<string, unknown>) => NodeSqliteDatabase;
}

async function loadNodeSqliteForTest(): Promise<NodeSqliteModule> {
  const nodeSqlite = await tryLoadNodeSqliteForTest();
  if (!nodeSqlite) {
    throw new Error("node:sqlite is unavailable in this Node.js runtime");
  }
  return nodeSqlite;
}

async function tryLoadNodeSqliteForTest(): Promise<NodeSqliteModule | null> {
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
  } catch (error) {
    if (isNodeSqliteUnavailable(error)) return null;
    throw error;
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

function isNodeSqliteUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const nodeError = error as Error & { code?: unknown };
  return (
    nodeError.code === "ERR_UNKNOWN_BUILTIN_MODULE" ||
    /No such built-in module: node:sqlite/i.test(error.message) ||
    /Cannot find module 'node:sqlite'/i.test(error.message)
  );
}

async function createPhase0SqliteFixture(
  dbPath: string,
  nodeSqlite?: NodeSqliteModule,
): Promise<void> {
  const { DatabaseSync } = nodeSqlite ?? (await loadNodeSqliteForTest());
  const db = new DatabaseSync(dbPath);

  try {
    db.exec(`
      create table Project (
        id text primary key,
        title text not null,
        checkpointName text
      );
      create table ProjectSection (
        id text primary key,
        projectId text not null,
        name text,
        sortOrder integer,
        checkpointName text,
        loraConfig text
      );
      create table Run (
        id text primary key,
        projectId text not null,
        projectSectionId text not null,
        resolvedConfigSnapshot text,
        createdAt text
      );
      create table ImageResult (
        id text primary key,
        runId text not null,
        filePath text not null,
        thumbPath text,
        reviewStatus text,
        createdAt text
      );
    `);

    db.prepare(
      `insert into Project (id, title, checkpointName) values (?, ?, ?)`,
    ).run("project-valid", "叶瞬光", "project-checkpoint.safetensors");
    db.prepare(
      `insert into ProjectSection (id, projectId, name, sortOrder, checkpointName, loraConfig)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(
      "section-valid",
      "project-valid",
      "单人 · 背手站立",
      7,
      "section-checkpoint.safetensors",
      JSON.stringify({ lora1: [{ name: "sqlite-lora", strength: 0.5 }] }),
    );
    db.prepare(
      `insert into Run (id, projectId, projectSectionId, resolvedConfigSnapshot, createdAt)
       values (?, ?, ?, ?, ?)`,
    ).run(
      "run-valid",
      "project-valid",
      "section-valid",
      JSON.stringify({ checkpointName: "snapshot-checkpoint.safetensors" }),
      "2026-01-01T00:00:00.000Z",
    );
    db.prepare(
      `insert into ImageResult (id, runId, filePath, thumbPath, reviewStatus, createdAt)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(
      "image-kept",
      "run-valid",
      "/images/image-kept.png",
      "/images/thumbs/image-kept.webp",
      "kept",
      "2026-01-01T00:00:01.000Z",
    );
    db.prepare(
      `insert into ImageResult (id, runId, filePath, thumbPath, reviewStatus, createdAt)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(
      "image-trashed",
      "run-valid",
      "/images/image-trashed.png",
      "/images/thumbs/image-trashed.webp",
      "trashed",
      "2026-01-01T00:00:02.000Z",
    );

    db.prepare(
      `insert into Project (id, title, checkpointName) values (?, ?, ?)`,
    ).run("project-ignored", "无效项目", "ignored-checkpoint.safetensors");
    db.prepare(
      `insert into ProjectSection (id, projectId, name, sortOrder, checkpointName, loraConfig)
       values (?, ?, ?, ?, ?, ?)`,
    ).run("section-ignored", "project-ignored", "单人 · 背手站立", 99, null, null);
    db.prepare(
      `insert into Run (id, projectId, projectSectionId, resolvedConfigSnapshot, createdAt)
       values (?, ?, ?, ?, ?)`,
    ).run("run-ignored", "project-ignored", "section-ignored", null, "2026-01-01T00:00:00.000Z");
    db.prepare(
      `insert into ImageResult (id, runId, filePath, thumbPath, reviewStatus, createdAt)
       values (?, ?, ?, ?, ?, ?)`,
    ).run("image-ignored", "run-ignored", "/images/ignored.png", null, "kept", "2026-01-01T00:00:03.000Z");
  } finally {
    db.close();
  }
}

test("readPhase0RowsFromSqlite can use node:sqlite and auto fallback for aggregation", async (t) => {
  const nodeSqlite = await tryLoadNodeSqliteForTest();
  if (!nodeSqlite) {
    t.skip("node:sqlite is unavailable in this Node.js runtime");
    return;
  }

  const outputDir = await mkdtemp(path.join(tmpdir(), "phase0-sqlite-"));
  try {
    const dbPath = path.join(outputDir, "phase0-fixture.db");
    await createPhase0SqliteFixture(dbPath, nodeSqlite);

    const rows = await readPhase0RowsFromSqlite(dbPath, VALID_REFERENCE_PROJECT_TITLES, {
      sqliteBackend: "node:sqlite",
    });

    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.imageId),
      ["image-kept", "image-trashed"],
    );

    const autoRows = await readPhase0RowsFromSqlite(dbPath, VALID_REFERENCE_PROJECT_TITLES);
    assert.deepEqual(autoRows, rows);

    assert.equal(rows[0].projectTitle, "叶瞬光");
    assert.equal(rows[0].sectionName, "单人 · 背手站立");
    assert.equal(rows[0].sortOrder, 7);
    assert.equal(rows[0].checkpointName, "section-checkpoint.safetensors");
    assert.match(String(rows[0].loraConfig), /sqlite-lora/);

    const baseline = aggregatePhase0Baseline(rows, {
      lowSampleThreshold: 1,
      lowProjectCoverageThreshold: 1,
    });
    assert.equal(baseline.summary.labeledImages, 2);
    assert.equal(baseline.summary.kept, 1);
    assert.equal(baseline.summary.trashed, 1);
    assert.equal(baseline.aggregateRows.length, 1);
    assert.equal(baseline.aggregateRows[0].canonicalSectionName, "单人 · 背手站立");
    assert.deepEqual(baseline.sectionProjectRows[0].checkpointNames, [
      "section-checkpoint.safetensors",
    ]);
    assert.match(baseline.sectionProjectRows[0].loraConfigSummaries[0], /sqlite-lora/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("aggregatePhase0Baseline groups by canonical section name, not sortOrder", () => {
  const baseline = aggregatePhase0Baseline([
    sourceRow({
      projectId: "project-a",
      projectTitle: "叶瞬光",
      sectionId: "section-a",
      sectionName: "单人 · 背手站立",
      sortOrder: 1,
      imageId: "image-a",
      reviewStatus: "kept",
    }),
    sourceRow({
      projectId: "project-b",
      projectTitle: "大乔",
      sectionId: "section-b",
      sectionName: "单人 · 背手站立",
      sortOrder: 9,
      imageId: "image-b",
      reviewStatus: "trashed",
    }),
    sourceRow({
      projectId: "project-x",
      projectTitle: "无效项目",
      sectionId: "section-x",
      sectionName: "单人 · 背手站立",
      sortOrder: 1,
      imageId: "image-x",
      reviewStatus: "trashed",
    }),
  ]);

  assert.equal(baseline.aggregateRows.length, 1);
  const row = baseline.aggregateRows[0];
  assert.equal(row.canonicalSectionName, "单人 · 背手站立");
  assert.equal(row.projectCoverage, 2);
  assert.equal(row.labeled, 2);
  assert.equal(row.kept, 1);
  assert.equal(row.trashed, 1);
  assert.equal(row.trashRate, 0.5);
  assert.deepEqual(
    row.projectPositions.map((position) => [position.projectTitle, position.sortOrder]),
    [
      ["叶瞬光", 1],
      ["大乔", 9],
    ],
  );
  assert.equal(baseline.summary.sortOrderVarianceVerified, true);
});

test("aggregatePhase0Baseline marks manual exclusions and low-reference flags", () => {
  const baseline = aggregatePhase0Baseline([
    sourceRow({
      projectId: "project-a",
      projectTitle: "叶瞬光",
      sectionId: "section-a",
      sectionName: "单人 · 拎鞋",
      sortOrder: 20,
      imageId: "image-a",
      reviewStatus: "kept",
    }),
    sourceRow({
      projectId: "project-a",
      projectTitle: "叶瞬光",
      sectionId: "section-a",
      sectionName: "单人 · 拎鞋",
      sortOrder: 20,
      imageId: "image-pending",
      reviewStatus: "pending",
    }),
  ]);

  const row = baseline.aggregateRows.find(
    (aggregateRow) => aggregateRow.canonicalSectionName === "单人 · 拎鞋",
  );
  assert.ok(row);
  assert.deepEqual(row.flags, [
    "manual_excluded",
    "low_sample_lt20",
    "low_project_coverage_lt5",
    "has_unreviewed",
  ]);
  assert.equal(row.manualExclusionReason.length > 0, true);

  assert.equal(baseline.labeledRows.length, 1);
  assert.equal(
    baseline.labeledRows[0].sourceFlags,
    "manual_excluded;low_sample_lt20;low_project_coverage_lt5;has_unreviewed",
  );
});

test("verifyPhase0Baseline enforces hard Phase 0 acceptance criteria", () => {
  assert.deepEqual(verifyPhase0Baseline(validSummary()).failedCriteria, []);
  assert.equal(verifyPhase0Baseline(validSummary()).pass, true);

  const invalid = verifyPhase0Baseline(
    validSummary({
      validProjects: 6,
      validProjectTitles: VALID_REFERENCE_PROJECT_TITLES.slice(0, 6),
      labeledImages: 999,
      manualExclusionsLoaded: [DEFAULT_MANUAL_EXCLUSION_NAMES[0]],
      sortOrderVarianceVerified: false,
      dbMutated: true,
      reproducible: false,
    }),
  );

  assert.equal(invalid.pass, false);
  assert.deepEqual(invalid.failedCriteria, [
    "valid_reference_projects_only",
    "labeled_images_min_1000",
    "manual_exclusions_loaded",
    "sort_order_variance_verified",
    "db_not_mutated",
    "reproducible",
  ]);
});

test("verifyPhase0Baseline requires exact valid reference project titles", () => {
  const missingTitlesSummary = { ...validSummary() } as Record<string, unknown>;
  delete missingTitlesSummary.validProjectTitles;

  const missingTitles = verifyPhase0Baseline(missingTitlesSummary);
  assert.equal(missingTitles.pass, false);
  assert.deepEqual(missingTitles.failedCriteria, ["valid_reference_projects_only"]);

  const emptyTitles = verifyPhase0Baseline(validSummary({ validProjectTitles: [] }));
  assert.equal(emptyTitles.pass, false);
  assert.deepEqual(emptyTitles.failedCriteria, ["valid_reference_projects_only"]);
});

test("verifyPhase0Baseline requires a stats signature for reproducibility", () => {
  const missingSignatureSummary = { ...validSummary() } as Record<string, unknown>;
  delete missingSignatureSummary.statsSignature;

  const missingSignature = verifyPhase0Baseline(missingSignatureSummary);
  assert.equal(missingSignature.pass, false);
  assert.equal(missingSignature.reproducible, false);
  assert.deepEqual(missingSignature.failedCriteria, ["reproducible"]);

  const emptySignature = verifyPhase0Baseline(validSummary({ statsSignature: "  " }));
  assert.equal(emptySignature.pass, false);
  assert.equal(emptySignature.reproducible, false);
  assert.deepEqual(emptySignature.failedCriteria, ["reproducible"]);
});

test("writePhase0BaselineReports writes deterministic CSV, Markdown, and summary JSON", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase0-baseline-"));
  try {
    const baseline = aggregatePhase0Baseline([
      sourceRow({
        projectId: "project-a",
        projectTitle: "叶瞬光",
        sectionId: "section-a",
        sectionName: "单人 · 拎鞋",
        sortOrder: 20,
        imageId: "image-a",
        reviewStatus: "trashed",
      }),
      sourceRow({
        projectId: "project-b",
        projectTitle: "大乔",
        sectionId: "section-b",
        sectionName: "单人 · 背手站立",
        sortOrder: 1,
        imageId: "image-b",
        reviewStatus: "kept",
      }),
    ]);

    const reportPaths = await writePhase0BaselineReports(baseline, { outputDir });

    assert.deepEqual(Object.keys(reportPaths).sort(), [
      "aggregateCsv",
      "labeledImagesCsv",
      "markdown",
      "sectionProjectCsv",
      "summaryJson",
    ]);

    const aggregateCsv = await readFile(reportPaths.aggregateCsv, "utf8");
    const labeledCsv = await readFile(reportPaths.labeledImagesCsv, "utf8");
    const markdown = await readFile(reportPaths.markdown, "utf8");
    const summaryJson = JSON.parse(await readFile(reportPaths.summaryJson, "utf8"));

    assert.match(aggregateCsv, /canonicalSectionName,projectCoverage,labeled,kept,trashed/);
    assert.match(aggregateCsv, /单人 · 拎鞋/);
    assert.match(labeledCsv, /projectId,projectTitle,sectionId,sectionName,canonicalSectionName,sortOrder,runId,imageId,filePath,thumbPath,reviewStatus,checkpointName,loraConfigSummary,sourceFlags/);
    assert.match(labeledCsv, /manual_excluded/);
    assert.match(markdown, /## Phase 0 historical baseline/);
    assert.match(markdown, /单人 · 拎鞋/);
    assert.equal(summaryJson.phase, 0);
    assert.equal(summaryJson.validProjects, 7);
    assert.deepEqual(summaryJson.manualExclusionsLoaded, DEFAULT_MANUAL_EXCLUSION_NAMES);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("writePhase0BaselineReports escapes spreadsheet formula-leading CSV cells", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase0-csv-escape-"));
  try {
    const baseline = aggregatePhase0Baseline([
      sourceRow({
        projectId: "=project-a",
        projectTitle: "叶瞬光",
        sectionId: "+section-a",
        sectionName: "=cmd",
        runId: "-run-a",
        imageId: "@image-a",
        filePath: "=images/image-a.png",
        thumbPath: "+thumbs/image-a.webp",
        checkpointName: "-checkpoint.safetensors",
        loraConfig: "@lora-a:0.8",
      }),
    ]);

    const reportPaths = await writePhase0BaselineReports(baseline, { outputDir });
    const aggregateCsv = await readFile(reportPaths.aggregateCsv, "utf8");
    const labeledCsv = await readFile(reportPaths.labeledImagesCsv, "utf8");
    const sectionProjectCsv = await readFile(reportPaths.sectionProjectCsv, "utf8");

    assert.match(aggregateCsv, /'\=cmd/);
    assert.match(labeledCsv, /'\=project-a/);
    assert.match(labeledCsv, /'\+section-a/);
    assert.match(labeledCsv, /'\=cmd/);
    assert.match(labeledCsv, /'\-run-a/);
    assert.match(labeledCsv, /'@image-a/);
    assert.match(labeledCsv, /'\=images\/image-a\.png/);
    assert.match(labeledCsv, /'\+thumbs\/image-a\.webp/);
    assert.match(labeledCsv, /'\-checkpoint\.safetensors/);
    assert.match(labeledCsv, /'@lora-a:0\.8/);
    assert.match(sectionProjectCsv, /'\=project-a/);
    assert.match(sectionProjectCsv, /'\+section-a/);
    assert.match(sectionProjectCsv, /'\-checkpoint\.safetensors/);
    assert.match(sectionProjectCsv, /'@lora-a:0\.8/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("verify CLI helpers read summary JSON and parse supported phases", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase0-verify-"));
  try {
    const summaryPath = path.join(outputDir, "summary.json");
    await writeFile(
      summaryPath,
      JSON.stringify(validSummary({ labeledImages: 42 }), null, 2),
      "utf8",
    );

    const result = await verifyPhase0BaselineSummaryFile(summaryPath, { phase: 0 });
    assert.equal(result.pass, false);
    assert.deepEqual(result.failedCriteria, ["labeled_images_min_1000"]);

    assert.deepEqual(parseVerifyArgs(["--phase", "0", "--summary", summaryPath]), {
      phase: 0,
      summaryPath,
      outDir: undefined,
    });
    assert.deepEqual(parseVerifyArgs(["--phase", "1", "--summary", summaryPath]), {
      phase: 1,
      summaryPath,
      outDir: undefined,
    });
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
