#!/usr/bin/env tsx
import { pathToFileURL } from "node:url";

import { diffResolvedSectionConfig } from "../../src/server/prompt-config/diff";
import { resolveSectionConfigFromRows } from "../../src/server/prompt-config/section-resolver";
import type {
  LoraStage,
  PresetCategoryRow,
  PresetRow,
  PresetVariantLinkRow,
  PresetVariantRow,
  ResolveSectionConfigInput,
  ResolvedSectionConfig,
  SectionManualLoraEntryRow,
  SectionPromptBlockRow,
  SectionPresetBindingRow,
} from "../../src/server/prompt-config/types";

type LegacyPromptBlockRow = {
  type: string;
  sourceId: string | null;
  variantId: string | null;
  categoryId: string | null;
  bindingId: string | null;
  groupBindingId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export type ZeroRedundancyMigrationFormat = "summary" | "json";
export type ZeroRedundancyMigrationProvider = "current" | "postgresql" | "sqlite";

export interface ZeroRedundancyMigrationArgs {
  dryRun: boolean;
  readOnly: boolean;
  write: boolean;
  batchSize: number;
  format: ZeroRedundancyMigrationFormat;
  provider: ZeroRedundancyMigrationProvider;
  sourceDbPath: string | null;
  verify: boolean;
  verifierArgs: string[];
}

export interface LegacyProjectRow {
  id: string;
  presetBindings?: unknown;
}

export interface LegacyProjectTemplateRow {
  id: string;
  presetBindings?: unknown;
}

export interface LegacyPresetCategoryRow {
  id: string;
  name?: string | null;
  color?: string | null;
  positivePromptOrder?: number | null;
  negativePromptOrder?: number | null;
  lora1Order?: number | null;
  lora2Order?: number | null;
  slotTemplate?: unknown;
}

export interface LegacyPresetRow {
  id: string;
  categoryId: string;
  name?: string | null;
}

export interface LegacyPresetVariantRow {
  id: string;
  presetId: string;
  name?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  lora1?: unknown;
  lora2?: unknown;
  linkedVariants?: unknown;
  sortOrder?: number | null;
  isActive?: boolean | null;
}

export interface LegacyProjectSectionRow {
  id: string;
  projectId?: string | null;
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  loraConfig?: unknown;
  aspectRatio?: string | null;
  shortSidePx?: number | null;
  batchSize?: number | null;
  seedPolicy1?: string | null;
  seedPolicy2?: string | null;
  ksampler1?: unknown;
  ksampler2?: unknown;
  upscaleFactor?: number | null;
  checkpointName?: string | null;
  extraParams?: unknown;
}

export interface LegacyPromptBlockInputRow {
  id?: string;
  projectSectionId: string;
  type: string;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  label?: string | null;
  positive?: string | null;
  negative?: string | null;
  sortOrder?: number | null;
}

export interface LegacyProjectTemplateSectionRow {
  id: string;
  projectTemplateId?: string | null;
  promptBlocks?: unknown;
  loraConfig?: unknown;
  aspectRatio?: string | null;
  shortSidePx?: number | null;
  batchSize?: number | null;
  seedPolicy1?: string | null;
  seedPolicy2?: string | null;
  ksampler1?: unknown;
  ksampler2?: unknown;
  upscaleFactor?: number | null;
  checkpointName?: string | null;
  extraParams?: unknown;
}

export interface ProjectPresetBindingInsert {
  id: string;
  projectId: string;
  categoryId: string;
  presetId: string;
  variantId: string | null;
  sortOrder: number;
}

export interface ProjectTemplatePresetBindingInsert {
  id: string;
  projectTemplateId: string;
  categoryId: string;
  presetId: string;
  variantId: string | null;
  sortOrder: number;
}

export interface PresetVariantLinkInsert {
  id: string;
  sourceVariantId: string;
  linkedVariantId: string;
  sortOrder: number;
}

export interface PresetCategorySlotInsert {
  id: string;
  categoryId: string;
  slotKey: string;
  slotCategoryId: string;
  label: string | null;
  sortOrder: number;
}

export interface SectionPresetBindingInsert {
  id: string;
  projectSectionId: string;
  bindingKey: string;
  categoryId: string;
  presetId: string;
  variantId: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
}

export interface SectionPromptBlockInsert {
  id: string;
  projectSectionId: string;
  sectionBindingId: string | null;
  type: "custom" | "preset";
  customLabel: string | null;
  customPositive: string | null;
  customNegative: string | null;
  sortOrder: number;
}

export interface SectionManualLoraEntryInsert {
  id: string;
  projectSectionId: string;
  sectionBindingId: string | null;
  stage: LoraStage;
  path: string;
  weight: number;
  enabled: boolean;
  detachedFromBindingKey: string | null;
  detachedFromPresetId: string | null;
  detachedFromVariantId: string | null;
  detachedFromPath: string | null;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
}

export interface TemplateSectionPresetBindingInsert {
  id: string;
  projectTemplateSectionId: string;
  bindingKey: string;
  categoryId: string;
  presetId: string;
  variantId: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
}

export interface TemplateSectionPromptBlockInsert {
  id: string;
  projectTemplateSectionId: string;
  templateSectionBindingId: string | null;
  type: "custom" | "preset";
  customLabel: string | null;
  customPositive: string | null;
  customNegative: string | null;
  sortOrder: number;
}

export interface TemplateSectionManualLoraEntryInsert {
  id: string;
  projectTemplateSectionId: string;
  templateSectionBindingId: string | null;
  stage: LoraStage;
  path: string;
  weight: number;
  enabled: boolean;
  detachedFromBindingKey: string | null;
  detachedFromPresetId: string | null;
  detachedFromVariantId: string | null;
  detachedFromPath: string | null;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
}

export interface ZeroRedundancyExistingRows {
  projectPresetBindings?: readonly ProjectPresetBindingInsert[];
  projectTemplatePresetBindings?: readonly ProjectTemplatePresetBindingInsert[];
  presetVariantLinks?: readonly PresetVariantLinkInsert[];
  presetCategorySlots?: readonly PresetCategorySlotInsert[];
  sectionPresetBindings?: readonly SectionPresetBindingInsert[];
  sectionPromptBlocks?: readonly SectionPromptBlockInsert[];
  sectionManualLoraEntries?: readonly SectionManualLoraEntryInsert[];
  templateSectionPresetBindings?: readonly TemplateSectionPresetBindingInsert[];
  templateSectionPromptBlocks?: readonly TemplateSectionPromptBlockInsert[];
  templateSectionManualLoraEntries?: readonly TemplateSectionManualLoraEntryInsert[];
}

export interface ZeroRedundancyMigrationRows {
  projects?: readonly LegacyProjectRow[];
  projectTemplates?: readonly LegacyProjectTemplateRow[];
  presetCategories?: readonly LegacyPresetCategoryRow[];
  presets?: readonly LegacyPresetRow[];
  presetVariants?: readonly LegacyPresetVariantRow[];
  projectSections?: readonly LegacyProjectSectionRow[];
  promptBlocks?: readonly LegacyPromptBlockInputRow[];
  projectTemplateSections?: readonly LegacyProjectTemplateSectionRow[];
  existing?: ZeroRedundancyExistingRows;
}

export interface ZeroRedundancyVerificationPair {
  id: string;
  kind: "section" | "templateSection";
  legacy: ResolvedSectionConfig;
  resolved: ResolvedSectionConfig;
}

export interface ZeroRedundancyMigrationSummary {
  sectionCount: number;
  promptBlockCount: number;
  presetBlockCount: number;
  manualDetachedLoraCount: number;
  templateSectionCount: number;
  invalidJsonRowCount: number;
  invalidReferenceCount: number;
  resolverMismatchCount: number;
  unmigratedLegacyPromptCount: number;
}

export interface ZeroRedundancyMigrationPlan extends ZeroRedundancyExistingRows {
  projectPresetBindings: ProjectPresetBindingInsert[];
  projectTemplatePresetBindings: ProjectTemplatePresetBindingInsert[];
  presetVariantLinks: PresetVariantLinkInsert[];
  presetCategorySlots: PresetCategorySlotInsert[];
  sectionPresetBindings: SectionPresetBindingInsert[];
  sectionPromptBlocks: SectionPromptBlockInsert[];
  sectionManualLoraEntries: SectionManualLoraEntryInsert[];
  templateSectionPresetBindings: TemplateSectionPresetBindingInsert[];
  templateSectionPromptBlocks: TemplateSectionPromptBlockInsert[];
  templateSectionManualLoraEntries: TemplateSectionManualLoraEntryInsert[];
  verificationPairs: ZeroRedundancyVerificationPair[];
  summary: ZeroRedundancyMigrationSummary;
}

export interface ZeroRedundancyMigrationPlanOptions {
  verificationSource?: "planned" | "existing";
}

export interface ZeroRedundancyWriteOptions {
  batchSize?: number;
  prisma?: Record<string, unknown>;
}

const ZERO_REDUNDANCY_WRITE_TRANSACTION_OPTIONS = {
  maxWait: 30_000,
  timeout: 300_000,
} as const;

type MigrationStats = {
  invalidJsonRowCount: number;
  invalidReferenceCount: number;
};

type BindingRef = {
  categoryId: string;
  presetId: string;
  variantId: string | null;
  sortOrder: number;
};

type BindingRefs = {
  categories: Map<string, PresetCategoryRow>;
  presets: Map<string, PresetRow>;
  variants: readonly PresetVariantRow[];
};

type LegacyLoraEntry = {
  id: string | null;
  path: string;
  weight: number;
  enabled: boolean;
  source: string | null;
  bindingId: string | null;
  groupBindingId: string | null;
  detachedBindingId: string | null;
  detachedGroupBindingId: string | null;
  detachedPresetPath: string | null;
  sourceName: string | null;
  sourceLabel: string | null;
  sourceColor: string | null;
  suppressed: boolean;
};

type LegacyLoraConfig = Record<LoraStage, LegacyLoraEntry[]>;

const DEFAULT_BATCH_SIZE = 500;

export function parseZeroRedundancyMigrationArgs(
  argv: readonly string[],
): ZeroRedundancyMigrationArgs {
  let dryRun = false;
  let readOnly = false;
  let write = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let format: ZeroRedundancyMigrationFormat = "summary";
  let provider: ZeroRedundancyMigrationProvider = "current";
  let sourceDbPath: string | null = null;
  let verify = false;
  const verifierArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--read-only") {
      readOnly = true;
    } else if (arg === "--write") {
      write = true;
    } else if (arg === "--batch-size") {
      batchSize = parseBatchSize(requireValue(argv, (index += 1), "--batch-size"));
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = parseBatchSize(arg.slice("--batch-size=".length));
    } else if (arg === "--format") {
      format = parseMigrationFormat(requireValue(argv, (index += 1), "--format"));
    } else if (arg.startsWith("--format=")) {
      format = parseMigrationFormat(arg.slice("--format=".length));
    } else if (arg === "--provider") {
      provider = parseMigrationProvider(requireValue(argv, (index += 1), "--provider"));
    } else if (arg.startsWith("--provider=")) {
      provider = parseMigrationProvider(arg.slice("--provider=".length));
    } else if (arg === "--source-db" || arg === "--source-db-path") {
      sourceDbPath = requireValue(argv, (index += 1), arg);
    } else if (arg.startsWith("--source-db=")) {
      sourceDbPath = requireNonEmptyValue(arg.slice("--source-db=".length), "--source-db");
    } else if (arg.startsWith("--source-db-path=")) {
      sourceDbPath = requireNonEmptyValue(arg.slice("--source-db-path=".length), "--source-db-path");
    } else if (arg === "--verify") {
      verify = true;
    } else if (arg === "--verifier-arg") {
      verifierArgs.push(requireValue(argv, (index += 1), "--verifier-arg"));
    } else if (arg.startsWith("--verifier-arg=")) {
      verifierArgs.push(requireNonEmptyValue(arg.slice("--verifier-arg=".length), "--verifier-arg"));
    } else {
      throw new Error(`Unknown zero redundancy migration argument: ${arg}`);
    }
  }

  if (write && (dryRun || readOnly)) {
    throw new Error("--write cannot be combined with --dry-run or --read-only");
  }

  return { dryRun, readOnly, write, batchSize, format, provider, sourceDbPath, verify, verifierArgs };
}

