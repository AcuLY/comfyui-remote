#!/usr/bin/env tsx
import { fileURLToPath, pathToFileURL } from "node:url";
import type Database from "better-sqlite3";
import type { Client as PgClient } from "pg";

export type InventoryFormat = "summary" | "json";
export type InventoryCategory = "editRedundancy" | "allowedRetention" | "referenceStructure";
export type InventoryFieldMode = "json" | "text";

export interface ZeroRedundancyInventoryArgs {
  readOnly: true;
  format: InventoryFormat;
}

export type DbProvider = "postgresql" | "sqlite";

export interface ZeroRedundancyDbReadOptions {
  provider?: DbProvider;
  databaseUrl?: string;
}

export interface InventoryFieldStats {
  key: string;
  table: string;
  field: string;
  category: InventoryCategory;
  mode: InventoryFieldMode;
  totalRows: number;
  presentRows: number;
  emptyRows: number;
  validJsonRows: number;
  invalidJsonRows: number;
  invalidExamples: Array<{
    id: string | null;
    valuePreview: string;
    error: string;
  }>;
}

export interface PromptBlockStats {
  totalRows: number;
  presetRows: number;
  customRows: number;
  otherRows: number;
}

export interface DatasetFrozenStats {
  totalRows: number;
  presentRows: number;
}

export interface InventoryCategoryStats {
  fields: Record<string, InventoryFieldStats>;
}

export interface ZeroRedundancyInventory {
  readOnly: true;
  categories: {
    editRedundancy: InventoryCategoryStats & { promptBlocks: PromptBlockStats };
    allowedRetention: InventoryCategoryStats & { datasetFrozenRecords: DatasetFrozenStats };
    referenceStructure: InventoryCategoryStats;
  };
  totals: {
    editRedundancyPresentRows: number;
    allowedRetentionPresentRows: number;
    referenceStructurePresentRows: number;
    invalidJsonRows: number;
  };
  invalidJsonFields: InventoryFieldStats[];
}

export type InventoryRows = Record<string, readonly Record<string, unknown>[] | undefined>;

interface FieldDefinition {
  category: InventoryCategory;
  tableKey: string;
  table: string;
  field: string;
  mode: InventoryFieldMode;
}

const EDIT_REDUNDANCY_FIELDS: readonly FieldDefinition[] = [
  jsonField("editRedundancy", "projects", "Project", "presetBindings"),
  textField("editRedundancy", "projectSections", "ProjectSection", "positivePrompt"),
  textField("editRedundancy", "projectSections", "ProjectSection", "negativePrompt"),
  jsonField("editRedundancy", "projectSections", "ProjectSection", "loraConfig"),
  jsonField("editRedundancy", "projectTemplates", "ProjectTemplate", "presetBindings"),
  jsonField("editRedundancy", "projectTemplateSections", "ProjectTemplateSection", "promptBlocks"),
  jsonField("editRedundancy", "projectTemplateSections", "ProjectTemplateSection", "loraConfig"),
];

