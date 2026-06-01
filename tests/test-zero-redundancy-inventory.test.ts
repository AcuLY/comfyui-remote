import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  collectZeroRedundancyInventory,
  formatZeroRedundancyInventory,
  parseZeroRedundancyInventoryArgs,
  readZeroRedundancyRowsFromDb,
  runZeroRedundancyProductionStatsCli,
} from "../scripts/db/zero-redundancy-production-stats";
import { zeroRedundancyLegacyFixture } from "./fixtures/zero-redundancy-legacy";

test("collectZeroRedundancyInventory separates editable redundancy from retained records", () => {
  const inventory = collectZeroRedundancyInventory(zeroRedundancyLegacyFixture);

  assert.equal(inventory.readOnly, true);
  assert.equal(inventory.categories.editRedundancy.fields["Project.presetBindings"].presentRows, 2);
  assert.equal(inventory.categories.editRedundancy.fields["Project.presetBindings"].invalidJsonRows, 1);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.positivePrompt"].presentRows, 1);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.negativePrompt"].presentRows, 1);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.loraConfig"].presentRows, 2);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.loraConfig"].invalidJsonRows, 1);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectTemplate.presetBindings"].presentRows, 1);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectTemplateSection.promptBlocks"].presentRows, 2);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectTemplateSection.promptBlocks"].invalidJsonRows, 1);
  assert.equal(inventory.categories.editRedundancy.fields["ProjectTemplateSection.loraConfig"].presentRows, 1);

  assert.deepEqual(inventory.categories.editRedundancy.promptBlocks, {
    totalRows: 4,
    presetRows: 2,
    customRows: 1,
    otherRows: 1,
  });

  assert.equal(inventory.categories.allowedRetention.fields["Run.resolvedConfigSnapshot"].presentRows, 2);
  assert.equal(inventory.categories.allowedRetention.fields["Run.submittedPrompt"].presentRows, 2);
  assert.equal(inventory.categories.allowedRetention.fields["Run.submittedPrompt"].invalidJsonRows, 1);
  assert.equal(inventory.categories.allowedRetention.fields["AuditLog.payload"].invalidJsonRows, 1);
  assert.equal(inventory.categories.allowedRetention.fields["CharacterLoraArtifact.metadata"].presentRows, 1);
  assert.equal(inventory.categories.allowedRetention.datasetFrozenRecords.presentRows, 1);

  assert.equal(inventory.categories.referenceStructure.fields["PresetVariant.linkedVariants"].presentRows, 2);
  assert.equal(inventory.categories.referenceStructure.fields["PresetVariant.linkedVariants"].invalidJsonRows, 1);
  assert.equal(inventory.categories.referenceStructure.fields["PresetCategory.slotTemplate"].presentRows, 1);
});

test("collectZeroRedundancyInventory totals invalid JSON without mixing retention classes", () => {
  const inventory = collectZeroRedundancyInventory(zeroRedundancyLegacyFixture);

  assert.equal(inventory.totals.editRedundancyPresentRows, 14);
  assert.equal(inventory.totals.allowedRetentionPresentRows, 40);
  assert.equal(inventory.totals.referenceStructurePresentRows, 3);
  assert.equal(inventory.totals.invalidJsonRows, 6);
  assert.deepEqual(
    inventory.invalidJsonFields.map((field) => field.key),
    [
      "Project.presetBindings",
      "ProjectSection.loraConfig",
      "ProjectTemplateSection.promptBlocks",
      "Run.submittedPrompt",
      "AuditLog.payload",
      "PresetVariant.linkedVariants",
    ],
  );
});

test("parseZeroRedundancyInventoryArgs requires explicit read-only mode", () => {
  assert.throws(
    () => parseZeroRedundancyInventoryArgs(["--format", "json"]),
    /--read-only is required/,
  );
  assert.deepEqual(parseZeroRedundancyInventoryArgs(["--read-only", "--format", "json"]), {
    readOnly: true,
    format: "json",
  });
  assert.deepEqual(parseZeroRedundancyInventoryArgs(["--read-only"]), {
    readOnly: true,
    format: "summary",
  });
});

test("formatZeroRedundancyInventory emits machine JSON and human summary", () => {
  const inventory = collectZeroRedundancyInventory(zeroRedundancyLegacyFixture);
  const json = JSON.parse(formatZeroRedundancyInventory(inventory, "json")) as {
    readOnly: boolean;
    totals: { invalidJsonRows: number };
  };
  const summary = formatZeroRedundancyInventory(inventory, "summary");

  assert.equal(json.readOnly, true);
  assert.equal(json.totals.invalidJsonRows, 6);
  assert.match(summary, /Zero Redundancy DB Inventory/);
  assert.match(summary, /edit redundancy present rows: 14/);
  assert.match(summary, /allowed retention present rows: 40/);
  assert.match(summary, /invalid JSON rows: 6/);
});