export function buildZeroRedundancyMigrationPlan(
  rows: ZeroRedundancyMigrationRows,
  options: ZeroRedundancyMigrationPlanOptions = {},
): ZeroRedundancyMigrationPlan {
  const stats: MigrationStats = { invalidJsonRowCount: 0, invalidReferenceCount: 0 };
  const categories = normalizeCategories(rows.presetCategories ?? []);
  const presets = normalizePresets(rows.presets ?? []);
  const variants = normalizeVariants(rows.presetVariants ?? []);
  const bindingRefs = { categories, presets, variants };
  const variantLinks = buildPresetVariantLinks(rows.presetVariants ?? [], variants, stats);
  const categorySlots = buildPresetCategorySlots(rows.presetCategories ?? [], categories, stats);
  const projectPresetBindings = buildProjectPresetBindings(rows.projects ?? [], stats, bindingRefs);
  const projectTemplatePresetBindings = buildProjectTemplatePresetBindings(rows.projectTemplates ?? [], stats, bindingRefs);
  const sectionResult = buildSectionMigrationRows({
    sections: rows.projectSections ?? [],
    promptBlocks: rows.promptBlocks ?? [],
    categories,
    presets,
    variants,
    variantLinks,
    stats,
  });
  const templateResult = buildTemplateSectionMigrationRows({
    templateSections: rows.projectTemplateSections ?? [],
    categories,
    presets,
    variants,
    variantLinks,
    stats,
  });
  const existing = rows.existing ?? {};
  applyExistingSectionBindingIds(sectionResult, existing.sectionPresetBindings);
  applyExistingTemplateSectionBindingIds(templateResult, existing.templateSectionPresetBindings);
  const plannedRows: Required<ZeroRedundancyExistingRows> = {
    projectPresetBindings,
    projectTemplatePresetBindings,
    presetVariantLinks: variantLinks,
    presetCategorySlots: categorySlots,
    sectionPresetBindings: sectionResult.sectionPresetBindings,
    sectionPromptBlocks: sectionResult.sectionPromptBlocks,
    sectionManualLoraEntries: sectionResult.sectionManualLoraEntries,
    templateSectionPresetBindings: templateResult.templateSectionPresetBindings,
    templateSectionPromptBlocks: templateResult.templateSectionPromptBlocks,
    templateSectionManualLoraEntries: templateResult.templateSectionManualLoraEntries,
  };
  const useExistingVerification = options.verificationSource === "existing";
  const effective: Required<ZeroRedundancyExistingRows> = useExistingVerification
    ? cloneExistingRows(existing)
    : mergeExistingWithPlannedRows(existing, plannedRows);
  const verificationPairs = [
    ...buildSectionVerificationPairs({
      sections: rows.projectSections ?? [],
      legacyPromptBlocks: rows.promptBlocks ?? [],
      normalizedPresetBindings: effective.sectionPresetBindings,
      normalizedPromptBlocks: effective.sectionPromptBlocks,
      normalizedManualLoras: effective.sectionManualLoraEntries,
      categories,
      presets,
      variants,
      variantLinks: effective.presetVariantLinks,
      stats: { invalidJsonRowCount: 0, invalidReferenceCount: 0 },
    }),
    ...buildTemplateVerificationPairs({
      templateSections: rows.projectTemplateSections ?? [],
      normalizedPresetBindings: effective.templateSectionPresetBindings,
      normalizedPromptBlocks: effective.templateSectionPromptBlocks,
      normalizedManualLoras: effective.templateSectionManualLoraEntries,
      categories,
      presets,
      variants,
      variantLinks: effective.presetVariantLinks,
      stats: { invalidJsonRowCount: 0, invalidReferenceCount: 0 },
    }),
  ];
  const resolverMismatchCount = verificationPairs.reduce(
    (total, pair) => total + (diffResolvedSectionConfig(pair.legacy, pair.resolved).length > 0 ? 1 : 0),
    0,
  );

  return {
    projectPresetBindings: rejectExisting(
      projectPresetBindings,
      existing.projectPresetBindings,
      (row) => `${row.projectId}:${row.categoryId}`,
    ),
    projectTemplatePresetBindings: rejectExisting(
      projectTemplatePresetBindings,
      existing.projectTemplatePresetBindings,
      (row) => `${row.projectTemplateId}:${row.categoryId}`,
    ),
    presetVariantLinks: rejectExisting(
      variantLinks,
      existing.presetVariantLinks,
      (row) => `${row.sourceVariantId}:${row.linkedVariantId}`,
    ),
    presetCategorySlots: rejectExisting(
      categorySlots,
      existing.presetCategorySlots,
      (row) => `${row.categoryId}:${row.slotKey}`,
    ),
    sectionPresetBindings: rejectExisting(
      sectionResult.sectionPresetBindings,
      existing.sectionPresetBindings,
      (row) => `${row.projectSectionId}:${row.bindingKey}`,
    ),
    sectionPromptBlocks: rejectExisting(
      sectionResult.sectionPromptBlocks,
      existing.sectionPromptBlocks,
      (row) => row.id,
    ),
    sectionManualLoraEntries: rejectExisting(
      sectionResult.sectionManualLoraEntries,
      existing.sectionManualLoraEntries,
      (row) => row.id,
    ),
    templateSectionPresetBindings: rejectExisting(
      templateResult.templateSectionPresetBindings,
      existing.templateSectionPresetBindings,
      (row) => `${row.projectTemplateSectionId}:${row.bindingKey}`,
    ),
    templateSectionPromptBlocks: rejectExisting(
      templateResult.templateSectionPromptBlocks,
      existing.templateSectionPromptBlocks,
      (row) => row.id,
    ),
    templateSectionManualLoraEntries: rejectExisting(
      templateResult.templateSectionManualLoraEntries,
      existing.templateSectionManualLoraEntries,
      (row) => row.id,
    ),
    verificationPairs,
    summary: {
      sectionCount: sectionResult.touchedSectionIds.size,
      promptBlockCount: sectionResult.sectionPromptBlocks.length + templateResult.templateSectionPromptBlocks.length,
      presetBlockCount: sectionResult.presetBlockCount + templateResult.presetBlockCount,
      manualDetachedLoraCount:
        sectionResult.sectionManualLoraEntries.length + templateResult.templateSectionManualLoraEntries.length,
      templateSectionCount: templateResult.touchedTemplateSectionIds.size,
      invalidJsonRowCount: stats.invalidJsonRowCount,
      invalidReferenceCount: stats.invalidReferenceCount,
      resolverMismatchCount,
      unmigratedLegacyPromptCount: sectionResult.legacyPromptCount + templateResult.legacyPromptCount,
    },
  };
}

export function formatZeroRedundancyMigrationSummary(
  plan: ZeroRedundancyMigrationPlan,
  format: ZeroRedundancyMigrationFormat,
): string {
  if (format === "json") {
    return JSON.stringify(plan, null, 2);
  }

  return [
    "Zero Redundancy Migration",
    `sections: ${plan.summary.sectionCount}`,
    `prompt blocks: ${plan.summary.promptBlockCount}`,
    `preset blocks: ${plan.summary.presetBlockCount}`,
    `manual/detached lora: ${plan.summary.manualDetachedLoraCount}`,
    `template sections: ${plan.summary.templateSectionCount}`,
    `invalid JSON rows: ${plan.summary.invalidJsonRowCount}`,
    `invalid references: ${plan.summary.invalidReferenceCount}`,
    `resolver mismatches: ${plan.summary.resolverMismatchCount}`,
    `legacy section prompts preserved: ${plan.summary.unmigratedLegacyPromptCount}`,
    `project preset bindings to write: ${plan.projectPresetBindings.length}`,
    `section bindings to write: ${plan.sectionPresetBindings.length}`,
  ].join("\n");
}

export function assertZeroRedundancyMigrationPlanCanWrite(plan: ZeroRedundancyMigrationPlan): void {
  if (plan.summary.invalidJsonRowCount > 0) {
    throw new Error(
      `Refusing to write zero-redundancy migration with ${plan.summary.invalidJsonRowCount} invalid JSON row(s). Fix malformed legacy JSON before --write.`,
    );
  }
  if (plan.summary.invalidReferenceCount > 0) {
    throw new Error(
      `Refusing to write zero-redundancy migration with ${plan.summary.invalidReferenceCount} invalid reference(s). Fix or safely preserve legacy refs before --write.`,
    );
  }
  if (plan.summary.resolverMismatchCount > 0) {
    throw new Error(
      `Refusing to write zero-redundancy migration with ${plan.summary.resolverMismatchCount} resolver mismatch(es). Run the verifier and fix mismatches before --write.`,
    );
  }
}

export function migrationPlanExitCode(plan: ZeroRedundancyMigrationPlan): 0 | 1 {
  return plan.summary.invalidJsonRowCount > 0 ||
    plan.summary.invalidReferenceCount > 0 ||
    plan.summary.resolverMismatchCount > 0
    ? 1
    : 0;
}

export async function runZeroRedundancyMigrationCli(
  argv = process.argv.slice(2),
): Promise<number> {
  const args = parseZeroRedundancyMigrationArgs(argv);
  const rows = await readZeroRedundancyMigrationRowsFromDb();
  const plan = buildZeroRedundancyMigrationPlan(rows);

  if (args.write) {
    assertZeroRedundancyMigrationPlanCanWrite(plan);
    await writeZeroRedundancyMigrationPlan(plan, { batchSize: args.batchSize });
  }

  console.log(formatZeroRedundancyMigrationSummary(plan, args.format));
  return migrationPlanExitCode(plan);
}