const ALLOWED_RETENTION_FIELDS: readonly FieldDefinition[] = [
  jsonField("allowedRetention", "runs", "Run", "resolvedConfigSnapshot"),
  jsonField("allowedRetention", "runs", "Run", "submittedPrompt"),
  jsonField("allowedRetention", "auditLogs", "AuditLog", "payload"),
  jsonField("allowedRetention", "presetChangeLogs", "PresetChangeLog", "before"),
  jsonField("allowedRetention", "presetChangeLogs", "PresetChangeLog", "after"),
  jsonField("allowedRetention", "presetGroupChangeLogs", "PresetGroupChangeLog", "before"),
  jsonField("allowedRetention", "presetGroupChangeLogs", "PresetGroupChangeLog", "after"),
  jsonField("allowedRetention", "sectionChangeLogs", "SectionChangeLog", "before"),
  jsonField("allowedRetention", "sectionChangeLogs", "SectionChangeLog", "after"),
  jsonField("allowedRetention", "characterLoraTrainingTemplates", "CharacterLoraTrainingTemplate", "canonicalDefaults"),
  jsonField("allowedRetention", "characterLoraTrainingTemplates", "CharacterLoraTrainingTemplate", "promptCardDefaults"),
  jsonField("allowedRetention", "characterLoraTrainingTemplates", "CharacterLoraTrainingTemplate", "trainingDefaults"),
  jsonField("allowedRetention", "characterLoraTrainingTemplates", "CharacterLoraTrainingTemplate", "benchmarkDefaults"),
  jsonField("allowedRetention", "characterLoraTrainingTemplates", "CharacterLoraTrainingTemplate", "promotionDefaults"),
  jsonField("allowedRetention", "characterLoraTrainingJobs", "CharacterLoraTrainingJob", "trainingScope"),
  jsonField("allowedRetention", "characterLoraTrainingJobs", "CharacterLoraTrainingJob", "trainingTemplateSnapshot"),
  jsonField("allowedRetention", "characterLoraSourceImages", "CharacterLoraSourceImage", "provenance"),
  jsonField("allowedRetention", "characterLoraPromptCardVersions", "CharacterLoraPromptCardVersion", "identityTraits"),
  jsonField("allowedRetention", "characterLoraPromptCardVersions", "CharacterLoraPromptCardVersion", "outfitTraits"),
  jsonField("allowedRetention", "characterLoraPromptCardVersions", "CharacterLoraPromptCardVersion", "negativeTraits"),
  jsonField("allowedRetention", "characterLoraGenerationRuns", "CharacterLoraGenerationRun", "toolParams"),
  jsonField("allowedRetention", "characterLoraGenerationRuns", "CharacterLoraGenerationRun", "inputImages"),
  jsonField("allowedRetention", "characterLoraGenerationRuns", "CharacterLoraGenerationRun", "responseSummary"),
  jsonField("allowedRetention", "characterLoraCandidateImages", "CharacterLoraCandidateImage", "rejectReasons"),
  jsonField("allowedRetention", "characterLoraTrainingRuns", "CharacterLoraTrainingRun", "resolvedConfig"),
  jsonField("allowedRetention", "characterLoraTrainingRuns", "CharacterLoraTrainingRun", "metadataSummary"),
  jsonField("allowedRetention", "characterLoraTrainingRuns", "CharacterLoraTrainingRun", "lossSnapshot"),
  jsonField("allowedRetention", "characterLoraTrainingCheckpoints", "CharacterLoraTrainingCheckpoint", "metrics"),
  jsonField("allowedRetention", "characterLoraBenchmarkRuns", "CharacterLoraBenchmarkRun", "checkpointMatrix"),
  jsonField("allowedRetention", "characterLoraBenchmarkRuns", "CharacterLoraBenchmarkRun", "weightMatrix"),
  jsonField("allowedRetention", "characterLoraBenchmarkRuns", "CharacterLoraBenchmarkRun", "resultSummary"),
  jsonField("allowedRetention", "characterLoraBenchmarkRuns", "CharacterLoraBenchmarkRun", "cleanupSummary"),
  jsonField("allowedRetention", "characterLoraPromotionDecisions", "CharacterLoraPromotionDecision", "perVariantWeightOverrides"),
  jsonField("allowedRetention", "characterLoraPromotionDecisions", "CharacterLoraPromotionDecision", "variantPromptDrafts"),
  jsonField("allowedRetention", "characterLoraArtifacts", "CharacterLoraArtifact", "metadata"),
  jsonField("allowedRetention", "characterLoraWorkerTasks", "CharacterLoraWorkerTask", "payload"),
  jsonField("allowedRetention", "characterLoraWorkerTasks", "CharacterLoraWorkerTask", "progressJson"),
];

const REFERENCE_STRUCTURE_FIELDS: readonly FieldDefinition[] = [
  jsonField("referenceStructure", "presetVariants", "PresetVariant", "linkedVariants"),
  jsonField("referenceStructure", "presetCategories", "PresetCategory", "slotTemplate"),
];

