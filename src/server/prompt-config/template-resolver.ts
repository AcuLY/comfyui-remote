import { resolveSectionConfigFromRows } from "./section-resolver";
import { loadReachablePresetVariantGraph } from "./preset-resolver";
import { sortBySortOrder } from "./order";
import type {
  LegacyPromptBlockRow,
  PresetVariantLinkRow,
  PresetVariantRow,
  ProjectTemplatePresetBindingRow,
  ResolveSectionConfigInput,
  ResolveTemplateSectionConfigInput,
  ResolvedSectionConfig,
  SectionManualLoraEntryRow,
  SectionPresetBindingRow,
  TemplateResolverSectionRow,
  TemplateSectionManualLoraEntryRow,
  TemplateSectionPresetBindingRow,
  TemplateSectionPromptBlockRow,
} from "./types";

export type TemplateSectionPresetBindingWrite = Omit<TemplateSectionPresetBindingRow, "category" | "preset">;
export type TemplateSectionPromptBlockWrite = TemplateSectionPromptBlockRow;
export type TemplateSectionManualLoraEntryWrite = TemplateSectionManualLoraEntryRow;
export type SectionPresetBindingWrite = Omit<SectionPresetBindingRow, "category" | "preset">;
export type SectionPromptBlockWrite = ResolveSectionConfigInput["promptBlockRows"][number];
export type SectionManualLoraEntryWrite = SectionManualLoraEntryRow;

type ProjectLevelBindingLike = {
  categoryId: string;
  presetId: string;
  variantId?: string | null;
  sortOrder?: number | null;
};

type LegacyLoraEntry = {
  id?: string;
  path: string;
  weight: number;
  enabled: boolean;
  source?: string;
  bindingId?: string | null;
  groupBindingId?: string | null;
  detachedBindingId?: string | null;
  detachedGroupBindingId?: string | null;
  detachedPresetPath?: string | null;
  suppressed?: boolean;
  metadata?: unknown;
};

type ProjectSectionForTemplateSave = {
  id: string;
  promptBlocks?: unknown;
  loraConfig?: unknown;
};

type TemplateSectionForImport = {
  id: string;
  name?: string | null;
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
};

type TemplateResolverDbSection = TemplateResolverSectionRow & {
  presetBindingRows: TemplateSectionPresetBindingRow[];
  promptBlockRows: TemplateSectionPromptBlockRow[];
  manualLoraEntries: TemplateSectionManualLoraEntryRow[];
};

type TemplateResolverDbClient = {
  projectTemplateSection: {
    findUnique(args: unknown): Promise<TemplateResolverDbSection | null>;
  };
  presetVariant: {
    findUnique(args: unknown): Promise<PresetVariantRow | null>;
    findFirst(args: unknown): Promise<PresetVariantRow | null>;
  };
  presetVariantLink: {
    findMany(args: unknown): Promise<PresetVariantLinkRow[]>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function readPromptBlockType(value: unknown, sourceId?: string | null): "custom" | "preset" {
  return value === "preset" || sourceId ? "preset" : "custom";
}

function relationId(prefix: string, ownerId: string, key: string) {
  return `${prefix}:${ownerId}:${key}`;
}

function normalizeBindingKey(value: unknown, fallback: string) {
  return readString(value) ?? fallback;
}

function readLegacyPromptBlock(value: unknown, index: number): LegacyPromptBlockRow | null {
  if (!isRecord(value)) return null;

  const sourceId = readString(value.sourceId);
  const type = readPromptBlockType(value.type, sourceId);

  return {
    type,
    sourceId,
    variantId: readString(value.variantId),
    categoryId: readString(value.categoryId),
    bindingId: readString(value.bindingId),
    groupBindingId: readString(value.groupBindingId),
    label: readNullableString(value.label) ?? (type === "preset" ? "Preset" : "Custom"),
    positive: readNullableString(value.positive) ?? "",
    negative: readNullableString(value.negative),
    sortOrder: readNumber(value.sortOrder) ?? index,
  };
}

export function parseTemplateLegacyPromptBlocks(value: unknown): LegacyPromptBlockRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => readLegacyPromptBlock(item, index))
    .filter((item): item is LegacyPromptBlockRow => Boolean(item));
}

