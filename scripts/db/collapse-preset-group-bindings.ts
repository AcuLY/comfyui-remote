#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

type BindingScope = "section" | "template";

export type CollapsePresetGroupBindingsFormat = "summary" | "json";

export interface CollapsePresetGroupBindingsOptions {
  databaseUrl?: string | null;
  dryRun?: boolean;
  write?: boolean;
  format?: CollapsePresetGroupBindingsFormat;
}

export interface CollapsePresetGroupBindingsArgs {
  databaseUrl: string | null;
  dryRun: boolean;
  write: boolean;
  format: CollapsePresetGroupBindingsFormat;
}

export interface CollapseScopeSummary {
  candidateGroups: number;
  collapsedGroups: number;
  skippedLegacyGroups: number;
  skippedMissingPresetGroups: number;
  updatedReferenceBindings: number;
  deletedBindings: number;
  keptPromptBlocks: number;
  deletedPromptBlocks: number;
  movedManualLoras: number;
}

export interface CollapsePresetGroupBindingsSummary {
  dryRun: boolean;
  databasePath: string;
  section: CollapseScopeSummary;
  template: CollapseScopeSummary;
}

type BindingRow = {
  id: string;
  ownerId: string;
  bindingKey: string;
  categoryId: string;
  presetId: string | null;
  variantId: string | null;
  presetGroupId: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
  createdAt: string | null;
};

type PromptRow = {
  id: string;
  bindingId: string | null;
  sortOrder: number;
  createdAt: string | null;
};

type PresetGroupRow = {
  id: string;
  categoryId: string;
};

type ScopeConfig = {
  scope: BindingScope;
  bindingTable: string;
  ownerColumn: string;
  promptTable: string;
  promptBindingColumn: string;
  manualTable: string;
  manualBindingColumn: string;
};

const SECTION_SCOPE: ScopeConfig = {
  scope: "section",
  bindingTable: "SectionPresetBinding",
  ownerColumn: "projectSectionId",
  promptTable: "SectionPromptBlock",
  promptBindingColumn: "sectionBindingId",
  manualTable: "SectionManualLoraEntry",
  manualBindingColumn: "sectionBindingId",
};

const TEMPLATE_SCOPE: ScopeConfig = {
  scope: "template",
  bindingTable: "TemplateSectionPresetBinding",
  ownerColumn: "projectTemplateSectionId",
  promptTable: "TemplateSectionPromptBlock",
  promptBindingColumn: "templateSectionBindingId",
  manualTable: "TemplateSectionManualLoraEntry",
  manualBindingColumn: "templateSectionBindingId",
};

function emptyScopeSummary(): CollapseScopeSummary {
  return {
    candidateGroups: 0,
    collapsedGroups: 0,
    skippedLegacyGroups: 0,
    skippedMissingPresetGroups: 0,
    updatedReferenceBindings: 0,
    deletedBindings: 0,
    keptPromptBlocks: 0,
    deletedPromptBlocks: 0,
    movedManualLoras: 0,
  };
}

export function parseCollapsePresetGroupBindingsArgs(
  argv: readonly string[],
): CollapsePresetGroupBindingsArgs {
  let databaseUrl: string | null = null;
  let dryRun = false;
  let write = false;
  let format: CollapsePresetGroupBindingsFormat = "summary";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--format") {
      format = parseFormat(requireValue(argv, (index += 1), "--format"));
      continue;
    }
    if (arg.startsWith("--format=")) {
      format = parseFormat(requireNonEmptyValue(arg.slice("--format=".length), "--format"));
      continue;
    }
    if (arg === "--json") {
      format = "json";
      continue;
    }
    if (arg === "--summary") {
      format = "summary";
      continue;
    }
    if (arg === "--database-url") {
      databaseUrl = requireValue(argv, (index += 1), "--database-url");
      continue;
    }
    if (arg.startsWith("--database-url=")) {
      databaseUrl = requireNonEmptyValue(arg.slice("--database-url=".length), "--database-url");
      continue;
    }
    throw new Error(`Unknown collapse preset group bindings argument: ${arg}`);
  }

  if (write && dryRun) {
    throw new Error("--write cannot be combined with --dry-run");
  }

  return { databaseUrl, dryRun: !write, write, format };
}