export function collectZeroRedundancyInventory(rows: InventoryRows): ZeroRedundancyInventory {
  const editRedundancyFields = collectFields(rows, EDIT_REDUNDANCY_FIELDS);
  const allowedRetentionFields = collectFields(rows, ALLOWED_RETENTION_FIELDS);
  const referenceStructureFields = collectFields(rows, REFERENCE_STRUCTURE_FIELDS);
  const promptBlocks = collectPromptBlockStats(rows.promptBlocks);
  const datasetFrozenRecords = collectDatasetFrozenStats(rows.characterLoraDatasetRevisions);

  const invalidJsonFields = [
    ...Object.values(editRedundancyFields),
    ...Object.values(allowedRetentionFields),
    ...Object.values(referenceStructureFields),
  ].filter((field) => field.invalidJsonRows > 0);

  return {
    readOnly: true,
    categories: {
      editRedundancy: {
        fields: editRedundancyFields,
        promptBlocks,
      },
      allowedRetention: {
        fields: allowedRetentionFields,
        datasetFrozenRecords,
      },
      referenceStructure: {
        fields: referenceStructureFields,
      },
    },
    totals: {
      editRedundancyPresentRows: sumPresentRows(editRedundancyFields) + promptBlocks.totalRows,
      allowedRetentionPresentRows: sumPresentRows(allowedRetentionFields) + datasetFrozenRecords.presentRows,
      referenceStructurePresentRows: sumPresentRows(referenceStructureFields),
      invalidJsonRows: invalidJsonFields.reduce((total, field) => total + field.invalidJsonRows, 0),
    },
    invalidJsonFields,
  };
}

export function parseZeroRedundancyInventoryArgs(
  argv: readonly string[],
): ZeroRedundancyInventoryArgs {
  let readOnly = false;
  let format: InventoryFormat = "summary";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--read-only") {
      readOnly = true;
    } else if (arg === "--format") {
      format = parseFormat(requireValue(argv, (index += 1), "--format"));
    } else if (arg.startsWith("--format=")) {
      format = parseFormat(arg.slice("--format=".length));
    } else {
      throw new Error(`Unknown zero redundancy inventory argument: ${arg}`);
    }
  }

  if (!readOnly) {
    throw new Error("--read-only is required; this inventory script refuses to run otherwise");
  }

  return { readOnly: true, format };
}

export function formatZeroRedundancyInventory(
  inventory: ZeroRedundancyInventory,
  format: InventoryFormat,
): string {
  if (format === "json") {
    return JSON.stringify(inventory, null, 2);
  }

  const lines = [
    "Zero Redundancy DB Inventory",
    `read only: ${inventory.readOnly}`,
    `edit redundancy present rows: ${inventory.totals.editRedundancyPresentRows}`,
    `allowed retention present rows: ${inventory.totals.allowedRetentionPresentRows}`,
    `reference structure present rows: ${inventory.totals.referenceStructurePresentRows}`,
    `invalid JSON rows: ${inventory.totals.invalidJsonRows}`,
  ];

  if (inventory.invalidJsonFields.length > 0) {
    lines.push("invalid JSON fields:");
    for (const field of inventory.invalidJsonFields) {
      lines.push(`- ${field.key}: ${field.invalidJsonRows}`);
    }
  }

  return lines.join("\n");
}

export async function runZeroRedundancyProductionStatsCli(
  argv = process.argv.slice(2),
): Promise<number> {
  const args = parseZeroRedundancyInventoryArgs(argv);
  const rows = await readZeroRedundancyRowsFromDb();
  const inventory = collectZeroRedundancyInventory(rows);
  console.log(formatZeroRedundancyInventory(inventory, args.format));
  return 0;
}

export async function readZeroRedundancyRowsFromDb(
  options: ZeroRedundancyDbReadOptions = {},
): Promise<InventoryRows> {
  const provider = options.provider ?? detectDbProvider(options.databaseUrl);
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for zero redundancy inventory");
  }

  if (provider === "sqlite") {
    return readSqliteRows(databaseUrl);
  }

  return readPostgresqlRows(databaseUrl);
}