function hasTemplateRows(input: ResolveTemplateSectionConfigInput) {
  return (
    input.presetBindings.length > 0 ||
    input.promptBlockRows.length > 0 ||
    input.manualLoraEntries.length > 0
  );
}

function adaptTemplateInput(input: ResolveTemplateSectionConfigInput): ResolveSectionConfigInput {
  return {
    section: {
      ...input.templateSection,
      positivePrompt: null,
      negativePrompt: null,
      loraConfig: input.templateSection.loraConfig,
    },
    presetBindings: input.presetBindings.map((binding) => ({
      id: binding.id,
      projectSectionId: binding.projectTemplateSectionId,
      bindingKey: binding.bindingKey,
      categoryId: binding.categoryId,
      presetId: binding.presetId,
      variantId: binding.variantId,
      groupBindingKey: binding.groupBindingKey,
      sortOrder: binding.sortOrder,
      category: binding.category,
      preset: binding.preset,
    })),
    promptBlockRows: input.promptBlockRows.map((row) => ({
      id: row.id,
      projectSectionId: row.projectTemplateSectionId,
      sectionBindingId: row.templateSectionBindingId,
      type: row.type,
      customLabel: row.customLabel,
      customPositive: row.customPositive,
      customNegative: row.customNegative,
      sortOrder: row.sortOrder,
    })),
    manualLoraEntries: input.manualLoraEntries.map((row) => ({
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
    })),
    legacyPromptBlocks: input.legacyPromptBlocks ?? parseTemplateLegacyPromptBlocks(input.templateSection.promptBlocks),
    presetVariants: input.presetVariants,
    variantLinks: input.variantLinks,
  };
}

export function resolveTemplateSectionConfigFromRows(
  input: ResolveTemplateSectionConfigInput,
): ResolvedSectionConfig {
  return resolveSectionConfigFromRows(adaptTemplateInput(input));
}

async function resolveInitialVariantIds(
  bindings: readonly TemplateSectionPresetBindingRow[],
  client: TemplateResolverDbClient,
) {
  const variantIds: string[] = [];

  for (const binding of bindings) {
    if (binding.variantId) {
      variantIds.push(binding.variantId);
      continue;
    }

    const localDefaultVariant = sortBySortOrder(
      (binding.preset.variants ?? []).filter((variant) => variant.isActive !== false),
    )[0];
    if (localDefaultVariant?.id) {
      variantIds.push(localDefaultVariant.id);
      continue;
    }

    const defaultVariant = await client.presetVariant.findFirst({
      where: {
        presetId: binding.presetId,
        isActive: true,
      },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });

    if (defaultVariant?.id) variantIds.push(defaultVariant.id);
  }

  return variantIds;
}