test("readZeroRedundancyRowsFromDb reads SQLite with raw SELECTs and ignores missing optional tables", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "zero-redundancy-inventory-"));
  const dbPath = path.join(tempDir, "inventory.db");
  const db = new Database(dbPath);

  try {
    db.exec(`
      create table "Project" (
        "id" text primary key,
        "presetBindings" text
      );
      create table "ProjectSection" (
        "id" text primary key,
        "positivePrompt" text,
        "negativePrompt" text,
        "loraConfig" text
      );
      create table "PromptBlock" (
        "id" text primary key,
        "type" text
      );
      create table "Run" (
        "id" text primary key,
        "resolvedConfigSnapshot" text,
        "submittedPrompt" text
      );
      create table "AuditLog" (
        "id" text primary key,
        "payload" text
      );
      create table "CharacterLoraDatasetRevision" (
        "id" text primary key,
        "selectedManifestArtifactId" text,
        "metadataJsonlArtifactId" text,
        "captionAuditArtifactId" text,
        "frozenAt" text
      );
    `);
    db.prepare(`insert into "Project" ("id", "presetBindings") values (?, ?)`).run(
      "project-bad",
      "{\"broken\":",
    );
    db.prepare(
      `insert into "ProjectSection" ("id", "positivePrompt", "negativePrompt", "loraConfig") values (?, ?, ?, ?)`,
    ).run("section-legacy", "positive", null, JSON.stringify({ lora1: [] }));
    db.prepare(`insert into "PromptBlock" ("id", "type") values (?, ?)`).run("block-preset", "preset");
    db.prepare(
      `insert into "Run" ("id", "resolvedConfigSnapshot", "submittedPrompt") values (?, ?, ?)`,
    ).run("run-bad", JSON.stringify({ ok: true }), "{\"nodes\":");
    db.prepare(`insert into "AuditLog" ("id", "payload") values (?, ?)`).run(
      "audit-good",
      JSON.stringify({ action: "test" }),
    );
    db.prepare(
      `insert into "CharacterLoraDatasetRevision" ("id", "selectedManifestArtifactId", "metadataJsonlArtifactId", "captionAuditArtifactId", "frozenAt") values (?, ?, ?, ?, ?)`,
    ).run("dataset-frozen", "manifest-artifact", null, null, null);
  } finally {
    db.close();
  }

  try {
    const rows = await readZeroRedundancyRowsFromDb({
      provider: "sqlite",
      databaseUrl: `file:${dbPath}`,
    });
    const inventory = collectZeroRedundancyInventory(rows);

    assert.equal(rows.projects?.length, 1);
    assert.equal(rows.projectTemplates?.length, 0);
    assert.equal(rows.characterLoraArtifacts?.length, 0);
    assert.equal(inventory.categories.editRedundancy.fields["Project.presetBindings"].invalidJsonRows, 1);
    assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.positivePrompt"].presentRows, 1);
    assert.equal(inventory.categories.editRedundancy.promptBlocks.presetRows, 1);
    assert.equal(inventory.categories.allowedRetention.fields["Run.submittedPrompt"].invalidJsonRows, 1);
    assert.equal(inventory.categories.allowedRetention.datasetFrozenRecords.presentRows, 1);
    assert.equal(inventory.totals.invalidJsonRows, 2);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("readZeroRedundancyRowsFromDb keeps existing SQLite columns when sibling columns are missing", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "zero-redundancy-missing-column-"));
  const dbPath = path.join(tempDir, "inventory.db");
  const db = new Database(dbPath);

  try {
    db.exec(`
      create table "ProjectSection" (
        "id" text primary key,
        "positivePrompt" text
      );
    `);
    db.prepare(`insert into "ProjectSection" ("id", "positivePrompt") values (?, ?)`).run(
      "section-partial",
      "positive survives",
    );
  } finally {
    db.close();
  }

  try {
    const rows = await readZeroRedundancyRowsFromDb({
      provider: "sqlite",
      databaseUrl: `file:${dbPath}`,
    });
    const inventory = collectZeroRedundancyInventory(rows);

    assert.equal(rows.projectSections?.length, 1);
    assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.positivePrompt"].presentRows, 1);
    assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.negativePrompt"].presentRows, 0);
    assert.equal(inventory.categories.editRedundancy.fields["ProjectSection.loraConfig"].presentRows, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runZeroRedundancyProductionStatsCli reads the configured database", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "zero-redundancy-cli-"));
  const dbPath = path.join(tempDir, "inventory.db");
  const db = new Database(dbPath);
  const originalProvider = process.env.DB_PROVIDER;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalLog = console.log;
  const logs: string[] = [];

  try {
    db.exec(`
      create table "Project" (
        "id" text primary key,
        "presetBindings" text
      );
    `);
    db.prepare(`insert into "Project" ("id", "presetBindings") values (?, ?)`).run(
      "project-cli",
      JSON.stringify([{ presetId: "preset-cli" }]),
    );
  } finally {
    db.close();
  }

  try {
    process.env.DB_PROVIDER = "sqlite";
    process.env.DATABASE_URL = `file:${dbPath}`;
    console.log = (message?: unknown) => {
      logs.push(String(message));
    };

    const exitCode = await runZeroRedundancyProductionStatsCli(["--read-only", "--format", "json"]);
    const output = JSON.parse(logs.join("\n")) as {
      totals: { editRedundancyPresentRows: number };
      categories: { editRedundancy: { fields: Record<string, { presentRows: number }> } };
    };

    assert.equal(exitCode, 0);
    assert.equal(output.categories.editRedundancy.fields["Project.presetBindings"].presentRows, 1);
    assert.equal(output.totals.editRedundancyPresentRows, 1);
  } finally {
    console.log = originalLog;
    if (originalProvider === undefined) {
      delete process.env.DB_PROVIDER;
    } else {
      process.env.DB_PROVIDER = originalProvider;
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