function resolveSqlitePath(databaseUrl: string | null | undefined = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Only SQLite DATABASE_URL values starting with file: are supported");
  }

  const rawPath = databaseUrl.slice("file:".length);
  const databasePath = path.resolve(rawPath);
  if (!existsSync(databasePath)) {
    throw new Error(`SQLite database does not exist: ${databasePath}`);
  }
  return databasePath;
}

function parsePresetGroupId(groupBindingKey: string | null) {
  return groupBindingKey?.match(/^grp:([^:]+):/)?.[1] ?? null;
}

function compareRows(left: { sortOrder: number; createdAt: string | null; id: string }, right: {
  sortOrder: number;
  createdAt: string | null;
  id: string;
}) {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  const leftCreated = left.createdAt ?? "";
  const rightCreated = right.createdAt ?? "";
  if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated);
  return left.id.localeCompare(right.id);
}

function groupByInstance(rows: BindingRow[]) {
  const groups = new Map<string, BindingRow[]>();

  for (const row of rows) {
    if (!row.groupBindingKey) continue;
    const key = `${row.ownerId}\u0000${row.groupBindingKey}`;
    const groupRows = groups.get(key) ?? [];
    groupRows.push(row);
    groups.set(key, groupRows);
  }

  for (const groupRows of groups.values()) {
    groupRows.sort(compareRows);
  }

  return groups;
}

function placeholders(values: readonly unknown[]) {
  return values.map(() => "?").join(", ");
}

function loadPresetGroups(db: Database.Database) {
  const groups = db.prepare("SELECT id, categoryId FROM PresetGroup").all() as PresetGroupRow[];
  return new Map(groups.map((group) => [group.id, group]));
}

function loadExpandedGroupBindingRows(db: Database.Database, config: ScopeConfig) {
  return db.prepare(`
    SELECT
      id,
      ${config.ownerColumn} AS ownerId,
      bindingKey,
      categoryId,
      presetId,
      variantId,
      presetGroupId,
      groupBindingKey,
      sortOrder,
      createdAt
    FROM ${config.bindingTable}
    WHERE groupBindingKey IS NOT NULL
      AND (
        presetGroupId IS NULL
        OR presetId IS NOT NULL
      )
    ORDER BY ${config.ownerColumn}, groupBindingKey, sortOrder, createdAt, id
  `).all() as BindingRow[];
}

function resolvePresetGroupId(groupRows: readonly BindingRow[]) {
  const explicitIds = [...new Set(groupRows.map((row) => row.presetGroupId).filter((id): id is string => Boolean(id)))];
  if (explicitIds.length === 1) return explicitIds[0];
  return parsePresetGroupId(groupRows[0]?.groupBindingKey ?? null);
}

function loadExistingReferenceBinding(
  db: Database.Database,
  config: ScopeConfig,
  ownerId: string,
  groupBindingKey: string,
  presetGroupId: string,
) {
  return db.prepare(`
    SELECT
      id,
      ${config.ownerColumn} AS ownerId,
      bindingKey,
      categoryId,
      presetId,
      variantId,
      presetGroupId,
      groupBindingKey,
      sortOrder,
      createdAt
    FROM ${config.bindingTable}
    WHERE ${config.ownerColumn} = ?
      AND groupBindingKey = ?
      AND presetGroupId = ?
    ORDER BY sortOrder, createdAt, id
    LIMIT 1
  `).get(ownerId, groupBindingKey, presetGroupId) as BindingRow | undefined;
}

function loadPromptRows(
  db: Database.Database,
  config: ScopeConfig,
  ownerId: string,
  bindingIds: string[],
) {
  if (bindingIds.length === 0) return [];
  return db.prepare(`
    SELECT id, ${config.promptBindingColumn} AS bindingId, sortOrder, createdAt
    FROM ${config.promptTable}
    WHERE ${config.ownerColumn} = ?
      AND ${config.promptBindingColumn} IN (${placeholders(bindingIds)})
    ORDER BY sortOrder, createdAt, id
  `).all(ownerId, ...bindingIds) as PromptRow[];
}