export async function readZeroRedundancyMigrationRowsFromDb(): Promise<ZeroRedundancyMigrationRows> {
  const { prisma } = await import("../../src/lib/prisma");
  const db = prisma as unknown as Record<string, unknown>;

  const [
    projects,
    projectTemplates,
    presetCategories,
    presets,
    presetVariants,
    projectSections,
    promptBlocks,
    projectTemplateSections,
    projectPresetBindings,
    projectTemplatePresetBindings,
    presetVariantLinks,
    presetCategorySlots,
    sectionPresetBindings,
    sectionPromptBlocks,
    sectionManualLoraEntries,
    templateSectionPresetBindings,
    templateSectionPromptBlocks,
    templateSectionManualLoraEntries,
  ] = await Promise.all([
    findMany(db, "project", {
      select: { id: true },
    }),
    findMany(db, "projectTemplate", {
      select: { id: true },
    }),
    findMany(db, "presetCategory", {
      select: {
        id: true,
        name: true,
        color: true,
        positivePromptOrder: true,
        negativePromptOrder: true,
        lora1Order: true,
        lora2Order: true,
      },
    }),
    findMany(db, "preset", {
      select: { id: true, categoryId: true, name: true },
    }),
    findMany(db, "presetVariant", {
      select: {
        id: true,
        presetId: true,
        name: true,
        prompt: true,
        negativePrompt: true,
        lora1: true,
        lora2: true,
        sortOrder: true,
        isActive: true,
      },
    }),
    findMany(db, "projectSection", {
      select: {
        id: true,
        projectId: true,
        aspectRatio: true,
        shortSidePx: true,
        batchSize: true,
        seedPolicy1: true,
        seedPolicy2: true,
        ksampler1: true,
        ksampler2: true,
        upscaleFactor: true,
        checkpointName: true,
        extraParams: true,
      },
    }),
    findMany(db, "promptBlock", {
      select: {
        id: true,
        projectSectionId: true,
        type: true,
        sourceId: true,
        variantId: true,
        categoryId: true,
        bindingId: true,
        groupBindingId: true,
        label: true,
        positive: true,
        negative: true,
        sortOrder: true,
      },
    }),
    findMany(db, "projectTemplateSection", {
      select: {
        id: true,
        projectTemplateId: true,
        aspectRatio: true,
        shortSidePx: true,
        batchSize: true,
        seedPolicy1: true,
        seedPolicy2: true,
        ksampler1: true,
        ksampler2: true,
        upscaleFactor: true,
        checkpointName: true,
        extraParams: true,
      },
    }),
    findMany(db, "projectPresetBinding"),
    findMany(db, "projectTemplatePresetBinding"),
    findMany(db, "presetVariantLink"),
    findMany(db, "presetCategorySlot"),
    findMany(db, "sectionPresetBinding"),
    findMany(db, "sectionPromptBlock"),
    findMany(db, "sectionManualLoraEntry"),
    findMany(db, "templateSectionPresetBinding"),
    findMany(db, "templateSectionPromptBlock"),
    findMany(db, "templateSectionManualLoraEntry"),
  ]);

  return {
    projects: projects as LegacyProjectRow[],
    projectTemplates: projectTemplates as LegacyProjectTemplateRow[],
    presetCategories: presetCategories as LegacyPresetCategoryRow[],
    presets: presets as LegacyPresetRow[],
    presetVariants: presetVariants as LegacyPresetVariantRow[],
    projectSections: projectSections as LegacyProjectSectionRow[],
    promptBlocks: promptBlocks as LegacyPromptBlockInputRow[],
    projectTemplateSections: projectTemplateSections as LegacyProjectTemplateSectionRow[],
    existing: {
      projectPresetBindings: projectPresetBindings as ProjectPresetBindingInsert[],
      projectTemplatePresetBindings: projectTemplatePresetBindings as ProjectTemplatePresetBindingInsert[],
      presetVariantLinks: presetVariantLinks as PresetVariantLinkInsert[],
      presetCategorySlots: presetCategorySlots as PresetCategorySlotInsert[],
      sectionPresetBindings: sectionPresetBindings as SectionPresetBindingInsert[],
      sectionPromptBlocks: sectionPromptBlocks as SectionPromptBlockInsert[],
      sectionManualLoraEntries: sectionManualLoraEntries as SectionManualLoraEntryInsert[],
      templateSectionPresetBindings: templateSectionPresetBindings as TemplateSectionPresetBindingInsert[],
      templateSectionPromptBlocks: templateSectionPromptBlocks as TemplateSectionPromptBlockInsert[],
      templateSectionManualLoraEntries: templateSectionManualLoraEntries as TemplateSectionManualLoraEntryInsert[],
    },
  };
}