export async function resolveTemplateSectionConfig(
  templateSectionId: string,
  client?: TemplateResolverDbClient,
) {
  const db = client ?? ((await import("@/lib/prisma")).prisma as TemplateResolverDbClient);
  const templateSection = await db.projectTemplateSection.findUnique({
    where: { id: templateSectionId },
    select: {
      id: true,
      loraConfig: true,
      promptBlocks: true,
      aspectRatio: true,
      shortSidePx: true,
      batchSize: true,
      seedPolicy1: true,
      seedPolicy2: true,
      upscaleFactor: true,
      checkpointName: true,
      ksampler1: true,
      ksampler2: true,
      extraParams: true,
      presetBindingRows: {
        select: {
          id: true,
          projectTemplateSectionId: true,
          bindingKey: true,
          categoryId: true,
          presetId: true,
          variantId: true,
          groupBindingKey: true,
          sortOrder: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              positivePromptOrder: true,
              negativePromptOrder: true,
              lora1Order: true,
              lora2Order: true,
            },
          },
          preset: {
            select: {
              id: true,
              categoryId: true,
              name: true,
              variants: {
                where: { isActive: true },
                select: {
                  id: true,
                  presetId: true,
                  name: true,
                  sortOrder: true,
                  isActive: true,
                },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      promptBlockRows: {
        select: {
          id: true,
          projectTemplateSectionId: true,
          templateSectionBindingId: true,
          type: true,
          customLabel: true,
          customPositive: true,
          customNegative: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      manualLoraEntries: {
        select: {
          id: true,
          projectTemplateSectionId: true,
          templateSectionBindingId: true,
          stage: true,
          path: true,
          weight: true,
          enabled: true,
          detachedFromBindingKey: true,
          detachedFromPresetId: true,
          detachedFromVariantId: true,
          detachedFromPath: true,
          metadata: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!templateSection) return null;

  const resolverInput: ResolveTemplateSectionConfigInput = {
    templateSection,
    presetBindings: templateSection.presetBindingRows,
    promptBlockRows: templateSection.promptBlockRows,
    manualLoraEntries: templateSection.manualLoraEntries,
    legacyPromptBlocks: parseTemplateLegacyPromptBlocks(templateSection.promptBlocks),
    presetVariants: [],
    variantLinks: [],
  };

  if (!hasTemplateRows(resolverInput)) {
    return resolveTemplateSectionConfigFromRows(resolverInput);
  }

  const initialVariantIds = await resolveInitialVariantIds(templateSection.presetBindingRows, db);
  const { variants, variantLinks } = await loadReachablePresetVariantGraph(initialVariantIds, db);

  return resolveTemplateSectionConfigFromRows({
    ...resolverInput,
    presetVariants: variants,
    variantLinks,
  });
}

function projectLevelBindingMatches(
  binding: { categoryId: string; presetId: string; variantId?: string | null; groupBindingKey?: string | null },
  projectLevelBinding: ProjectLevelBindingLike,
) {
  if (binding.groupBindingKey) return false;
  if (binding.categoryId !== projectLevelBinding.categoryId) return false;
  if (binding.presetId !== projectLevelBinding.presetId) return false;
  if (projectLevelBinding.variantId && binding.variantId && projectLevelBinding.variantId !== binding.variantId) {
    return false;
  }
  return true;
}

function isProjectLevelBinding(
  binding: { categoryId: string; presetId: string; variantId?: string | null; groupBindingKey?: string | null },
  projectLevelBindings: readonly ProjectLevelBindingLike[],
) {
  return projectLevelBindings.some((projectLevelBinding) =>
    projectLevelBindingMatches(binding, projectLevelBinding),
  );
}

function templateBindingWriteFromSectionBinding(
  projectTemplateSectionId: string,
  binding: SectionPresetBindingRow,
): TemplateSectionPresetBindingWrite {
  return {
    id: relationId("templateSectionPresetBinding", projectTemplateSectionId, binding.bindingKey),
    projectTemplateSectionId,
    bindingKey: binding.bindingKey,
    categoryId: binding.categoryId,
    presetId: binding.presetId,
    variantId: binding.variantId,
    groupBindingKey: binding.groupBindingKey,
    sortOrder: binding.sortOrder,
  };
}

function templatePromptBlockWrite(
  projectTemplateSectionId: string,
  row: {
    id: string;
    bindingId: string | null;
    type: "custom" | "preset";
    customLabel: string | null;
    customPositive: string | null;
    customNegative: string | null;
    sortOrder: number;
  },
): TemplateSectionPromptBlockWrite {
  return {
    id: row.id,
    projectTemplateSectionId,
    templateSectionBindingId: row.bindingId,
    type: row.type,
    customLabel: row.customLabel,
    customPositive: row.customPositive,
    customNegative: row.customNegative,
    sortOrder: row.sortOrder,
  };
}

function templateManualLoraWriteFromSectionManual(
  projectTemplateSectionId: string,
  row: SectionManualLoraEntryRow,
  sectionBindingIdToTemplateBindingId: Map<string, string>,
): TemplateSectionManualLoraEntryWrite {
  return {
    id: relationId("templateSectionManualLoraEntry", projectTemplateSectionId, row.id),
    projectTemplateSectionId,
    templateSectionBindingId: row.sectionBindingId
      ? (sectionBindingIdToTemplateBindingId.get(row.sectionBindingId) ?? null)
      : null,
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

function readLegacyLoraEntry(value: unknown): LegacyLoraEntry | null {
  if (!isRecord(value)) return null;
  const path = readString(value.path);
  if (!path) return null;

  return {
    id: readString(value.id) ?? undefined,
    path,
    weight: readNumber(value.weight) ?? 1,
    enabled: readBoolean(value.enabled),
    source: readString(value.source) ?? undefined,
    bindingId: readString(value.bindingId),
    groupBindingId: readString(value.groupBindingId),
    detachedBindingId: readString(value.detachedBindingId),
    detachedGroupBindingId: readString(value.detachedGroupBindingId),
    detachedPresetPath: readString(value.detachedPresetPath),
    suppressed: value.suppressed === true,
    metadata: isRecord(value.metadata) ? value.metadata : null,
  };
}

function legacyLoraStageEntries(value: unknown, stage: "lora1" | "lora2") {
  if (!isRecord(value)) return [];
  const entries = value[stage];
  if (!Array.isArray(entries)) return [];
  return entries
    .map(readLegacyLoraEntry)
    .filter((entry): entry is LegacyLoraEntry => Boolean(entry));
}

function shouldKeepLegacyLoraAsManual(entry: LegacyLoraEntry) {
  if (entry.source !== "preset") return true;
  return Boolean(entry.detachedBindingId || entry.detachedPresetPath || entry.suppressed);
}

function legacyLoraMetadata(entry: LegacyLoraEntry) {
  if (entry.suppressed) return { suppressed: true };
  return entry.metadata ?? null;
}

function appendLegacyTemplateLoraRows(args: {
  rows: TemplateSectionManualLoraEntryWrite[];
  projectTemplateSectionId: string;
  loraConfig: unknown;
  bindingKeyToTemplateBindingId: Map<string, string>;
}) {
  for (const stage of ["lora1", "lora2"] as const) {
    legacyLoraStageEntries(args.loraConfig, stage).forEach((entry, index) => {
      if (!shouldKeepLegacyLoraAsManual(entry)) return;
      const bindingKey = entry.detachedBindingId ?? entry.bindingId ?? null;
      const templateSectionBindingId = bindingKey
        ? (args.bindingKeyToTemplateBindingId.get(bindingKey) ?? null)
        : null;

      args.rows.push({
        id: relationId("templateSectionManualLoraEntry", args.projectTemplateSectionId, `${stage}:${entry.id ?? index}:${entry.path}`),
        projectTemplateSectionId: args.projectTemplateSectionId,
        templateSectionBindingId,
        stage,
        path: entry.path,
        weight: entry.weight,
        enabled: entry.suppressed ? false : entry.enabled,
        detachedFromBindingKey: entry.detachedBindingId ?? (entry.source === "preset" ? entry.bindingId ?? null : null),
        detachedFromPresetId: null,
        detachedFromVariantId: null,
        detachedFromPath: entry.detachedPresetPath ?? (entry.source === "preset" ? entry.path : null),
        metadata: legacyLoraMetadata(entry),
        sortOrder: 1000 + index,
      });
    });
  }
}

function appendLegacyTemplatePromptRows(args: {
  rows: {
    presetBindings: TemplateSectionPresetBindingWrite[];
    promptBlocks: TemplateSectionPromptBlockWrite[];
  };
  projectTemplateSectionId: string;
  legacyPromptBlocks: readonly LegacyPromptBlockRow[];
  projectLevelBindings: readonly ProjectLevelBindingLike[];
  bindingKeyToTemplateBindingId: Map<string, string>;
}) {
  for (const [index, block] of args.legacyPromptBlocks.entries()) {
    if (block.type === "preset" && block.sourceId) {
      const bindingLike = {
        categoryId: block.categoryId,
        presetId: block.sourceId,
        variantId: block.variantId,
        groupBindingKey: block.groupBindingId,
      };
      if (
        bindingLike.categoryId &&
        isProjectLevelBinding(
          {
            categoryId: bindingLike.categoryId,
            presetId: bindingLike.presetId,
            variantId: bindingLike.variantId,
            groupBindingKey: bindingLike.groupBindingKey,
          },
          args.projectLevelBindings,
        )
      ) {
        continue;
      }

      if (bindingLike.categoryId) {
        const bindingKey = normalizeBindingKey(block.bindingId, `legacy-${index}`);
        const templateBindingId = relationId("templateSectionPresetBinding", args.projectTemplateSectionId, bindingKey);
        if (!args.bindingKeyToTemplateBindingId.has(bindingKey)) {
          args.rows.presetBindings.push({
            id: templateBindingId,
            projectTemplateSectionId: args.projectTemplateSectionId,
            bindingKey,
            categoryId: bindingLike.categoryId,
            presetId: block.sourceId,
            variantId: block.variantId ?? null,
            groupBindingKey: block.groupBindingId ?? null,
            sortOrder: block.sortOrder,
          });
          args.bindingKeyToTemplateBindingId.set(bindingKey, templateBindingId);
        }

        args.rows.promptBlocks.push(templatePromptBlockWrite(args.projectTemplateSectionId, {
          id: relationId("templateSectionPromptBlock", args.projectTemplateSectionId, bindingKey),
          bindingId: templateBindingId,
          type: "preset",
          customLabel: null,
          customPositive: null,
          customNegative: null,
          sortOrder: block.sortOrder,
        }));
        continue;
      }
    }

    args.rows.promptBlocks.push(templatePromptBlockWrite(args.projectTemplateSectionId, {
      id: relationId("templateSectionPromptBlock", args.projectTemplateSectionId, `legacy:${block.sortOrder}:${index}`),
      bindingId: null,
      type: "custom",
      customLabel: block.label,
      customPositive: block.positive,
      customNegative: block.negative,
      sortOrder: block.sortOrder,
    }));
  }
}

export function buildTemplateSectionRowsForProjectSectionSave(input: {
  projectTemplateSectionId: string;
  projectSection: ProjectSectionForTemplateSave;
  presetBindings: SectionPresetBindingRow[];
  promptBlockRows: ResolveSectionConfigInput["promptBlockRows"];
  manualLoraEntries: SectionManualLoraEntryRow[];
  projectLevelBindings?: readonly ProjectLevelBindingLike[];
}) {
  const projectLevelBindings = input.projectLevelBindings ?? [];
  const presetBindings: TemplateSectionPresetBindingWrite[] = [];
  const promptBlocks: TemplateSectionPromptBlockWrite[] = [];
  const manualLoraEntries: TemplateSectionManualLoraEntryWrite[] = [];
  const skippedSectionBindingIds = new Set<string>();
  const sectionBindingIdToTemplateBindingId = new Map<string, string>();
  const bindingKeyToTemplateBindingId = new Map<string, string>();
  const hasNewRows =
    input.presetBindings.length > 0 ||
    input.promptBlockRows.length > 0 ||
    input.manualLoraEntries.length > 0;

  if (hasNewRows) {
    for (const binding of input.presetBindings) {
      if (isProjectLevelBinding(binding, projectLevelBindings)) {
        skippedSectionBindingIds.add(binding.id);
        continue;
      }

      const write = templateBindingWriteFromSectionBinding(input.projectTemplateSectionId, binding);
      presetBindings.push(write);
      sectionBindingIdToTemplateBindingId.set(binding.id, write.id);
      bindingKeyToTemplateBindingId.set(binding.bindingKey, write.id);
    }

    for (const row of sortBySortOrder(input.promptBlockRows)) {
      if (row.sectionBindingId && skippedSectionBindingIds.has(row.sectionBindingId)) continue;
      const templateSectionBindingId = row.sectionBindingId
        ? (sectionBindingIdToTemplateBindingId.get(row.sectionBindingId) ?? null)
        : null;

      promptBlocks.push(templatePromptBlockWrite(input.projectTemplateSectionId, {
        id: relationId("templateSectionPromptBlock", input.projectTemplateSectionId, row.id),
        bindingId: templateSectionBindingId,
        type: row.type === "preset" && templateSectionBindingId ? "preset" : "custom",
        customLabel: row.customLabel,
        customPositive: row.type === "preset" && templateSectionBindingId ? row.customPositive : row.customPositive,
        customNegative: row.type === "preset" && templateSectionBindingId ? row.customNegative : row.customNegative,
        sortOrder: row.sortOrder,
      }));
    }

    for (const row of sortBySortOrder(input.manualLoraEntries)) {
      manualLoraEntries.push(templateManualLoraWriteFromSectionManual(
        input.projectTemplateSectionId,
        row,
        sectionBindingIdToTemplateBindingId,
      ));
    }

    return { presetBindings, promptBlocks, manualLoraEntries };
  }

  appendLegacyTemplatePromptRows({
    rows: { presetBindings, promptBlocks },
    projectTemplateSectionId: input.projectTemplateSectionId,
    legacyPromptBlocks: parseTemplateLegacyPromptBlocks(input.projectSection.promptBlocks),
    projectLevelBindings,
    bindingKeyToTemplateBindingId,
  });
  appendLegacyTemplateLoraRows({
    rows: manualLoraEntries,
    projectTemplateSectionId: input.projectTemplateSectionId,
    loraConfig: input.projectSection.loraConfig,
    bindingKeyToTemplateBindingId,
  });

  return { presetBindings, promptBlocks, manualLoraEntries };
}

export function buildTemplateSectionRowsFromLegacyTemplateData(input: {
  projectTemplateSectionId: string;
  promptBlocks: unknown;
  loraConfig: unknown;
}) {
  return buildTemplateSectionRowsForProjectSectionSave({
    projectTemplateSectionId: input.projectTemplateSectionId,
    projectSection: {
      id: input.projectTemplateSectionId,
      promptBlocks: input.promptBlocks,
      loraConfig: input.loraConfig,
    },
    presetBindings: [],
    promptBlockRows: [],
    manualLoraEntries: [],
    projectLevelBindings: [],
  });
}

export function buildProjectSectionDataForTemplateImport(input: {
  projectId: string;
  sortOrder: number;
  templateSection: TemplateSectionForImport;
}) {
  const section = input.templateSection;

  return {
    projectId: input.projectId,
    sortOrder: input.sortOrder,
    enabled: true,
    name: section.name ?? null,
    ...(section.aspectRatio !== null && section.aspectRatio !== undefined ? { aspectRatio: section.aspectRatio } : {}),
    ...(section.shortSidePx !== null && section.shortSidePx !== undefined ? { shortSidePx: section.shortSidePx } : {}),
    ...(section.batchSize !== null && section.batchSize !== undefined ? { batchSize: section.batchSize } : {}),
    ...(section.seedPolicy1 !== null && section.seedPolicy1 !== undefined ? { seedPolicy1: section.seedPolicy1 } : {}),
    ...(section.seedPolicy2 !== null && section.seedPolicy2 !== undefined ? { seedPolicy2: section.seedPolicy2 } : {}),
    ...(section.ksampler1 !== null && section.ksampler1 !== undefined ? { ksampler1: section.ksampler1 } : {}),
    ...(section.ksampler2 !== null && section.ksampler2 !== undefined ? { ksampler2: section.ksampler2 } : {}),
    ...(section.upscaleFactor !== null && section.upscaleFactor !== undefined ? { upscaleFactor: section.upscaleFactor } : {}),
    ...(section.checkpointName !== null && section.checkpointName !== undefined ? { checkpointName: section.checkpointName } : {}),
    ...(section.extraParams !== null && section.extraParams !== undefined ? { extraParams: section.extraParams } : {}),
  };
}

function sectionBindingWriteFromTemplateBinding(
  projectSectionId: string,
  binding: TemplateSectionPresetBindingRow,
): SectionPresetBindingWrite {
  return {
    id: relationId("sectionPresetBinding", projectSectionId, binding.bindingKey),
    projectSectionId,
    bindingKey: binding.bindingKey,
    categoryId: binding.categoryId,
    presetId: binding.presetId,
    variantId: binding.variantId,
    groupBindingKey: binding.groupBindingKey,
    sortOrder: binding.sortOrder,
  };
}

function sectionBindingWriteFromProjectTemplateBinding(
  projectSectionId: string,
  binding: ProjectLevelBindingLike,
  index: number,
): SectionPresetBindingWrite {
  const bindingKey = `template-project:${binding.categoryId}`;
  return {
    id: relationId("sectionPresetBinding", projectSectionId, bindingKey),
    projectSectionId,
    bindingKey,
    categoryId: binding.categoryId,
    presetId: binding.presetId,
    variantId: binding.variantId ?? null,
    groupBindingKey: null,
    sortOrder: binding.sortOrder ?? index,
  };
}

function appendLegacySectionPromptRows(args: {
  rows: {
    presetBindings: SectionPresetBindingWrite[];
    promptBlocks: SectionPromptBlockWrite[];
  };
  projectSectionId: string;
  legacyPromptBlocks: readonly LegacyPromptBlockRow[];
  bindingKeyToSectionBindingId: Map<string, string>;
}) {
  for (const [index, block] of args.legacyPromptBlocks.entries()) {
    if (block.type === "preset" && block.sourceId && block.categoryId) {
      const bindingKey = normalizeBindingKey(block.bindingId, `legacy-${index}`);
      const sectionBindingId = relationId("sectionPresetBinding", args.projectSectionId, bindingKey);
      if (!args.bindingKeyToSectionBindingId.has(bindingKey)) {
        args.rows.presetBindings.push({
          id: sectionBindingId,
          projectSectionId: args.projectSectionId,
          bindingKey,
          categoryId: block.categoryId,
          presetId: block.sourceId,
          variantId: block.variantId ?? null,
          groupBindingKey: block.groupBindingId ?? null,
          sortOrder: block.sortOrder,
        });
        args.bindingKeyToSectionBindingId.set(bindingKey, sectionBindingId);
      }

      args.rows.promptBlocks.push({
        id: relationId("sectionPromptBlock", args.projectSectionId, bindingKey),
        projectSectionId: args.projectSectionId,
        sectionBindingId,
        type: "preset",
        customLabel: null,
        customPositive: null,
        customNegative: null,
        sortOrder: block.sortOrder,
      });
      continue;
    }

    args.rows.promptBlocks.push({
      id: relationId("sectionPromptBlock", args.projectSectionId, `legacy:${block.sortOrder}:${index}`),
      projectSectionId: args.projectSectionId,
      sectionBindingId: null,
      type: "custom",
      customLabel: block.label,
      customPositive: block.positive,
      customNegative: block.negative,
      sortOrder: block.sortOrder,
    });
  }
}

function appendLegacySectionLoraRows(args: {
  rows: SectionManualLoraEntryWrite[];
  projectSectionId: string;
  loraConfig: unknown;
  bindingKeyToSectionBindingId: Map<string, string>;
}) {
  for (const stage of ["lora1", "lora2"] as const) {
    legacyLoraStageEntries(args.loraConfig, stage).forEach((entry, index) => {
      if (!shouldKeepLegacyLoraAsManual(entry)) return;
      const bindingKey = entry.detachedBindingId ?? entry.bindingId ?? null;
      const sectionBindingId = bindingKey
        ? (args.bindingKeyToSectionBindingId.get(bindingKey) ?? null)
        : null;

      args.rows.push({
        id: relationId("sectionManualLoraEntry", args.projectSectionId, `${stage}:${entry.id ?? index}:${entry.path}`),
        projectSectionId: args.projectSectionId,
        sectionBindingId,
        stage,
        path: entry.path,
        weight: entry.weight,
        enabled: entry.suppressed ? false : entry.enabled,
        detachedFromBindingKey: entry.detachedBindingId ?? (entry.source === "preset" ? entry.bindingId ?? null : null),
        detachedFromPresetId: null,
        detachedFromVariantId: null,
        detachedFromPath: entry.detachedPresetPath ?? (entry.source === "preset" ? entry.path : null),
        metadata: legacyLoraMetadata(entry),
        sortOrder: 1000 + index,
      });
    });
  }
}

export function buildProjectSectionRowsForTemplateImport(input: {
  projectSectionId: string;
  templateProjectPresetBindings?: readonly ProjectTemplatePresetBindingRow[];
  projectLevelBindings?: readonly ProjectLevelBindingLike[];
  templatePresetBindings: readonly TemplateSectionPresetBindingRow[];
  templatePromptBlocks: readonly TemplateSectionPromptBlockRow[];
  templateManualLoraEntries: readonly TemplateSectionManualLoraEntryRow[];
  legacyPromptBlocks?: readonly LegacyPromptBlockRow[];
  legacyLoraConfig?: unknown;
}) {
  const presetBindings: SectionPresetBindingWrite[] = [];
  const promptBlocks: SectionPromptBlockWrite[] = [];
  const manualLoraEntries: SectionManualLoraEntryWrite[] = [];
  const templateBindingIdToSectionBindingId = new Map<string, string>();
  const bindingKeyToSectionBindingId = new Map<string, string>();
  const projectBindingCategoryIds = new Set<string>();

  const projectBindings = [
    ...(input.projectLevelBindings ?? []),
    ...(input.templateProjectPresetBindings ?? []),
  ];
  for (const [index, binding] of projectBindings.entries()) {
    if (projectBindingCategoryIds.has(binding.categoryId)) continue;
    projectBindingCategoryIds.add(binding.categoryId);
    const write = sectionBindingWriteFromProjectTemplateBinding(input.projectSectionId, binding, index);
    presetBindings.push(write);
    bindingKeyToSectionBindingId.set(write.bindingKey, write.id);
  }

  const hasTemplateRows =
    input.templatePresetBindings.length > 0 ||
    input.templatePromptBlocks.length > 0 ||
    input.templateManualLoraEntries.length > 0;

  if (hasTemplateRows) {
    for (const binding of input.templatePresetBindings) {
      const write = sectionBindingWriteFromTemplateBinding(input.projectSectionId, binding);
      presetBindings.push(write);
      templateBindingIdToSectionBindingId.set(binding.id, write.id);
      bindingKeyToSectionBindingId.set(binding.bindingKey, write.id);
    }

    for (const row of sortBySortOrder(input.templatePromptBlocks)) {
      const sectionBindingId = row.templateSectionBindingId
        ? (templateBindingIdToSectionBindingId.get(row.templateSectionBindingId) ?? null)
        : null;
      promptBlocks.push({
        id: relationId("sectionPromptBlock", input.projectSectionId, row.id),
        projectSectionId: input.projectSectionId,
        sectionBindingId,
        type: row.type === "preset" && sectionBindingId ? "preset" : "custom",
        customLabel: row.customLabel,
        customPositive: row.customPositive,
        customNegative: row.customNegative,
        sortOrder: row.sortOrder,
      });
    }

    for (const row of sortBySortOrder(input.templateManualLoraEntries)) {
      manualLoraEntries.push({
        id: relationId("sectionManualLoraEntry", input.projectSectionId, row.id),
        projectSectionId: input.projectSectionId,
        sectionBindingId: row.templateSectionBindingId
          ? (templateBindingIdToSectionBindingId.get(row.templateSectionBindingId) ?? null)
          : null,
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
      });
    }

    return { presetBindings, promptBlocks, manualLoraEntries };
  }

  appendLegacySectionPromptRows({
    rows: { presetBindings, promptBlocks },
    projectSectionId: input.projectSectionId,
    legacyPromptBlocks: input.legacyPromptBlocks ?? [],
    bindingKeyToSectionBindingId,
  });
  appendLegacySectionLoraRows({
    rows: manualLoraEntries,
    projectSectionId: input.projectSectionId,
    loraConfig: input.legacyLoraConfig,
    bindingKeyToSectionBindingId,
  });

  return { presetBindings, promptBlocks, manualLoraEntries };
}