function countManualLoraRows(
  db: Database.Database,
  config: ScopeConfig,
  ownerId: string,
  bindingIds: string[],
) {
  if (bindingIds.length === 0) return 0;
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM ${config.manualTable}
    WHERE ${config.ownerColumn} = ?
      AND ${config.manualBindingColumn} IN (${placeholders(bindingIds)})
  `).get(ownerId, ...bindingIds) as { count: number };
  return row.count;
}

function choosePromptToKeep(promptRows: PromptRow[], keeperId: string) {
  return promptRows.find((row) => row.bindingId === keeperId) ?? promptRows[0] ?? null;
}

function collapseScope(db: Database.Database, config: ScopeConfig, write: boolean) {
  const summary = emptyScopeSummary();
  const presetGroups = loadPresetGroups(db);
  const expandedRows = loadExpandedGroupBindingRows(db, config);
  const groups = groupByInstance(expandedRows);

  summary.candidateGroups = groups.size;

  const apply = db.transaction((groupRows: BindingRow[], presetGroup: PresetGroupRow) => {
    const first = groupRows[0];
    const existingReference = loadExistingReferenceBinding(
      db,
      config,
      first.ownerId,
      first.groupBindingKey!,
      presetGroup.id,
    );
    const keeper = existingReference ?? first;
    const bindingIds = existingReference
      ? [existingReference.id, ...groupRows.map((row) => row.id)]
      : groupRows.map((row) => row.id);
    const bindingIdsToDelete = bindingIds.filter((id) => id !== keeper.id);
    const groupSortOrder = Math.min(...groupRows.map((row) => row.sortOrder), keeper.sortOrder);
    const promptRows = loadPromptRows(db, config, first.ownerId, bindingIds);
    const keepPrompt = choosePromptToKeep(promptRows, keeper.id);
    const promptIdsToDelete = promptRows
      .filter((row) => row.id !== keepPrompt?.id)
      .map((row) => row.id);

    const manualRows = countManualLoraRows(db, config, first.ownerId, bindingIds);

    if (keepPrompt) {
      if (promptIdsToDelete.length > 0) {
        db.prepare(`
          DELETE FROM ${config.promptTable}
          WHERE id IN (${placeholders(promptIdsToDelete)})
        `).run(...promptIdsToDelete);
      }
      db.prepare(`
        UPDATE ${config.promptTable}
        SET ${config.promptBindingColumn} = ?, type = 'preset', sortOrder = ?
        WHERE id = ?
      `).run(keeper.id, groupSortOrder, keepPrompt.id);
    }

    if (bindingIds.length > 0) {
      db.prepare(`
        UPDATE ${config.manualTable}
        SET
          ${config.manualBindingColumn} = ?,
          detachedFromBindingKey = CASE
            WHEN detachedFromPath IS NOT NULL THEN ?
            ELSE detachedFromBindingKey
          END
        WHERE ${config.ownerColumn} = ?
          AND ${config.manualBindingColumn} IN (${placeholders(bindingIds)})
      `).run(keeper.id, keeper.bindingKey, first.ownerId, ...bindingIds);
    }

    db.prepare(`
      UPDATE ${config.bindingTable}
      SET
        categoryId = ?,
        presetId = NULL,
        variantId = NULL,
        presetGroupId = ?,
        groupBindingKey = ?,
        sortOrder = ?
      WHERE id = ?
    `).run(presetGroup.categoryId, presetGroup.id, first.groupBindingKey, groupSortOrder, keeper.id);

    if (bindingIdsToDelete.length > 0) {
      db.prepare(`
        DELETE FROM ${config.bindingTable}
        WHERE id IN (${placeholders(bindingIdsToDelete)})
      `).run(...bindingIdsToDelete);
    }

    return {
      deletedBindings: bindingIdsToDelete.length,
      keptPromptBlocks: keepPrompt ? 1 : 0,
      deletedPromptBlocks: promptIdsToDelete.length,
      movedManualLoras: manualRows,
    };
  });

  for (const groupRows of groups.values()) {
    const groupBindingKey = groupRows[0].groupBindingKey;
    const presetGroupId = resolvePresetGroupId(groupRows);
    if (!presetGroupId) {
      summary.skippedLegacyGroups += 1;
      continue;
    }

    const presetGroup = presetGroups.get(presetGroupId);
    if (!presetGroup) {
      summary.skippedMissingPresetGroups += 1;
      continue;
    }

    const bindingIds = groupRows.map((row) => row.id);
    const existingReference = loadExistingReferenceBinding(
      db,
      config,
      groupRows[0].ownerId,
      groupBindingKey!,
      presetGroup.id,
    );
    const allBindingIds = existingReference ? [existingReference.id, ...bindingIds] : bindingIds;
    const promptRows = loadPromptRows(db, config, groupRows[0].ownerId, allBindingIds);
    const predictedDeletedBindings = existingReference ? bindingIds.length : Math.max(0, bindingIds.length - 1);
    const predictedDeletedPrompts = Math.max(0, promptRows.length - (promptRows.length > 0 ? 1 : 0));
    const predictedManualRows = countManualLoraRows(db, config, groupRows[0].ownerId, allBindingIds);

    summary.collapsedGroups += 1;
    summary.updatedReferenceBindings += 1;
    summary.deletedBindings += predictedDeletedBindings;
    summary.keptPromptBlocks += promptRows.length > 0 ? 1 : 0;
    summary.deletedPromptBlocks += predictedDeletedPrompts;
    summary.movedManualLoras += predictedManualRows;

    if (write) {
      const applied = apply(groupRows, presetGroup);
      summary.deletedBindings += applied.deletedBindings - predictedDeletedBindings;
      summary.keptPromptBlocks += applied.keptPromptBlocks - (promptRows.length > 0 ? 1 : 0);
      summary.deletedPromptBlocks += applied.deletedPromptBlocks - predictedDeletedPrompts;
      summary.movedManualLoras += applied.movedManualLoras - predictedManualRows;
    }
  }

  return summary;
}

export function collapsePresetGroupBindings(options: CollapsePresetGroupBindingsOptions = {}) {
  if (options.write === true && options.dryRun === true) {
    throw new Error("--write cannot be combined with --dry-run");
  }

  const databasePath = resolveSqlitePath(options.databaseUrl);
  const db = new Database(databasePath);

  try {
    const write = options.write === true;
    return {
      dryRun: !write,
      databasePath,
      section: collapseScope(db, SECTION_SCOPE, write),
      template: collapseScope(db, TEMPLATE_SCOPE, write),
    } satisfies CollapsePresetGroupBindingsSummary;
  } finally {
    db.close();
  }
}

export function formatCollapsePresetGroupBindingsSummary(
  summary: CollapsePresetGroupBindingsSummary,
  format: CollapsePresetGroupBindingsFormat = "summary",
) {
  if (format === "json") {
    return JSON.stringify(summary, null, 2);
  }

  return [
    "Preset Group Binding Collapse",
    `dry run: ${summary.dryRun}`,
    `database: ${summary.databasePath}`,
    `section candidate groups: ${summary.section.candidateGroups}`,
    `section collapsed groups: ${summary.section.collapsedGroups}`,
    `section deleted bindings: ${summary.section.deletedBindings}`,
    `section deleted prompt blocks: ${summary.section.deletedPromptBlocks}`,
    `section moved manual loras: ${summary.section.movedManualLoras}`,
    `section skipped legacy groups: ${summary.section.skippedLegacyGroups}`,
    `section skipped missing groups: ${summary.section.skippedMissingPresetGroups}`,
    `template candidate groups: ${summary.template.candidateGroups}`,
    `template collapsed groups: ${summary.template.collapsedGroups}`,
    `template deleted bindings: ${summary.template.deletedBindings}`,
    `template deleted prompt blocks: ${summary.template.deletedPromptBlocks}`,
    `template moved manual loras: ${summary.template.movedManualLoras}`,
    `template skipped legacy groups: ${summary.template.skippedLegacyGroups}`,
    `template skipped missing groups: ${summary.template.skippedMissingPresetGroups}`,
  ].join("\n");
}

async function main() {
  const args = parseCollapsePresetGroupBindingsArgs(process.argv.slice(2));
  const summary = collapsePresetGroupBindings(args);
  console.log(formatCollapsePresetGroupBindingsSummary(summary, args.format));
}

function parseFormat(value: string): CollapsePresetGroupBindingsFormat {
  if (value === "summary" || value === "json") return value;
  throw new Error(`Unsupported --format value: ${value}`);
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function requireNonEmptyValue(value: string, flag: string): string {
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