export async function writeZeroRedundancyMigrationPlan(
  plan: ZeroRedundancyMigrationPlan,
  options: ZeroRedundancyWriteOptions | number = DEFAULT_BATCH_SIZE,
): Promise<void> {
  const { batchSize, prisma } = normalizeWriteOptions(options);
  const db = prisma ?? await loadPrismaWriteClient();
  assertWriteClientReady(db, plan);

  const transaction = db.$transaction as (
    callback: (tx: Record<string, unknown>) => Promise<void>,
    options?: typeof ZERO_REDUNDANCY_WRITE_TRANSACTION_OPTIONS,
  ) => Promise<void>;
  await transaction(async (tx) => {
    assertWriteDelegatesReady(tx, plan);

    await writeRows(plan.projectPresetBindings, batchSize, (row) =>
      upsert(tx, "projectPresetBinding", {
        where: { projectId_categoryId: { projectId: row.projectId, categoryId: row.categoryId } },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.projectTemplatePresetBindings, batchSize, (row) =>
      upsert(tx, "projectTemplatePresetBinding", {
        where: {
          projectTemplateId_categoryId: {
            projectTemplateId: row.projectTemplateId,
            categoryId: row.categoryId,
          },
        },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.presetVariantLinks, batchSize, (row) =>
      upsert(tx, "presetVariantLink", {
        where: {
          sourceVariantId_linkedVariantId: {
            sourceVariantId: row.sourceVariantId,
            linkedVariantId: row.linkedVariantId,
          },
        },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.presetCategorySlots, batchSize, (row) =>
      upsert(tx, "presetCategorySlot", {
        where: { categoryId_slotKey: { categoryId: row.categoryId, slotKey: row.slotKey } },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.sectionPresetBindings, batchSize, (row) =>
      upsert(tx, "sectionPresetBinding", {
        where: {
          projectSectionId_bindingKey: {
            projectSectionId: row.projectSectionId,
            bindingKey: row.bindingKey,
          },
        },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.sectionPromptBlocks, batchSize, (row) =>
      upsert(tx, "sectionPromptBlock", {
        where: { id: row.id },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.sectionManualLoraEntries, batchSize, (row) =>
      upsert(tx, "sectionManualLoraEntry", {
        where: { id: row.id },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.templateSectionPresetBindings, batchSize, (row) =>
      upsert(tx, "templateSectionPresetBinding", {
        where: {
          projectTemplateSectionId_bindingKey: {
            projectTemplateSectionId: row.projectTemplateSectionId,
            bindingKey: row.bindingKey,
          },
        },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.templateSectionPromptBlocks, batchSize, (row) =>
      upsert(tx, "templateSectionPromptBlock", {
        where: { id: row.id },
        create: row,
        update: writeData(row),
      }),
    );
    await writeRows(plan.templateSectionManualLoraEntries, batchSize, (row) =>
      upsert(tx, "templateSectionManualLoraEntry", {
        where: { id: row.id },
        create: row,
        update: writeData(row),
      }),
    );
  }, ZERO_REDUNDANCY_WRITE_TRANSACTION_OPTIONS);
}

function buildProjectPresetBindings(
  projects: readonly LegacyProjectRow[],
  stats: MigrationStats,
  refs: BindingRefs,
): ProjectPresetBindingInsert[] {
  return projects.flatMap((project) =>
    parseBindingRefs(project.presetBindings, stats, "Project.presetBindings", project.id)
      .flatMap((binding) => {
        const validBinding = validateBindingRef(binding, refs, stats);
        if (!validBinding) return [];
        return [{
          id: `projectPresetBinding:${project.id}:${validBinding.categoryId}`,
          projectId: project.id,
          categoryId: validBinding.categoryId,
          presetId: validBinding.presetId,
          variantId: validBinding.variantId,
          sortOrder: validBinding.sortOrder,
        }];
      }),
  );
}

function buildProjectTemplatePresetBindings(
  templates: readonly LegacyProjectTemplateRow[],
  stats: MigrationStats,
  refs: BindingRefs,
): ProjectTemplatePresetBindingInsert[] {
  return templates.flatMap((template) =>
    parseBindingRefs(template.presetBindings, stats, "ProjectTemplate.presetBindings", template.id)
      .flatMap((binding) => {
        const validBinding = validateBindingRef(binding, refs, stats);
        if (!validBinding) return [];
        return [{
          id: `projectTemplatePresetBinding:${template.id}:${validBinding.categoryId}`,
          projectTemplateId: template.id,
          categoryId: validBinding.categoryId,
          presetId: validBinding.presetId,
          variantId: validBinding.variantId,
          sortOrder: validBinding.sortOrder,
        }];
      }),
  );
}

function buildPresetVariantLinks(
  variants: readonly LegacyPresetVariantRow[],
  normalizedVariants: readonly PresetVariantRow[],
  stats: MigrationStats,
): PresetVariantLinkInsert[] {
  const variantsById = new Map(normalizedVariants.map((variant) => [variant.id, variant]));
  return variants.flatMap((variant) =>
    readJsonArray(variant.linkedVariants, stats, "PresetVariant.linkedVariants", variant.id).flatMap((entry, index) => {
      if (!isRecord(entry)) return [];
      const linkedVariantId = readString(entry.variantId) ?? readString(entry.linkedVariantId);
      if (!linkedVariantId) return [];
      const sourceVariant = variantsById.get(variant.id);
      const linkedVariant = variantsById.get(linkedVariantId);
      if (!sourceVariant || sourceVariant.isActive === false || !linkedVariant || linkedVariant.isActive === false) {
        stats.invalidReferenceCount += 1;
        return [];
      }
      return [{
        id: `presetVariantLink:${variant.id}:${linkedVariantId}`,
        sourceVariantId: variant.id,
        linkedVariantId,
        sortOrder: readNumber(entry.sortOrder) ?? index,
      }];
    }),
  );
}

function buildPresetCategorySlots(
  categories: readonly LegacyPresetCategoryRow[],
  categoryRefs: Map<string, PresetCategoryRow>,
  stats: MigrationStats,
): PresetCategorySlotInsert[] {
  return categories.flatMap((category) =>
    readJsonArray(category.slotTemplate, stats, "PresetCategory.slotTemplate", category.id).flatMap((entry, index) => {
      if (!isRecord(entry)) return [];
      const slotCategoryId = readString(entry.slotCategoryId) ?? readString(entry.categoryId);
      const slotKey = readString(entry.slotKey) ??
        readString(entry.key) ??
        readString(entry.id) ??
        readString(entry.label) ??
        slotCategoryId;
      if (!slotCategoryId || !slotKey) return [];
      if (!categoryRefs.has(slotCategoryId)) {
        stats.invalidReferenceCount += 1;
        return [];
      }
      return [{
        id: `presetCategorySlot:${category.id}:${slotKey}`,
        categoryId: category.id,
        slotKey,
        slotCategoryId,
        label: readString(entry.label),
        sortOrder: readNumber(entry.sortOrder) ?? index,
      }];
    }),
  );
}

function buildSectionMigrationRows(input: {
  sections: readonly LegacyProjectSectionRow[];
  promptBlocks: readonly LegacyPromptBlockInputRow[];
  categories: Map<string, PresetCategoryRow>;
  presets: Map<string, PresetRow>;
  variants: PresetVariantRow[];
  variantLinks: PresetVariantLinkInsert[];
  stats: MigrationStats;
}) {
  const sectionPresetBindings: SectionPresetBindingInsert[] = [];
  const sectionPromptBlocks: SectionPromptBlockInsert[] = [];
  const sectionManualLoraEntries: SectionManualLoraEntryInsert[] = [];
  const touchedSectionIds = new Set<string>();
  let presetBlockCount = 0;
  let legacyPromptCount = 0;
  const blocksBySection = groupBy(input.promptBlocks, (block) => block.projectSectionId);

  for (const section of input.sections) {
    const legacyBlocks = sortLegacyBlocks(blocksBySection.get(section.id) ?? []);
    const bindingByKey = new Map<string, SectionPresetBindingInsert>();
    let maxSortOrder = legacyBlocks.reduce((max, block) => Math.max(max, readNumber(block.sortOrder) ?? 0), -1);

    for (const block of legacyBlocks) {
      touchedSectionIds.add(section.id);
      if (block.type === "preset" && block.sourceId) {
        const binding = sectionBindingFromBlock(section.id, block, {
          categories: input.categories,
          presets: input.presets,
          variants: input.variants,
        });
        if (!binding) {
          legacyPromptCount += 1;
          sectionPromptBlocks.push(sectionCustomPromptBlockFromLegacyBlock(
            section.id,
            block,
            sectionPromptBlocks.length,
          ));
          continue;
        }
        bindingByKey.set(binding.bindingKey, binding);
        upsertByKey(sectionPresetBindings, binding, (row) => `${row.projectSectionId}:${row.bindingKey}`);

        const bindingRow = toSectionBindingRow(binding, input.categories, input.presets);
        const cleanBlock = bindingRow
          ? resolveSinglePresetPromptBlock(section, bindingRow, input.variants, input.variantLinks)
          : null;
        const custom = diffLegacyPresetBlock(block, cleanBlock);
        sectionPromptBlocks.push({
          id: `sectionPromptBlock:${section.id}:${binding.bindingKey}`,
          projectSectionId: section.id,
          sectionBindingId: binding.id,
          type: "preset",
          customLabel: custom.customLabel,
          customPositive: custom.customPositive,
          customNegative: custom.customNegative,
          sortOrder: readNumber(block.sortOrder) ?? 0,
        });
        presetBlockCount += 1;
      } else {
        sectionPromptBlocks.push(sectionCustomPromptBlockFromLegacyBlock(section.id, block, sectionPromptBlocks.length));
      }
    }

    if (hasText(section.positivePrompt) || hasText(section.negativePrompt)) {
      touchedSectionIds.add(section.id);
      legacyPromptCount += 1;
      maxSortOrder += 1;
      sectionPromptBlocks.push({
        id: `sectionPromptBlock:${section.id}:legacy-section-prompt`,
        projectSectionId: section.id,
        sectionBindingId: null,
        type: "custom",
        customLabel: "Legacy section prompt",
        customPositive: normalizeNullableText(section.positivePrompt) ?? "",
        customNegative: normalizeNullableText(section.negativePrompt),
        sortOrder: maxSortOrder,
      });
    }

    const bindingRows = [...bindingByKey.values()]
      .map((binding) => toSectionBindingRow(binding, input.categories, input.presets))
      .filter((binding): binding is SectionPresetBindingRow => Boolean(binding));
    const cleanLoraKeys = buildCleanLoraKeys(section, bindingRows, input.variants, input.variantLinks);
    const loraConfig = parseLegacyLoraConfig(section.loraConfig, input.stats, "ProjectSection.loraConfig", section.id);
    for (const stage of ["lora1", "lora2"] as const) {
      loraConfig[stage].forEach((entry, index) => {
        const bindingKey = entry.detachedBindingId ?? entry.bindingId;
        const binding = bindingKey ? bindingByKey.get(bindingKey) ?? null : null;
        const isCleanPreset = entry.source === "preset" &&
          !entry.detachedBindingId &&
          !entry.detachedPresetPath &&
          !entry.suppressed &&
          cleanLoraKeys.has(loraKey(stage, entry.bindingId, entry.path, entry.weight, entry.enabled));
        if (isCleanPreset) return;
        if (isUnboundCleanPresetLora(entry, binding)) {
          input.stats.invalidReferenceCount += 1;
          return;
        }

        touchedSectionIds.add(section.id);
        sectionManualLoraEntries.push({
          id: `sectionManualLoraEntry:${section.id}:${stage}:${entry.id ?? index}:${entry.path}`,
          projectSectionId: section.id,
          sectionBindingId: binding?.id ?? null,
          stage,
          path: entry.path,
          weight: entry.weight,
          enabled: entry.suppressed ? false : entry.enabled,
          detachedFromBindingKey: entry.detachedBindingId ?? (entry.source === "preset" ? entry.bindingId : null),
          detachedFromPresetId: binding?.presetId ?? null,
          detachedFromVariantId: binding?.variantId ?? null,
          detachedFromPath: entry.detachedPresetPath ?? (entry.source === "preset" ? entry.path : null),
          metadata: loraMetadata(entry),
          sortOrder: 1000 + index,
        });
      });
    }
  }

  return {
    sectionPresetBindings,
    sectionPromptBlocks,
    sectionManualLoraEntries,
    touchedSectionIds,
    presetBlockCount,
    legacyPromptCount,
  };
}

function buildTemplateSectionMigrationRows(input: {
  templateSections: readonly LegacyProjectTemplateSectionRow[];
  categories: Map<string, PresetCategoryRow>;
  presets: Map<string, PresetRow>;
  variants: PresetVariantRow[];
  variantLinks: PresetVariantLinkInsert[];
  stats: MigrationStats;
}) {
  const templateSectionPresetBindings: TemplateSectionPresetBindingInsert[] = [];
  const templateSectionPromptBlocks: TemplateSectionPromptBlockInsert[] = [];
  const templateSectionManualLoraEntries: TemplateSectionManualLoraEntryInsert[] = [];
  const touchedTemplateSectionIds = new Set<string>();
  let presetBlockCount = 0;
  let legacyPromptCount = 0;

  for (const section of input.templateSections) {
    const legacyBlocks = sortLegacyBlocks(
      readJsonArray(section.promptBlocks, input.stats, "ProjectTemplateSection.promptBlocks", section.id)
        .flatMap((block, index) => templatePromptBlockInput(section.id, block, index)),
    );
    const bindingByKey = new Map<string, TemplateSectionPresetBindingInsert>();

    for (const block of legacyBlocks) {
      touchedTemplateSectionIds.add(section.id);
      if (block.type === "preset" && block.sourceId) {
        const binding = templateSectionBindingFromBlock(section.id, block, {
          categories: input.categories,
          presets: input.presets,
          variants: input.variants,
        });
        if (!binding) {
          legacyPromptCount += 1;
          templateSectionPromptBlocks.push(templateCustomPromptBlockFromLegacyBlock(
            section.id,
            block,
            templateSectionPromptBlocks.length,
          ));
          continue;
        }
        bindingByKey.set(binding.bindingKey, binding);
        upsertByKey(
          templateSectionPresetBindings,
          binding,
          (row) => `${row.projectTemplateSectionId}:${row.bindingKey}`,
        );

        const bindingRow = toSectionBindingRow(
          templateBindingToSectionBinding(binding),
          input.categories,
          input.presets,
        );
        const cleanBlock = bindingRow
          ? resolveSinglePresetPromptBlock(templateSectionAsSection(section), bindingRow, input.variants, input.variantLinks)
          : null;
        const custom = diffLegacyPresetBlock(block, cleanBlock);
        templateSectionPromptBlocks.push({
          id: `templateSectionPromptBlock:${section.id}:${binding.bindingKey}`,
          projectTemplateSectionId: section.id,
          templateSectionBindingId: binding.id,
          type: "preset",
          customLabel: custom.customLabel,
          customPositive: custom.customPositive,
          customNegative: custom.customNegative,
          sortOrder: readNumber(block.sortOrder) ?? 0,
        });
        presetBlockCount += 1;
      } else {
        templateSectionPromptBlocks.push(templateCustomPromptBlockFromLegacyBlock(
          section.id,
          block,
          templateSectionPromptBlocks.length,
        ));
      }
    }

    const bindingRows = [...bindingByKey.values()]
      .map((binding) => toSectionBindingRow(templateBindingToSectionBinding(binding), input.categories, input.presets))
      .filter((binding): binding is SectionPresetBindingRow => Boolean(binding));
    const cleanLoraKeys = buildCleanLoraKeys(templateSectionAsSection(section), bindingRows, input.variants, input.variantLinks);
    const loraConfig = parseLegacyLoraConfig(
      section.loraConfig,
      input.stats,
      "ProjectTemplateSection.loraConfig",
      section.id,
    );
    for (const stage of ["lora1", "lora2"] as const) {
      loraConfig[stage].forEach((entry, index) => {
        const bindingKey = entry.detachedBindingId ?? entry.bindingId;
        const binding = bindingKey ? bindingByKey.get(bindingKey) ?? null : null;
        const isCleanPreset = entry.source === "preset" &&
          !entry.detachedBindingId &&
          !entry.detachedPresetPath &&
          !entry.suppressed &&
          cleanLoraKeys.has(loraKey(stage, entry.bindingId, entry.path, entry.weight, entry.enabled));
        if (isCleanPreset) return;
        if (isUnboundCleanPresetLora(entry, binding)) {
          input.stats.invalidReferenceCount += 1;
          return;
        }

        touchedTemplateSectionIds.add(section.id);
        templateSectionManualLoraEntries.push({
          id: `templateSectionManualLoraEntry:${section.id}:${stage}:${entry.id ?? index}:${entry.path}`,
          projectTemplateSectionId: section.id,
          templateSectionBindingId: binding?.id ?? null,
          stage,
          path: entry.path,
          weight: entry.weight,
          enabled: entry.suppressed ? false : entry.enabled,
          detachedFromBindingKey: entry.detachedBindingId ?? (entry.source === "preset" ? entry.bindingId : null),
          detachedFromPresetId: binding?.presetId ?? null,
          detachedFromVariantId: binding?.variantId ?? null,
          detachedFromPath: entry.detachedPresetPath ?? (entry.source === "preset" ? entry.path : null),
          metadata: loraMetadata(entry),
          sortOrder: 1000 + index,
        });
      });
    }
  }

  return {
    templateSectionPresetBindings,
    templateSectionPromptBlocks,
    templateSectionManualLoraEntries,
    touchedTemplateSectionIds,
    presetBlockCount,
    legacyPromptCount,
  };
}

function applyExistingSectionBindingIds(
  result: {
    sectionPresetBindings: SectionPresetBindingInsert[];
    sectionPromptBlocks: SectionPromptBlockInsert[];
    sectionManualLoraEntries: SectionManualLoraEntryInsert[];
  },
  existingBindings: readonly SectionPresetBindingInsert[] | undefined,
): void {
  const idByPlannedId = existingSectionBindingIdByPlannedId(
    result.sectionPresetBindings,
    existingBindings,
    (binding) => `${binding.projectSectionId}:${binding.bindingKey}`,
  );
  if (idByPlannedId.size === 0) return;

  for (const binding of result.sectionPresetBindings) {
    binding.id = idByPlannedId.get(binding.id) ?? binding.id;
  }
  for (const block of result.sectionPromptBlocks) {
    block.sectionBindingId = block.sectionBindingId ? idByPlannedId.get(block.sectionBindingId) ?? block.sectionBindingId : null;
  }
  for (const entry of result.sectionManualLoraEntries) {
    entry.sectionBindingId = entry.sectionBindingId ? idByPlannedId.get(entry.sectionBindingId) ?? entry.sectionBindingId : null;
  }
}

function applyExistingTemplateSectionBindingIds(
  result: {
    templateSectionPresetBindings: TemplateSectionPresetBindingInsert[];
    templateSectionPromptBlocks: TemplateSectionPromptBlockInsert[];
    templateSectionManualLoraEntries: TemplateSectionManualLoraEntryInsert[];
  },
  existingBindings: readonly TemplateSectionPresetBindingInsert[] | undefined,
): void {
  const idByPlannedId = existingSectionBindingIdByPlannedId(
    result.templateSectionPresetBindings,
    existingBindings,
    (binding) => `${binding.projectTemplateSectionId}:${binding.bindingKey}`,
  );
  if (idByPlannedId.size === 0) return;

  for (const binding of result.templateSectionPresetBindings) {
    binding.id = idByPlannedId.get(binding.id) ?? binding.id;
  }
  for (const block of result.templateSectionPromptBlocks) {
    block.templateSectionBindingId = block.templateSectionBindingId
      ? idByPlannedId.get(block.templateSectionBindingId) ?? block.templateSectionBindingId
      : null;
  }
  for (const entry of result.templateSectionManualLoraEntries) {
    entry.templateSectionBindingId = entry.templateSectionBindingId
      ? idByPlannedId.get(entry.templateSectionBindingId) ?? entry.templateSectionBindingId
      : null;
  }
}

function existingSectionBindingIdByPlannedId<T extends { id: string }>(
  plannedBindings: readonly T[],
  existingBindings: readonly T[] | undefined,
  keyFn: (binding: T) => string,
): Map<string, string> {
  const existingByKey = new Map((existingBindings ?? []).map((binding) => [keyFn(binding), binding]));
  const idByPlannedId = new Map<string, string>();

  for (const binding of plannedBindings) {
    const existing = existingByKey.get(keyFn(binding));
    if (existing && existing.id !== binding.id) {
      idByPlannedId.set(binding.id, existing.id);
    }
  }

  return idByPlannedId;
}

function buildSectionVerificationPairs(input: {
  sections: readonly LegacyProjectSectionRow[];
  legacyPromptBlocks: readonly LegacyPromptBlockInputRow[];
  normalizedPresetBindings: readonly SectionPresetBindingInsert[];
  normalizedPromptBlocks: readonly SectionPromptBlockInsert[];
  normalizedManualLoras: readonly SectionManualLoraEntryInsert[];
  categories: Map<string, PresetCategoryRow>;
  presets: Map<string, PresetRow>;
  variants: PresetVariantRow[];
  variantLinks: readonly PresetVariantLinkRow[];
  stats: MigrationStats;
}): ZeroRedundancyVerificationPair[] {
  const blocksBySection = groupBy(input.legacyPromptBlocks, (block) => block.projectSectionId);
  return input.sections.flatMap((section) => {
    const legacyPromptBlocks = legacyPromptBlocksForVerification(
      section,
      blocksBySection.get(section.id) ?? [],
      {
        isMigratablePresetBlock: (block) => isMigratableLegacyPresetBlock(block, {
          categories: input.categories,
          presets: input.presets,
          variants: input.variants,
        }),
        categoryOrderForBlock: (block) => legacyPresetBlockCategoryOrder(block, input.categories, input.presets),
      },
    );
    const legacy = legacyResolvedSectionConfig(section, legacyPromptBlocks, input.stats, "ProjectSection.loraConfig");
    const resolved = resolveSectionConfigFromRows({
      section: sectionForResolver({ ...section, positivePrompt: null, negativePrompt: null, loraConfig: null }),
      presetBindings: input.normalizedPresetBindings
        .filter((binding) => binding.projectSectionId === section.id)
        .map((binding) => toSectionBindingRow(binding, input.categories, input.presets))
        .filter((binding): binding is SectionPresetBindingRow => Boolean(binding)),
      promptBlockRows: input.normalizedPromptBlocks
        .filter((block) => block.projectSectionId === section.id)
        .map(sectionPromptBlockToResolverRow),
      manualLoraEntries: input.normalizedManualLoras
        .filter((entry) => entry.projectSectionId === section.id)
        .map(sectionManualLoraToResolverRow),
      presetVariants: input.variants,
      variantLinks: [...input.variantLinks],
    });
    if (legacy.promptBlocks.length === 0 && resolved.promptBlocks.length === 0 && resolved.loraConfig.lora1.length === 0 && resolved.loraConfig.lora2.length === 0) {
      return [];
    }
    return [{ id: section.id, kind: "section" as const, legacy, resolved }];
  });
}

function buildTemplateVerificationPairs(input: {
  templateSections: readonly LegacyProjectTemplateSectionRow[];
  normalizedPresetBindings: readonly TemplateSectionPresetBindingInsert[];
  normalizedPromptBlocks: readonly TemplateSectionPromptBlockInsert[];
  normalizedManualLoras: readonly TemplateSectionManualLoraEntryInsert[];
  categories: Map<string, PresetCategoryRow>;
  presets: Map<string, PresetRow>;
  variants: PresetVariantRow[];
  variantLinks: readonly PresetVariantLinkRow[];
  stats: MigrationStats;
}): ZeroRedundancyVerificationPair[] {
  return input.templateSections.flatMap((section) => {
    const legacyPromptBlockInputs = readJsonArray(
      section.promptBlocks,
      input.stats,
      "ProjectTemplateSection.promptBlocks",
      section.id,
    ).flatMap((block, index) => templatePromptBlockInput(section.id, block, index));
    const legacyPromptBlocks = legacyPromptBlocksForVerification(
      templateSectionAsSection(section),
      legacyPromptBlockInputs,
      {
        isMigratablePresetBlock: (block) => isMigratableLegacyPresetBlock(block, {
          categories: input.categories,
          presets: input.presets,
          variants: input.variants,
        }),
        categoryOrderForBlock: (block) => legacyPresetBlockCategoryOrder(block, input.categories, input.presets),
      },
    );
    const legacy = legacyResolvedSectionConfig(
      templateSectionAsSection(section),
      legacyPromptBlocks,
      input.stats,
      "ProjectTemplateSection.loraConfig",
    );
    const resolved = resolveSectionConfigFromRows({
      section: sectionForResolver({ ...templateSectionAsSection(section), loraConfig: null }),
      presetBindings: input.normalizedPresetBindings
        .filter((binding) => binding.projectTemplateSectionId === section.id)
        .map((binding) => toSectionBindingRow(templateBindingToSectionBinding(binding), input.categories, input.presets))
        .filter((binding): binding is SectionPresetBindingRow => Boolean(binding)),
      promptBlockRows: input.normalizedPromptBlocks
        .filter((block) => block.projectTemplateSectionId === section.id)
        .map(templatePromptBlockToResolverRow),
      manualLoraEntries: input.normalizedManualLoras
        .filter((entry) => entry.projectTemplateSectionId === section.id)
        .map(templateManualLoraToResolverRow),
      presetVariants: input.variants,
      variantLinks: [...input.variantLinks],
    });
    if (legacy.promptBlocks.length === 0 && resolved.promptBlocks.length === 0 && resolved.loraConfig.lora1.length === 0 && resolved.loraConfig.lora2.length === 0) {
      return [];
    }
    return [{ id: section.id, kind: "templateSection" as const, legacy, resolved }];
  });
}

function legacyResolvedSectionConfig(
  section: LegacyProjectSectionRow,
  promptBlocks: readonly LegacyPromptBlockRow[],
  stats: MigrationStats,
  loraField: string,
): ResolvedSectionConfig {
  const legacyLoras = parseLegacyLoraConfig(section.loraConfig, stats, loraField, section.id);
  const resolvedPromptBlocks = promptBlocks.map((block) => ({
    type: block.type,
    sourceId: block.sourceId,
    variantId: block.variantId,
    categoryId: block.categoryId,
    bindingId: block.bindingId,
    groupBindingId: block.groupBindingId,
    label: block.label,
    positive: block.positive,
    negative: block.negative,
    sortOrder: block.sortOrder,
  }));
  const positive = resolvedPromptBlocks
    .map((block) => block.positive)
    .filter((value) => value.trim().length > 0)
    .join(" BREAK ");
  const negative = resolvedPromptBlocks
    .map((block) => block.negative)
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" BREAK ") || null;
  const loraConfig = legacyLoraConfigToResolved(legacyLoras);

  return {
    promptBlocks: resolvedPromptBlocks,
    prompt: { positive, negative },
    presets: resolvedPromptBlocks
      .filter((block) => block.type === "preset" && block.categoryId && block.sourceId && block.bindingId)
      .map((block) => ({
        categoryId: block.categoryId!,
        presetId: block.sourceId!,
        variantId: block.variantId,
        bindingId: block.bindingId!,
        label: block.label,
      })),
    loraConfig,
    workflowLoraConfig: loraConfig,
      parameters: {
        aspectRatio: section.aspectRatio ?? null,
        aspectRatios: section.aspectRatio ? [section.aspectRatio] : null,
        shortSidePx: section.shortSidePx ?? null,
      batchSize: section.batchSize ?? null,
      seedPolicy: section.seedPolicy1 ?? null,
      seedPolicy1: section.seedPolicy1 ?? null,
      seedPolicy2: section.seedPolicy2 ?? null,
      upscaleFactor: section.upscaleFactor ?? null,
      useTwoStageKSampler: section.useTwoStageKSampler ?? true,
      checkpointName: section.checkpointName ?? null,
    },
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    extraParams: section.extraParams ?? null,
    warnings: [],
    missingReferences: [],
  };
}

function legacyLoraConfigToResolved(config: LegacyLoraConfig): ResolvedSectionConfig["loraConfig"] {
  return {
    lora1: config.lora1.map((entry, index) => legacyLoraEntryToResolved("lora1", entry, index)),
    lora2: config.lora2.map((entry, index) => legacyLoraEntryToResolved("lora2", entry, index)),
  };
}

function legacyLoraEntryToResolved(
  stage: LoraStage,
  entry: LegacyLoraEntry,
  index: number,
): ResolvedSectionConfig["loraConfig"][LoraStage][number] {
  return {
    id: entry.id ?? `legacy:${stage}:${index}:${entry.path}`,
    path: entry.path,
    weight: entry.weight,
    enabled: entry.suppressed ? false : entry.enabled,
    source: entry.source === "preset" ? "preset" : "manual",
    sourceLabel: entry.sourceLabel ?? undefined,
    sourceColor: entry.sourceColor ?? undefined,
    sourceName: entry.sourceName ?? undefined,
    bindingId: entry.bindingId ?? undefined,
    groupBindingId: entry.groupBindingId ?? undefined,
    detachedBindingId: entry.detachedBindingId ?? undefined,
    detachedGroupBindingId: entry.detachedGroupBindingId ?? undefined,
    detachedPresetPath: entry.detachedPresetPath ?? undefined,
    suppressed: entry.suppressed ? true : undefined,
  };
}

function normalizeCategories(categories: readonly LegacyPresetCategoryRow[]): Map<string, PresetCategoryRow> {
  return new Map(categories.map((category) => [
    category.id,
    {
      id: category.id,
      name: category.name ?? category.id,
      color: category.color ?? null,
      positivePromptOrder: category.positivePromptOrder ?? 0,
      negativePromptOrder: category.negativePromptOrder ?? 0,
      lora1Order: category.lora1Order ?? 0,
      lora2Order: category.lora2Order ?? 0,
    },
  ]));
}

function normalizePresets(presets: readonly LegacyPresetRow[]): Map<string, PresetRow> {
  return new Map(presets.map((preset) => [
    preset.id,
    {
      id: preset.id,
      categoryId: preset.categoryId,
      name: preset.name ?? preset.id,
      variants: [],
    },
  ]));
}

function normalizeVariants(variants: readonly LegacyPresetVariantRow[]): PresetVariantRow[] {
  return variants.map((variant) => ({
    id: variant.id,
    presetId: variant.presetId,
    name: variant.name ?? variant.id,
    prompt: variant.prompt ?? "",
    negativePrompt: normalizeNullableText(variant.negativePrompt),
    lora1: variant.lora1 ?? [],
    lora2: variant.lora2 ?? [],
    sortOrder: variant.sortOrder ?? 0,
    isActive: variant.isActive ?? true,
  }));
}

function sectionBindingFromBlock(
  sectionId: string,
  block: LegacyPromptBlockInputRow,
  refs: BindingRefs,
): SectionPresetBindingInsert | null {
  const bindingRef = readValidBindingRef(block, refs);
  if (!bindingRef) return null;
  const bindingKey = block.bindingId ?? `preset:${block.sourceId}:${block.variantId ?? "default"}:${block.sortOrder ?? 0}`;
  return {
    id: `sectionPresetBinding:${sectionId}:${bindingKey}`,
    projectSectionId: sectionId,
    bindingKey,
    categoryId: bindingRef.categoryId,
    presetId: bindingRef.presetId,
    variantId: block.variantId ?? null,
    groupBindingKey: block.groupBindingId ?? null,
    sortOrder: readNumber(block.sortOrder) ?? 0,
  };
}

function templateSectionBindingFromBlock(
  sectionId: string,
  block: LegacyPromptBlockInputRow,
  refs: BindingRefs,
): TemplateSectionPresetBindingInsert | null {
  const sectionBinding = sectionBindingFromBlock(sectionId, block, refs);
  if (!sectionBinding) return null;
  return {
    id: `templateSectionPresetBinding:${sectionId}:${sectionBinding.bindingKey}`,
    projectTemplateSectionId: sectionId,
    bindingKey: sectionBinding.bindingKey,
    categoryId: sectionBinding.categoryId,
    presetId: sectionBinding.presetId,
    variantId: sectionBinding.variantId,
    groupBindingKey: sectionBinding.groupBindingKey,
    sortOrder: sectionBinding.sortOrder,
  };
}

function readValidBindingRef(
  block: LegacyPromptBlockInputRow,
  refs: BindingRefs,
): { categoryId: string; presetId: string } | null {
  if (!block.sourceId) return null;
  const preset = refs.presets.get(block.sourceId);
  if (!preset) return null;

  const categoryId = block.categoryId ?? preset.categoryId;
  if (categoryId !== preset.categoryId || !refs.categories.has(categoryId)) return null;

  if (block.variantId) {
    const variant = refs.variants.find((row) =>
      row.id === block.variantId &&
      row.presetId === block.sourceId &&
      row.isActive !== false,
    );
    if (!variant) return null;
  }

  return { categoryId, presetId: block.sourceId };
}

function isMigratableLegacyPresetBlock(
  block: LegacyPromptBlockInputRow,
  refs: BindingRefs,
): boolean {
  return block.type !== "preset" || !block.sourceId || Boolean(readValidBindingRef(block, refs));
}

function templateBindingToSectionBinding(
  binding: TemplateSectionPresetBindingInsert,
): SectionPresetBindingInsert {
  return {
    id: binding.id,
    projectSectionId: binding.projectTemplateSectionId,
    bindingKey: binding.bindingKey,
    categoryId: binding.categoryId,
    presetId: binding.presetId,
    variantId: binding.variantId,
    groupBindingKey: binding.groupBindingKey,
    sortOrder: binding.sortOrder,
  };
}

function sectionCustomPromptBlockFromLegacyBlock(
  sectionId: string,
  block: LegacyPromptBlockInputRow,
  fallbackIndex: number,
): SectionPromptBlockInsert {
  return {
    id: `sectionPromptBlock:${sectionId}:legacy:${legacyBlockIdPart(block, fallbackIndex)}`,
    projectSectionId: sectionId,
    sectionBindingId: null,
    type: "custom",
    customLabel: block.label ?? "Legacy prompt block",
    customPositive: block.positive ?? "",
    customNegative: normalizeNullableText(block.negative),
    sortOrder: readNumber(block.sortOrder) ?? 0,
  };
}

function templateCustomPromptBlockFromLegacyBlock(
  sectionId: string,
  block: LegacyPromptBlockInputRow,
  fallbackIndex: number,
): TemplateSectionPromptBlockInsert {
  return {
    id: `templateSectionPromptBlock:${sectionId}:legacy:${legacyBlockIdPart(block, fallbackIndex)}`,
    projectTemplateSectionId: sectionId,
    templateSectionBindingId: null,
    type: "custom",
    customLabel: block.label ?? "Legacy prompt block",
    customPositive: block.positive ?? "",
    customNegative: normalizeNullableText(block.negative),
    sortOrder: readNumber(block.sortOrder) ?? 0,
  };
}

function legacyBlockIdPart(block: LegacyPromptBlockInputRow, fallbackIndex: number): string | number {
  if (block.id) return block.id;
  if (block.bindingId) return block.bindingId;
  const sortOrder = readNumber(block.sortOrder);
  return sortOrder === null ? fallbackIndex : `${sortOrder}:${fallbackIndex}`;
}

function toSectionBindingRow(
  binding: SectionPresetBindingInsert,
  categories: Map<string, PresetCategoryRow>,
  presets: Map<string, PresetRow>,
): SectionPresetBindingRow | null {
  const category = categories.get(binding.categoryId);
  const preset = presets.get(binding.presetId);
  if (!category || !preset) return null;
  return {
    ...binding,
    category,
    preset,
  };
}

function resolveSinglePresetPromptBlock(
  section: LegacyProjectSectionRow,
  binding: SectionPresetBindingRow,
  variants: readonly PresetVariantRow[],
  variantLinks: readonly PresetVariantLinkRow[],
) {
  const resolved = resolveSectionConfigFromRows({
    section: sectionForResolver({ ...section, positivePrompt: null, negativePrompt: null, loraConfig: null }),
    presetBindings: [binding],
    promptBlockRows: [{
      id: `probe:${binding.id}`,
      projectSectionId: binding.projectSectionId,
      sectionBindingId: binding.id,
      type: "preset",
      customLabel: null,
      customPositive: null,
      customNegative: null,
      sortOrder: binding.sortOrder,
    }],
    manualLoraEntries: [],
    presetVariants: [...variants],
    variantLinks: [...variantLinks],
  });
  return resolved.promptBlocks[0] ?? null;
}

function buildCleanLoraKeys(
  section: LegacyProjectSectionRow,
  bindings: readonly SectionPresetBindingRow[],
  variants: readonly PresetVariantRow[],
  variantLinks: readonly PresetVariantLinkRow[],
): Set<string> {
  const resolved = resolveSectionConfigFromRows({
    section: sectionForResolver({ ...section, positivePrompt: null, negativePrompt: null, loraConfig: null }),
    presetBindings: [...bindings],
    promptBlockRows: [],
    manualLoraEntries: [],
    presetVariants: [...variants],
    variantLinks: [...variantLinks],
  });
  const keys = new Set<string>();
  for (const stage of ["lora1", "lora2"] as const) {
    for (const entry of resolved.loraConfig[stage]) {
      keys.add(loraKey(stage, entry.bindingId ?? null, entry.path, entry.weight, entry.enabled));
    }
  }
  return keys;
}

function diffLegacyPresetBlock(
  block: LegacyPromptBlockInputRow,
  cleanBlock: LegacyPromptBlockRow | null,
) {
  return {
    customLabel: cleanBlock && sameText(block.label, cleanBlock.label) ? null : block.label ?? null,
    customPositive: cleanBlock && sameText(block.positive, cleanBlock.positive) ? null : block.positive ?? "",
    customNegative: cleanBlock && sameText(block.negative, cleanBlock.negative) ? null : normalizeNullableText(block.negative),
  };
}

function legacyPromptBlocksForVerification(
  section: LegacyProjectSectionRow,
  blocks: readonly LegacyPromptBlockInputRow[],
  options: {
    isMigratablePresetBlock?: (block: LegacyPromptBlockInputRow) => boolean;
    categoryOrderForBlock?: (block: LegacyPromptBlockRow) => number | null;
  } = {},
): LegacyPromptBlockRow[] {
  const normalized = sortLegacyBlocks(blocks).map((block) => {
    const keepPresetRef = options.isMigratablePresetBlock?.(block) ?? true;
    return {
      type: keepPresetRef ? block.type : "custom",
      sourceId: keepPresetRef ? block.sourceId ?? null : null,
      variantId: keepPresetRef ? block.variantId ?? null : null,
      categoryId: keepPresetRef ? block.categoryId ?? null : null,
      bindingId: keepPresetRef ? block.bindingId ?? null : null,
      groupBindingId: keepPresetRef ? block.groupBindingId ?? null : null,
      label: block.label ?? "Legacy prompt block",
      positive: block.positive ?? "",
      negative: normalizeNullableText(block.negative),
      sortOrder: readNumber(block.sortOrder) ?? 0,
    };
  });
  if (hasText(section.positivePrompt) || hasText(section.negativePrompt)) {
    const maxSortOrder = normalized.reduce((max, block) => Math.max(max, block.sortOrder), -1);
    normalized.push({
      type: "custom",
      sourceId: null,
      variantId: null,
      categoryId: null,
      bindingId: null,
      groupBindingId: null,
      label: "Legacy section prompt",
      positive: normalizeNullableText(section.positivePrompt) ?? "",
      negative: normalizeNullableText(section.negativePrompt),
      sortOrder: maxSortOrder + 1,
    });
  }
  return sortLegacyPromptBlocksForResolvedOrder(normalized, options.categoryOrderForBlock);
}

function legacyPresetBlockCategoryOrder(
  block: LegacyPromptBlockRow,
  categories: Map<string, PresetCategoryRow>,
  presets: Map<string, PresetRow>,
) {
  if (block.type !== "preset") return null;
  const categoryId = block.categoryId ?? (block.sourceId ? presets.get(block.sourceId)?.categoryId : null);
  return categoryId ? categories.get(categoryId)?.positivePromptOrder ?? null : null;
}

function sortLegacyPromptBlocksForResolvedOrder(
  blocks: readonly LegacyPromptBlockRow[],
  categoryOrderForBlock: ((block: LegacyPromptBlockRow) => number | null) | undefined,
) {
  return blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => {
      const aCategoryOrder = categoryOrderForBlock?.(a.block) ?? null;
      const bCategoryOrder = categoryOrderForBlock?.(b.block) ?? null;
      const aPrimary = aCategoryOrder ?? a.block.sortOrder;
      const bPrimary = bCategoryOrder ?? b.block.sortOrder;
      const aSecondary = aCategoryOrder === null ? 0 : a.block.sortOrder;
      const bSecondary = bCategoryOrder === null ? 0 : b.block.sortOrder;

      return aPrimary - bPrimary || aSecondary - bSecondary || a.index - b.index;
    })
    .map(({ block }) => block);
}

function parseBindingRefs(value: unknown, stats: MigrationStats, field: string, ownerId: string): BindingRef[] {
  return readJsonArray(value, stats, field, ownerId).flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const categoryId = readString(entry.categoryId);
    const presetId = readString(entry.presetId);
    if (!categoryId || !presetId) {
      stats.invalidReferenceCount += 1;
      return [];
    }
    return [{
      categoryId,
      presetId,
      variantId: readString(entry.variantId),
      sortOrder: readNumber(entry.sortOrder) ?? index,
    }];
  });
}

function validateBindingRef(
  binding: BindingRef,
  refs: BindingRefs,
  stats: MigrationStats,
): BindingRef | null {
  const preset = refs.presets.get(binding.presetId);
  if (!refs.categories.has(binding.categoryId) || !preset || preset.categoryId !== binding.categoryId) {
    stats.invalidReferenceCount += 1;
    return null;
  }

  if (binding.variantId) {
    const variant = refs.variants.find((row) =>
      row.id === binding.variantId &&
      row.presetId === binding.presetId &&
      row.isActive !== false,
    );
    if (!variant) {
      stats.invalidReferenceCount += 1;
      return null;
    }
  }

  return binding;
}

function parseLegacyLoraConfig(
  value: unknown,
  stats: MigrationStats,
  field: string,
  ownerId: string,
): LegacyLoraConfig {
  const parsed = readJsonObject(value, stats, field, ownerId);
  return {
    lora1: parseLegacyLoraEntries(parsed?.lora1),
    lora2: parseLegacyLoraEntries(parsed?.lora2),
  };
}

function parseLegacyLoraEntries(value: unknown): LegacyLoraEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const path = readString(entry.path);
    const weight = readNumber(entry.weight);
    const enabled = typeof entry.enabled === "boolean" ? entry.enabled : null;
    if (!path || weight === null || enabled === null) return [];
    return [{
      id: readString(entry.id),
      path,
      weight: roundWeight(weight),
      enabled,
      source: readString(entry.source),
      bindingId: readString(entry.bindingId),
      groupBindingId: readString(entry.groupBindingId),
      detachedBindingId: readString(entry.detachedBindingId),
      detachedGroupBindingId: readString(entry.detachedGroupBindingId),
      detachedPresetPath: readString(entry.detachedPresetPath),
      sourceName: readString(entry.sourceName),
      sourceLabel: readString(entry.sourceLabel),
      sourceColor: readString(entry.sourceColor),
      suppressed: entry.suppressed === true,
    }];
  });
}

function isUnboundCleanPresetLora(
  entry: LegacyLoraEntry,
  binding: SectionPresetBindingInsert | TemplateSectionPresetBindingInsert | null,
): boolean {
  return entry.source === "preset" &&
    !binding &&
    !entry.detachedBindingId &&
    !entry.detachedPresetPath &&
    !entry.suppressed;
}

function loraMetadata(entry: LegacyLoraEntry): Record<string, unknown> | null {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    legacyId: entry.id,
    source: entry.source,
    sourceName: entry.sourceName,
    sourceLabel: entry.sourceLabel,
    sourceColor: entry.sourceColor,
    groupBindingId: entry.groupBindingId,
    detachedGroupBindingId: entry.detachedGroupBindingId,
    suppressed: entry.suppressed ? true : null,
  })) {
    if (value !== null && value !== undefined) metadata[key] = value;
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}

function sectionForResolver(section: LegacyProjectSectionRow): ResolveSectionConfigInput["section"] {
  return {
    id: section.id,
    aspectRatio: section.aspectRatio ?? null,
    shortSidePx: section.shortSidePx ?? null,
    batchSize: section.batchSize ?? null,
    seedPolicy1: section.seedPolicy1 ?? null,
    seedPolicy2: section.seedPolicy2 ?? null,
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    upscaleFactor: section.upscaleFactor ?? null,
    checkpointName: section.checkpointName ?? null,
    extraParams: section.extraParams ?? null,
  };
}

function templateSectionAsSection(section: LegacyProjectTemplateSectionRow): LegacyProjectSectionRow {
  return {
    id: section.id,
    projectId: section.projectTemplateId ?? null,
    positivePrompt: null,
    negativePrompt: null,
    loraConfig: section.loraConfig,
    aspectRatio: section.aspectRatio ?? null,
    shortSidePx: section.shortSidePx ?? null,
    batchSize: section.batchSize ?? null,
    seedPolicy1: section.seedPolicy1 ?? null,
    seedPolicy2: section.seedPolicy2 ?? null,
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    upscaleFactor: section.upscaleFactor ?? null,
    checkpointName: section.checkpointName ?? null,
    extraParams: section.extraParams ?? null,
  };
}

function templatePromptBlockInput(
  sectionId: string,
  value: unknown,
  index: number,
): LegacyPromptBlockInputRow[] {
  if (!isRecord(value)) return [];
  const sourceId = readString(value.sourceId);
  const type = readString(value.type) ?? (sourceId ? "preset" : "custom");
  return [{
    id: readString(value.id) ?? undefined,
    projectSectionId: sectionId,
    type,
    sourceId,
    variantId: readString(value.variantId),
    categoryId: readString(value.categoryId),
    bindingId: readString(value.bindingId),
    groupBindingId: readString(value.groupBindingId),
    label: readString(value.label),
    positive: readString(value.positive),
    negative: readString(value.negative),
    sortOrder: readNumber(value.sortOrder) ?? index,
  }];
}

function sectionPromptBlockToResolverRow(row: SectionPromptBlockInsert): SectionPromptBlockRow {
  return {
    id: row.id,
    projectSectionId: row.projectSectionId,
    sectionBindingId: row.sectionBindingId,
    type: row.type,
    customLabel: row.customLabel,
    customPositive: row.customPositive,
    customNegative: row.customNegative,
    sortOrder: row.sortOrder,
  };
}

function templatePromptBlockToResolverRow(row: TemplateSectionPromptBlockInsert): SectionPromptBlockRow {
  return {
    id: row.id,
    projectSectionId: row.projectTemplateSectionId,
    sectionBindingId: row.templateSectionBindingId,
    type: row.type,
    customLabel: row.customLabel,
    customPositive: row.customPositive,
    customNegative: row.customNegative,
    sortOrder: row.sortOrder,
  };
}

function sectionManualLoraToResolverRow(row: SectionManualLoraEntryInsert): SectionManualLoraEntryRow {
  return {
    ...row,
    stage: row.stage,
  };
}

function templateManualLoraToResolverRow(row: TemplateSectionManualLoraEntryInsert): SectionManualLoraEntryRow {
  return {
    id: row.id,
    projectSectionId: row.projectTemplateSectionId,
    sectionBindingId: row.templateSectionBindingId,
    stage: row.stage,
    path: row.path,
    weight: row.weight,
    enabled: row.enabled,
    detachedFromBindingKey: row.detachedFromBindingKey,
    detachedFromPresetId: row.detachedFromPresetId,
    detachedFromVariantId: row.detachedFromVariantId,
    detachedFromPath: row.detachedFromPath,
    metadata: row.metadata,
    sortOrder: row.sortOrder,
  };
}

function readJsonArray(value: unknown, stats: MigrationStats, field: string, ownerId: string): unknown[] {
  if (!hasValue(value)) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      stats.invalidJsonRowCount += 1;
      return [];
    }
  }

  if (isRecord(value) && "toJSON" in value && typeof value.toJSON === "function") {
    const json = value.toJSON() as unknown;
    if (Array.isArray(json)) return json;
  }

  if (field || ownerId) {
    stats.invalidJsonRowCount += 1;
  }
  return [];
}

function readJsonObject(
  value: unknown,
  stats: MigrationStats,
  field: string,
  ownerId: string,
): Record<string, unknown> | null {
  if (!hasValue(value)) return null;
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : null;
    } catch {
      stats.invalidJsonRowCount += 1;
      return null;
    }
  }

  if (field || ownerId) {
    stats.invalidJsonRowCount += 1;
  }
  return null;
}

function sortLegacyBlocks<T extends { sortOrder?: number | null }>(blocks: readonly T[]): T[] {
  return [...blocks].sort((a, b) => (readNumber(a.sortOrder) ?? 0) - (readNumber(b.sortOrder) ?? 0));
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? value : null;
}

function sameText(left: unknown, right: unknown): boolean {
  return (normalizeNullableText(left) ?? "") === (normalizeNullableText(right) ?? "");
}

function hasText(value: unknown): boolean {
  return normalizeNullableText(value) !== null;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundWeight(value: number): number {
  return Math.round(value * 100) / 100;
}

function loraKey(
  stage: LoraStage,
  bindingId: string | null,
  path: string,
  weight: number,
  enabled: boolean,
): string {
  return `${stage}:${bindingId ?? ""}:${path}:${roundWeight(weight)}:${enabled}`;
}

function groupBy<T, K>(rows: readonly T[], keyFn: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = map.get(key) ?? [];
    existing.push(row);
    map.set(key, existing);
  }
  return map;
}

function upsertByKey<T>(rows: T[], row: T, keyFn: (row: T) => string): void {
  const key = keyFn(row);
  if (rows.some((existing) => keyFn(existing) === key)) return;
  rows.push(row);
}

function cloneExistingRows(existing: ZeroRedundancyExistingRows): Required<ZeroRedundancyExistingRows> {
  return {
    projectPresetBindings: [...(existing.projectPresetBindings ?? [])],
    projectTemplatePresetBindings: [...(existing.projectTemplatePresetBindings ?? [])],
    presetVariantLinks: [...(existing.presetVariantLinks ?? [])],
    presetCategorySlots: [...(existing.presetCategorySlots ?? [])],
    sectionPresetBindings: [...(existing.sectionPresetBindings ?? [])],
    sectionPromptBlocks: [...(existing.sectionPromptBlocks ?? [])],
    sectionManualLoraEntries: [...(existing.sectionManualLoraEntries ?? [])],
    templateSectionPresetBindings: [...(existing.templateSectionPresetBindings ?? [])],
    templateSectionPromptBlocks: [...(existing.templateSectionPromptBlocks ?? [])],
    templateSectionManualLoraEntries: [...(existing.templateSectionManualLoraEntries ?? [])],
  };
}

function mergeExistingWithPlannedRows(
  existing: ZeroRedundancyExistingRows,
  planned: Required<ZeroRedundancyExistingRows>,
): Required<ZeroRedundancyExistingRows> {
  return {
    projectPresetBindings: mergeRowsByWriteKey(
      existing.projectPresetBindings,
      planned.projectPresetBindings,
      (row) => `${row.projectId}:${row.categoryId}`,
    ),
    projectTemplatePresetBindings: mergeRowsByWriteKey(
      existing.projectTemplatePresetBindings,
      planned.projectTemplatePresetBindings,
      (row) => `${row.projectTemplateId}:${row.categoryId}`,
    ),
    presetVariantLinks: mergeRowsByWriteKey(
      existing.presetVariantLinks,
      planned.presetVariantLinks,
      (row) => `${row.sourceVariantId}:${row.linkedVariantId}`,
    ),
    presetCategorySlots: mergeRowsByWriteKey(
      existing.presetCategorySlots,
      planned.presetCategorySlots,
      (row) => `${row.categoryId}:${row.slotKey}`,
    ),
    sectionPresetBindings: mergeRowsByWriteKey(
      existing.sectionPresetBindings,
      planned.sectionPresetBindings,
      (row) => `${row.projectSectionId}:${row.bindingKey}`,
    ),
    sectionPromptBlocks: mergeRowsByWriteKey(
      existing.sectionPromptBlocks,
      planned.sectionPromptBlocks,
      (row) => row.id,
    ),
    sectionManualLoraEntries: mergeRowsByWriteKey(
      existing.sectionManualLoraEntries,
      planned.sectionManualLoraEntries,
      (row) => row.id,
    ),
    templateSectionPresetBindings: mergeRowsByWriteKey(
      existing.templateSectionPresetBindings,
      planned.templateSectionPresetBindings,
      (row) => `${row.projectTemplateSectionId}:${row.bindingKey}`,
    ),
    templateSectionPromptBlocks: mergeRowsByWriteKey(
      existing.templateSectionPromptBlocks,
      planned.templateSectionPromptBlocks,
      (row) => row.id,
    ),
    templateSectionManualLoraEntries: mergeRowsByWriteKey(
      existing.templateSectionManualLoraEntries,
      planned.templateSectionManualLoraEntries,
      (row) => row.id,
    ),
  };
}

function mergeRowsByWriteKey<T>(
  existing: readonly T[] | undefined,
  planned: readonly T[],
  keyFn: (row: T) => string,
): T[] {
  const rowsByKey = new Map<string, T>();
  const orderedKeys: string[] = [];
  const put = (row: T) => {
    const key = keyFn(row);
    if (!rowsByKey.has(key)) orderedKeys.push(key);
    rowsByKey.set(key, row);
  };

  for (const row of existing ?? []) put(row);
  for (const row of planned) put(row);

  return orderedKeys.map((key) => rowsByKey.get(key) as T);
}

function rejectExisting<T extends { id: string }>(
  planned: readonly T[],
  existing: readonly T[] | undefined,
  keyFn: (row: T) => string,
): T[] {
  const existingByKey = new Map((existing ?? []).map((row) => [keyFn(row), row]));
  return planned.filter((row) => {
    const existingRow = existingByKey.get(keyFn(row));
    return !existingRow || !sameWritableFields(row, existingRow);
  });
}

function sameWritableFields<T extends { id: string }>(planned: T, existing: T): boolean {
  const plannedData = writeData(planned) as Record<string, unknown>;
  const existingData = existing as Record<string, unknown>;

  return Object.keys(plannedData).every((key) =>
    comparableStringify(existingData[key]) === comparableStringify(plannedData[key]),
  );
}

function comparableStringify(value: unknown): string {
  return JSON.stringify(sortComparableValue(value));
}

function sortComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortComparableValue);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortComparableValue(value[key]);
      return acc;
    }, {});
}