function collectFields(
  input: InventoryRows,
  definitions: readonly FieldDefinition[],
): Record<string, InventoryFieldStats> {
  const fields: Record<string, InventoryFieldStats> = {};

  for (const definition of definitions) {
    const records = input[definition.tableKey] ?? [];
    const stats = createEmptyFieldStats(definition, records.length);

    for (const record of records) {
      const value = record[definition.field];
      if (!isPresent(value)) {
        stats.emptyRows += 1;
        continue;
      }

      stats.presentRows += 1;
      if (definition.mode === "json") {
        const parseResult = validateJsonCell(value);
        if (parseResult.valid) {
          stats.validJsonRows += 1;
        } else {
          stats.invalidJsonRows += 1;
          if (stats.invalidExamples.length < 5) {
            stats.invalidExamples.push({
              id: idFromRecord(record),
              valuePreview: previewValue(value),
              error: parseResult.error,
            });
          }
        }
      }
    }

    fields[stats.key] = stats;
  }

  return fields;
}

function buildReadSpecs(): Array<{
  tableKey: string;
  table: string;
  fields: string[];
}> {
  const specs = new Map<string, { tableKey: string; table: string; fields: Set<string> }>();

  for (const definition of [
    ...EDIT_REDUNDANCY_FIELDS,
    ...ALLOWED_RETENTION_FIELDS,
    ...REFERENCE_STRUCTURE_FIELDS,
  ]) {
    const existing = specs.get(definition.tableKey);
    if (existing) {
      existing.fields.add(definition.field);
    } else {
      specs.set(definition.tableKey, {
        tableKey: definition.tableKey,
        table: definition.table,
        fields: new Set([definition.field]),
      });
    }
  }

  mergeReadSpec(specs, "promptBlocks", "PromptBlock", ["type"]);
  mergeReadSpec(specs, "characterLoraDatasetRevisions", "CharacterLoraDatasetRevision", [
    "selectedManifestArtifactId",
    "metadataJsonlArtifactId",
    "captionAuditArtifactId",
    "frozenAt",
  ]);

  return [...specs.values()].map((spec) => ({
    tableKey: spec.tableKey,
    table: spec.table,
    fields: [...spec.fields],
  }));
}

function mergeReadSpec(
  specs: Map<string, { tableKey: string; table: string; fields: Set<string> }>,
  tableKey: string,
  table: string,
  fields: string[],
): void {
  const existing = specs.get(tableKey);
  if (existing) {
    for (const field of fields) existing.fields.add(field);
    return;
  }

  specs.set(tableKey, {
    tableKey,
    table,
    fields: new Set(fields),
  });
}

async function readSqliteRows(databaseUrl: string): Promise<InventoryRows> {
  const sqlitePath = sqlitePathFromDatabaseUrl(databaseUrl);
  const { default: BetterSqlite3 } = (await import("better-sqlite3")) as {
    default: typeof Database;
  };
  const db = new BetterSqlite3(sqlitePath, { readonly: true, fileMustExist: true });
  const rows: InventoryRows = {};

  try {
    for (const spec of buildReadSpecs()) {
      rows[spec.tableKey] = readSqliteSpec(db, spec.table, spec.fields);
    }
  } finally {
    db.close();
  }

  return rows;
}

function readSqliteSpec(
  db: Database.Database,
  table: string,
  fields: readonly string[],
): Record<string, unknown>[] {
  const existingColumns = readSqliteColumns(db, table);
  if (existingColumns.size === 0) return [];

  const selectedColumns = ["id", ...fields].filter((field) => existingColumns.has(field));
  if (selectedColumns.length === 0) return [];

  const sql = `SELECT ${selectedColumns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(table)}`;
  return db.prepare(sql).all() as Record<string, unknown>[];
}

function readSqliteColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{
    name?: unknown;
  }>;
  return new Set(rows.flatMap((row) => (typeof row.name === "string" ? [row.name] : [])));
}

async function readPostgresqlRows(databaseUrl: string): Promise<InventoryRows> {
  const { Client } = (await import("pg")) as { Client: typeof PgClient };
  const client = new Client({ connectionString: databaseUrl });
  const rows: InventoryRows = {};

  await client.connect();
  try {
    for (const spec of buildReadSpecs()) {
      rows[spec.tableKey] = await readPostgresqlSpec(client, spec.table, spec.fields);
    }
  } finally {
    await client.end();
  }

  return rows;
}