function parseBatchSize(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--batch-size must be a positive integer");
  }
  return parsed;
}

function parseMigrationFormat(value: string): ZeroRedundancyMigrationFormat {
  if (value === "summary" || value === "json") return value;
  throw new Error(`Unsupported --format value: ${value}`);
}

function parseMigrationProvider(value: string): ZeroRedundancyMigrationProvider {
  if (value === "current" || value === "postgresql" || value === "sqlite") return value;
  throw new Error(`Unsupported --provider value: ${value}`);
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

async function findMany(db: Record<string, unknown>, modelName: string, args?: unknown): Promise<unknown[]> {
  const model = db[modelName];
  if (!isRecord(model) || typeof model.findMany !== "function") return [];
  try {
    return await (model.findMany(args) as Promise<unknown[]>);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

function normalizeWriteOptions(options: ZeroRedundancyWriteOptions | number): Required<Pick<ZeroRedundancyWriteOptions, "batchSize">> & Pick<ZeroRedundancyWriteOptions, "prisma"> {
  if (typeof options === "number") {
    return { batchSize: options, prisma: undefined };
  }
  return { batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE, prisma: options.prisma };
}

async function loadPrismaWriteClient(): Promise<Record<string, unknown>> {
  const { prisma } = await import("../../src/lib/prisma");
  return prisma as unknown as Record<string, unknown>;
}

function requiredWriteModelNames(plan: ZeroRedundancyMigrationPlan): string[] {
  const models: Array<[string, number]> = [
    ["projectPresetBinding", plan.projectPresetBindings.length],
    ["projectTemplatePresetBinding", plan.projectTemplatePresetBindings.length],
    ["presetVariantLink", plan.presetVariantLinks.length],
    ["presetCategorySlot", plan.presetCategorySlots.length],
    ["sectionPresetBinding", plan.sectionPresetBindings.length],
    ["sectionPromptBlock", plan.sectionPromptBlocks.length],
    ["sectionManualLoraEntry", plan.sectionManualLoraEntries.length],
    ["templateSectionPresetBinding", plan.templateSectionPresetBindings.length],
    ["templateSectionPromptBlock", plan.templateSectionPromptBlocks.length],
    ["templateSectionManualLoraEntry", plan.templateSectionManualLoraEntries.length],
  ];
  return models.flatMap(([modelName, rowCount]) => rowCount > 0 ? [modelName] : []);
}

function assertWriteClientReady(db: Record<string, unknown>, plan: ZeroRedundancyMigrationPlan): void {
  if (typeof db.$transaction !== "function") {
    throw new Error("Cannot write zero-redundancy migration: Prisma client is missing $transaction.");
  }
  assertWriteDelegatesReady(db, plan);
}

function assertWriteDelegatesReady(db: Record<string, unknown>, plan: ZeroRedundancyMigrationPlan): void {
  for (const modelName of requiredWriteModelNames(plan)) {
    requireUpsertDelegate(db, modelName);
  }
}

function requireUpsertDelegate(
  db: Record<string, unknown>,
  modelName: string,
): { upsert(args: unknown): Promise<unknown> } {
  const model = db[modelName];
  if (!isRecord(model) || typeof model.upsert !== "function") {
    throw new Error(
      `Cannot write zero-redundancy migration: Prisma model ${modelName} with upsert is unavailable. Run schema push and prisma generate first.`,
    );
  }
  return model as { upsert(args: unknown): Promise<unknown> };
}

async function upsert(db: Record<string, unknown>, modelName: string, args: unknown): Promise<void> {
  const model = requireUpsertDelegate(db, modelName);
  await model.upsert(args);
}

async function writeRows<T>(
  rows: readonly T[],
  batchSize: number,
  writeRow: (row: T) => Promise<void>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    for (const row of batch) {
      await writeRow(row);
    }
  }
}

function writeData<T extends { id: string }>(row: T): Omit<T, "id"> {
  const data = { ...row };
  delete (data as { id?: string }).id;
  return data;
}

function isMissingTableError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === "P2021") return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /table .*does not exist/i.test(message) || /no such table/i.test(message);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runZeroRedundancyMigrationCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