async function readPostgresqlSpec(
  client: PgClient,
  table: string,
  fields: readonly string[],
): Promise<Record<string, unknown>[]> {
  const existingColumns = await readPostgresqlColumns(client, table);
  if (existingColumns.size === 0) return [];

  const selectedColumns = ["id", ...fields].filter((field) => existingColumns.has(field));
  if (selectedColumns.length === 0) return [];

  const sql = `SELECT ${[
    ...selectedColumns.map((field) => `${quoteIdentifier(field)}::text AS ${quoteIdentifier(field)}`),
  ].join(", ")} FROM ${quoteIdentifier(table)}`;

  const result = await client.query(sql);
  return result.rows as Record<string, unknown>[];
}

async function readPostgresqlColumns(client: PgClient, table: string): Promise<Set<string>> {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
    `,
    [table],
  );
  return new Set(
    (result.rows as Array<{ column_name?: unknown }>).flatMap((row) =>
      typeof row.column_name === "string" ? [row.column_name] : [],
    ),
  );
}

function collectPromptBlockStats(
  records: readonly Record<string, unknown>[] | undefined,
): PromptBlockStats {
  const stats: PromptBlockStats = {
    totalRows: 0,
    presetRows: 0,
    customRows: 0,
    otherRows: 0,
  };

  for (const record of records ?? []) {
    stats.totalRows += 1;
    if (record.type === "preset") {
      stats.presetRows += 1;
    } else if (record.type === "custom") {
      stats.customRows += 1;
    } else {
      stats.otherRows += 1;
    }
  }

  return stats;
}

function collectDatasetFrozenStats(
  records: readonly Record<string, unknown>[] | undefined,
): DatasetFrozenStats {
  const stats: DatasetFrozenStats = {
    totalRows: 0,
    presentRows: 0,
  };

  for (const record of records ?? []) {
    stats.totalRows += 1;
    if (
      isPresent(record.selectedManifestArtifactId) ||
      isPresent(record.metadataJsonlArtifactId) ||
      isPresent(record.captionAuditArtifactId) ||
      isPresent(record.frozenAt)
    ) {
      stats.presentRows += 1;
    }
  }

  return stats;
}

function createEmptyFieldStats(
  definition: FieldDefinition,
  totalRows: number,
): InventoryFieldStats {
  return {
    key: fieldKey(definition.table, definition.field),
    table: definition.table,
    field: definition.field,
    category: definition.category,
    mode: definition.mode,
    totalRows,
    presentRows: 0,
    emptyRows: 0,
    validJsonRows: 0,
    invalidJsonRows: 0,
    invalidExamples: [],
  };
}

function jsonField(
  category: InventoryCategory,
  tableKey: string,
  table: string,
  field: string,
): FieldDefinition {
  return { category, tableKey, table, field, mode: "json" };
}

function textField(
  category: InventoryCategory,
  tableKey: string,
  table: string,
  field: string,
): FieldDefinition {
  return { category, tableKey, table, field, mode: "text" };
}

function sumPresentRows(fields: Record<string, InventoryFieldStats>): number {
  return Object.values(fields).reduce((total, field) => total + field.presentRows, 0);
}

function validateJsonCell(value: unknown): { valid: true } | { valid: false; error: string } {
  if (typeof value !== "string") {
    return { valid: true };
  }

  try {
    JSON.parse(value);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function idFromRecord(record: Record<string, unknown>): string | null {
  return typeof record.id === "string" ? record.id : null;
}

function previewValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function fieldKey(table: string, field: string): string {
  return `${table}.${field}`;
}

function parseFormat(value: string): InventoryFormat {
  if (value === "summary" || value === "json") return value;
  throw new Error(`Unsupported --format value: ${value}`);
}

function detectDbProvider(databaseUrl = process.env.DATABASE_URL ?? ""): DbProvider {
  const explicit = process.env.DB_PROVIDER?.toLowerCase();
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  if (databaseUrl.startsWith("file:") || databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
    return "sqlite";
  }
  return "postgresql";
}

function sqlitePathFromDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) return databaseUrl;
  if (databaseUrl.startsWith("file://")) return fileURLToPath(databaseUrl);
  return databaseUrl.slice("file:".length);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runZeroRedundancyProductionStatsCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
