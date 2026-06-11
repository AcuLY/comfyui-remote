import {
  dedupeLoraEntriesByPath,
  joinPromptParts,
  sortBySortOrder,
  sortResolvedLoras,
  sortResolvedPromptBlocks,
  type LoraSortInput,
  type PromptBlockSortInput,
} from "./order";
import {
  loadReachablePresetVariantGraph,
  resolvePresetVariantContentFromRows,
} from "./preset-resolver";
import { normalizeAspectRatioList } from "@/lib/aspect-ratio-utils";
import {
  resolvePresetGroupContents,
  type PresetGroupResolverDbClient,
} from "./preset-group-resolver";
import type {
  LoraStage,
  MissingReference,
  PresetVariantLinkRow,
  PresetVariantRow,
  ResolveSectionConfigInput,
  ResolvedLoraEntry,
  ResolvedPromptBlock,
  ResolvedPresetGroupContent,
  ResolvedSectionConfig,
  SectionLoraConfig,
  SectionManualLoraEntryRow,
  SectionPresetBindingRow,
} from "./types";

type SectionResolverDbSection = ResolveSectionConfigInput["section"] & {
  presetBindingRows: SectionPresetBindingRow[];
  sectionPromptBlocks: ResolveSectionConfigInput["promptBlockRows"];
  manualLoraEntries: SectionManualLoraEntryRow[];
};

type SectionResolverDbClient = {
  projectSection: {
    findUnique(args: unknown): Promise<SectionResolverDbSection | null>;
  };
  presetVariant: {
    findUnique(args: unknown): Promise<PresetVariantRow | null>;
    findFirst(args: unknown): Promise<PresetVariantRow | null>;
  };
  presetVariantLink: {
    findMany(args: unknown): Promise<PresetVariantLinkRow[]>;
  };
} & Partial<PresetGroupResolverDbClient>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProjectOverrides(section: ResolveSectionConfigInput["section"]) {
  const overrides = section.project?.projectLevelOverrides;
  return isRecord(overrides) ? overrides : {};
}

function readOverrideString(overrides: Record<string, unknown>, key: string) {
  const value = overrides[key];
  return typeof value === "string" ? value : null;
}

function readOverrideNumber(overrides: Record<string, unknown>, key: string) {
  const value = overrides[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOverrideRecord(overrides: Record<string, unknown>, key: string) {
  const value = overrides[key];
  return isRecord(value) ? value : null;
}

function buildSectionParameters(section: ResolveSectionConfigInput["section"]) {
  const overrides = readProjectOverrides(section);
  const fallbackAspectRatio = section.aspectRatio ??
    readOverrideString(overrides, "defaultAspectRatio") ??
    readOverrideString(overrides, "aspectRatio") ??
    null;
  const aspectRatios = normalizeAspectRatioList(section.aspectRatios, fallbackAspectRatio);

  return {
    aspectRatio: aspectRatios[0] ?? null,
    aspectRatios: aspectRatios.length > 0 ? aspectRatios : null,
    shortSidePx: section.shortSidePx ??
      readOverrideNumber(overrides, "defaultShortSidePx") ??
      readOverrideNumber(overrides, "shortSidePx") ??
      null,
    batchSize: section.batchSize ??
      readOverrideNumber(overrides, "defaultBatchSize") ??
      readOverrideNumber(overrides, "batchSize") ??
      null,
    seedPolicy: section.seedPolicy1 ?? readOverrideString(overrides, "defaultSeedPolicy1") ?? null,
    seedPolicy1: section.seedPolicy1 ?? readOverrideString(overrides, "defaultSeedPolicy1") ?? null,
    seedPolicy2: section.seedPolicy2 ?? readOverrideString(overrides, "defaultSeedPolicy2") ?? null,
    upscaleFactor: section.upscaleFactor ?? readOverrideNumber(overrides, "defaultUpscaleFactor") ?? null,
    checkpointName: section.checkpointName ?? section.project?.checkpointName ?? null,
  };
}

function buildResolvedPrompt(promptBlocks: readonly ResolvedPromptBlock[]) {
  const positive = joinPromptParts(promptBlocks.map((block) => block.positive), " BREAK ");
  const negative = joinPromptParts(promptBlocks.map((block) => block.negative), " BREAK ") || null;

  return { positive, negative };
}

function buildResolvedPresets(promptBlocks: readonly ResolvedPromptBlock[]) {
  return promptBlocks
    .filter((block) => block.type === "preset" && block.categoryId && block.sourceId && block.bindingId)
    .map((block) => ({
      categoryId: block.categoryId!,
      presetId: block.sourceId!,
      variantId: block.variantId,
      bindingId: block.bindingId!,
      label: block.label,
    }));
}

function buildResolverWarnings(missingReferences: readonly MissingReference[]) {
  return missingReferences.map((missingReference) =>
    missingReference.ownerId
      ? `${missingReference.kind}:${missingReference.ownerId}:${missingReference.id}`
      : `${missingReference.kind}:${missingReference.id}`,
  );
}

function hasVariantContent(variant: unknown): variant is PresetVariantRow {
  return (
    isRecord(variant) &&
    typeof variant.id === "string" &&
    typeof variant.presetId === "string" &&
    typeof variant.prompt === "string" &&
    "lora1" in variant &&
    "lora2" in variant
  );
}

function buildResolvedSectionConfig(
  input: ResolveSectionConfigInput,
  promptBlocks: ResolvedSectionConfig["promptBlocks"],
  loraConfig: ResolvedSectionConfig["loraConfig"],
  missingReferences: MissingReference[],
): ResolvedSectionConfig {
  return {
    promptBlocks,
    prompt: buildResolvedPrompt(promptBlocks),
    presets: buildResolvedPresets(promptBlocks),
    loraConfig,
    parameters: buildSectionParameters(input.section),
    ksampler1: input.section.ksampler1 ?? readOverrideRecord(readProjectOverrides(input.section), "defaultKsampler1"),
    ksampler2: input.section.ksampler2 ?? readOverrideRecord(readProjectOverrides(input.section), "defaultKsampler2"),
    extraParams: input.section.extraParams ?? null,
    warnings: buildResolverWarnings(missingReferences),
    missingReferences,
  };
}

function collectPresetVariants(input: ResolveSectionConfigInput) {
  const variants = [...(input.presetVariants ?? [])];
  const seen = new Set(variants.map((variant) => variant.id));

  for (const binding of input.presetBindings) {
    for (const variant of binding.preset?.variants ?? []) {
      if (!hasVariantContent(variant)) continue;
      if (seen.has(variant.id)) continue;
      seen.add(variant.id);
      variants.push(variant);
    }
  }

  return variants;
}

function activePresetVariants(binding: SectionPresetBindingRow, variants: readonly PresetVariantRow[]) {
  if (!binding.presetId) return [];
  const presetVariants = variants.filter(
    (variant) => variant.presetId === binding.presetId && variant.isActive !== false,
  );
  return sortBySortOrder(presetVariants);
}

function resolveBindingVariant(
  binding: SectionPresetBindingRow,
  variants: readonly PresetVariantRow[],
) {
  const presetVariants = activePresetVariants(binding, variants);
  if (binding.variantId) {
    return presetVariants.find((variant) => variant.id === binding.variantId) ?? null;
  }

  return presetVariants[0] ?? null;
}

function buildPresetBlockLabel(
  binding: SectionPresetBindingRow,
  variant: PresetVariantRow | null,
  variants: readonly PresetVariantRow[],
) {
  if (!binding.preset) return binding.presetGroup?.name ?? binding.bindingKey;
  if (!variant) return binding.preset.name;

  const bindingVariants = binding.preset?.variants ?? [];
  const variantCount = bindingVariants.length > 0
    ? bindingVariants.filter((item) => item.isActive !== false).length
    : variants.filter((item) => item.presetId === binding.presetId && item.isActive !== false).length;
  if (variantCount <= 1) return binding.preset.name;

  return `${binding.preset.name} / ${variant.name ?? variant.id}`;
}

function resolvedGroupsById(input: ResolveSectionConfigInput) {
  return new Map((input.presetGroupResolutions ?? []).map((group) => [group.groupId, group]));
}

function isPresetGroupBinding(binding: SectionPresetBindingRow) {
  return Boolean(binding.presetGroupId) && !binding.presetId;
}

function resolvePresetGroupBlock(
  binding: SectionPresetBindingRow,
  options: {
    resolvedGroups: Map<string, ResolvedPresetGroupContent>;
    customLabel?: string | null;
    customPositive?: string | null;
    customNegative?: string | null;
    sortOrder: number;
    missingReferences: MissingReference[];
  },
): ResolvedPromptBlock {
  const groupId = binding.presetGroupId;
  const resolved = groupId ? options.resolvedGroups.get(groupId) ?? null : null;
  if (!resolved && groupId) {
    options.missingReferences.push({
      kind: "presetGroup",
      id: groupId,
      ownerId: binding.bindingKey,
    });
  }
  if (resolved) options.missingReferences.push(...resolved.missingReferences);

  return {
    type: "preset",
    sourceId: null,
    variantId: null,
    presetGroupId: groupId,
    categoryId: binding.categoryId,
    bindingId: binding.bindingKey,
    groupBindingId: binding.groupBindingKey,
    label: options.customLabel ?? resolved?.name ?? binding.presetGroup?.name ?? groupId ?? binding.bindingKey,
    positive: options.customPositive ?? resolved?.prompt ?? "",
    negative: options.customNegative ?? resolved?.negativePrompt ?? null,
    sortOrder: options.sortOrder,
  };
}

function resolvePresetGroupMemberBlocks(
  binding: SectionPresetBindingRow,
  options: {
    resolvedGroups: Map<string, ResolvedPresetGroupContent>;
    sortOrder: number;
    index: number;
    missingReferences: MissingReference[];
  },
): PromptBlockSortInput[] {
  const groupId = binding.presetGroupId;
  const resolved = groupId ? options.resolvedGroups.get(groupId) ?? null : null;
  if (!resolved) {
    return [{
      block: resolvePresetGroupBlock(binding, {
        resolvedGroups: options.resolvedGroups,
        sortOrder: options.sortOrder,
        missingReferences: options.missingReferences,
      }),
      rowSortOrder: options.sortOrder,
      categoryOrder: binding.category.positivePromptOrder,
      bindingSortOrder: binding.sortOrder,
      index: options.index,
    }];
  }

  if (resolved.members.length === 0) {
    return [{
      block: resolvePresetGroupBlock(binding, {
        resolvedGroups: options.resolvedGroups,
        sortOrder: options.sortOrder,
        missingReferences: options.missingReferences,
      }),
      rowSortOrder: options.sortOrder,
      categoryOrder: binding.category.positivePromptOrder,
      bindingSortOrder: binding.sortOrder,
      index: options.index,
    }];
  }

  options.missingReferences.push(...resolved.missingReferences);
  return resolved.members.map((member, memberIndex) => ({
    block: {
      type: "preset",
      sourceId: member.presetId,
      variantId: member.variantId,
      presetGroupId: groupId,
      categoryId: member.categoryId,
      bindingId: binding.bindingKey,
      groupBindingId: binding.groupBindingKey,
      label: member.label,
      positive: member.prompt,
      negative: member.negativePrompt,
      sortOrder: options.sortOrder + memberIndex,
    },
    rowSortOrder: options.sortOrder,
    categoryOrder: member.positivePromptOrder,
    bindingSortOrder: binding.sortOrder,
    index: options.index + memberIndex,
  }));
}

function resolvePresetBlock(
  binding: SectionPresetBindingRow,
  options: {
    variants: readonly PresetVariantRow[];
    variantLinks: readonly PresetVariantLinkRow[];
    customLabel?: string | null;
    customPositive?: string | null;
    customNegative?: string | null;
    sortOrder: number;
    missingReferences: MissingReference[];
  },
): ResolvedPromptBlock {
  if (isPresetGroupBinding(binding)) {
    return resolvePresetGroupBlock(binding, {
      resolvedGroups: new Map(),
      customLabel: options.customLabel,
      customPositive: options.customPositive,
      customNegative: options.customNegative,
      sortOrder: options.sortOrder,
      missingReferences: options.missingReferences,
    });
  }

  const variant = resolveBindingVariant(binding, options.variants);

  if (!variant) {
    options.missingReferences.push({
      kind: "presetVariant",
      id: binding.variantId ?? `${binding.presetId}:default`,
      ownerId: binding.bindingKey,
    });
  }

  const resolved = variant
    ? resolvePresetVariantContentFromRows(variant.id, {
        variants: [...options.variants],
        variantLinks: [...options.variantLinks],
      })
    : null;
  if (resolved) options.missingReferences.push(...resolved.missingReferences);

  return {
    type: "preset",
    sourceId: binding.presetId,
    variantId: variant?.id ?? binding.variantId,
    ...(binding.presetGroupId ? { presetGroupId: binding.presetGroupId } : {}),
    categoryId: binding.categoryId,
    bindingId: binding.bindingKey,
    groupBindingId: binding.groupBindingKey,
    label: options.customLabel ?? buildPresetBlockLabel(binding, variant, options.variants),
    positive: options.customPositive ?? resolved?.prompt ?? "",
    negative: options.customNegative ?? resolved?.negativePrompt ?? null,
    sortOrder: options.sortOrder,
  };
}

function resolveCustomBlock(row: ResolveSectionConfigInput["promptBlockRows"][number]): ResolvedPromptBlock {
  return {
    type: row.type,
    sourceId: null,
    variantId: null,
    categoryId: null,
    bindingId: null,
    groupBindingId: null,
    label: row.customLabel ?? "Custom",
    positive: row.customPositive ?? "",
    negative: row.customNegative ?? null,
    sortOrder: row.sortOrder,
  };
}

function resolvePromptBlocks(
  input: ResolveSectionConfigInput,
  variants: readonly PresetVariantRow[],
  missingReferences: MissingReference[],
) {
  const bindingById = new Map(input.presetBindings.map((binding) => [binding.id, binding]));
  const groupById = resolvedGroupsById(input);
  const blockBindingIds = new Set<string>();
  const sortableBlocks: PromptBlockSortInput[] = [];
  let index = 0;

  for (const row of input.promptBlockRows) {
    const binding = row.sectionBindingId ? bindingById.get(row.sectionBindingId) : null;
    if (row.sectionBindingId) blockBindingIds.add(row.sectionBindingId);

    if (binding) {
      if (isPresetGroupBinding(binding)) {
        const groupBlocks = resolvePresetGroupMemberBlocks(binding, {
          resolvedGroups: groupById,
          sortOrder: row.sortOrder,
          index,
          missingReferences,
        });
        sortableBlocks.push(...groupBlocks);
        index += groupBlocks.length;
        continue;
      }

      const block = resolvePresetBlock(binding, {
        variants,
        variantLinks: input.variantLinks ?? [],
        customLabel: row.customLabel,
        customPositive: row.customPositive,
        customNegative: row.customNegative,
        sortOrder: row.sortOrder,
        missingReferences,
      });
      sortableBlocks.push({
        block,
        rowSortOrder: row.sortOrder,
        categoryOrder: binding.category.positivePromptOrder,
        bindingSortOrder: binding.sortOrder,
        index,
      });
    } else {
      if (row.sectionBindingId) {
        missingReferences.push({ kind: "sectionBinding", id: row.sectionBindingId, ownerId: row.id });
      }
      sortableBlocks.push({
        block: resolveCustomBlock(row),
        rowSortOrder: row.sortOrder,
        index,
      });
    }
    index += 1;
  }

  for (const binding of input.presetBindings) {
    if (blockBindingIds.has(binding.id)) continue;

    if (isPresetGroupBinding(binding)) {
      const groupBlocks = resolvePresetGroupMemberBlocks(binding, {
        resolvedGroups: groupById,
        sortOrder: binding.sortOrder,
        index,
        missingReferences,
      });
      sortableBlocks.push(...groupBlocks);
      index += groupBlocks.length;
      continue;
    }

    const block = resolvePresetBlock(binding, {
      variants,
      variantLinks: input.variantLinks ?? [],
      sortOrder: binding.sortOrder,
      missingReferences,
    });
    sortableBlocks.push({
      block,
      categoryOrder: binding.category.positivePromptOrder,
      bindingSortOrder: binding.sortOrder,
      index,
    });
    index += 1;
  }

  return sortResolvedPromptBlocks(sortableBlocks);
}

function readMetadataSuppressed(metadata: unknown) {
  return isRecord(metadata) && metadata.suppressed === true;
}

function resolveStage(value: string): LoraStage | null {
  if (value === "lora1" || value === "lora2") return value;
  return null;
}

function detachedBindingKey(
  row: SectionManualLoraEntryRow,
  bindingById: Map<string, SectionPresetBindingRow>,
) {
  if (row.detachedFromBindingKey) return row.detachedFromBindingKey;
  if (!row.sectionBindingId) return null;
  return bindingById.get(row.sectionBindingId)?.bindingKey ?? null;
}

function buildSuppressedPresetPathKeys(
  rows: readonly SectionManualLoraEntryRow[],
  bindingById: Map<string, SectionPresetBindingRow>,
) {
  const keys = new Set<string>();

  for (const row of rows) {
    const stage = resolveStage(row.stage);
    if (!stage || !row.detachedFromPath) continue;

    const bindingKey = detachedBindingKey(row, bindingById);
    if (!bindingKey) continue;
    keys.add(`${stage}:${bindingKey}:${row.detachedFromPath}`);
  }

  return keys;
}

function isPresetPathSuppressed(
  stage: LoraStage,
  bindingKey: string,
  path: string,
  suppressedPresetPathKeys: Set<string>,
) {
  return suppressedPresetPathKeys.has(`${stage}:${bindingKey}:${path}`);
}

function makePresetLoraEntry(
  binding: SectionPresetBindingRow,
  stage: LoraStage,
  index: number,
  lora: { path: string; weight: number; enabled: boolean },
): ResolvedLoraEntry {
  return {
    id: `preset:${binding.bindingKey}:${stage}:${index}:${lora.path}`,
    path: lora.path,
    weight: lora.weight,
    enabled: lora.enabled,
    source: "preset",
    sourceLabel: binding.category.name,
    sourceColor: binding.category.color ?? undefined,
    sourceName: binding.preset?.name ?? binding.presetGroup?.name,
    bindingId: binding.bindingKey,
    groupBindingId: binding.groupBindingKey ?? undefined,
  };
}

function makePresetGroupLoraEntry(
  binding: SectionPresetBindingRow,
  group: ResolvedPresetGroupContent,
  member: ResolvedPresetGroupContent["members"][number],
  stage: LoraStage,
  memberIndex: number,
  loraIndex: number,
  lora: { path: string; weight: number; enabled: boolean },
): ResolvedLoraEntry {
  return {
    id: `preset:${binding.bindingKey}:${stage}:${memberIndex}:${loraIndex}:${lora.path}`,
    path: lora.path,
    weight: lora.weight,
    enabled: lora.enabled,
    source: "preset",
    sourceLabel: member.categoryName,
    sourceColor: member.categoryColor ?? undefined,
    sourceName: `${group.name} / ${member.label}`,
    bindingId: binding.bindingKey,
    groupBindingId: binding.groupBindingKey ?? undefined,
  };
}

function makeManualLoraEntry(
  row: SectionManualLoraEntryRow,
  bindingById: Map<string, SectionPresetBindingRow>,
): ResolvedLoraEntry {
  const binding = row.sectionBindingId ? bindingById.get(row.sectionBindingId) : null;
  const detachedKey = detachedBindingKey(row, bindingById);
  const suppressed = readMetadataSuppressed(row.metadata);

  return {
    id: `manual:${row.id}`,
    path: row.path,
    weight: Math.round(row.weight * 100) / 100,
    enabled: suppressed ? false : row.enabled,
    source: "manual",
    bindingId: !row.detachedFromPath && binding ? binding.bindingKey : undefined,
    groupBindingId: !row.detachedFromPath && binding?.groupBindingKey ? binding.groupBindingKey : undefined,
    detachedBindingId: detachedKey ?? undefined,
    detachedGroupBindingId: row.detachedFromPath && binding?.groupBindingKey ? binding.groupBindingKey : undefined,
    detachedPresetPath: row.detachedFromPath ?? undefined,
    suppressed: suppressed ? true : undefined,
  };
}

function resolveLoraConfig(
  input: ResolveSectionConfigInput,
  variants: readonly PresetVariantRow[],
  missingReferences: MissingReference[],
): SectionLoraConfig {
  const bindingById = new Map(input.presetBindings.map((binding) => [binding.id, binding]));
  const groupById = resolvedGroupsById(input);
  const suppressedPresetPathKeys = buildSuppressedPresetPathKeys(input.manualLoraEntries, bindingById);
  const sortable: Record<LoraStage, LoraSortInput[]> = {
    lora1: [],
    lora2: [],
  };
  let index = 0;

  for (const binding of input.presetBindings) {
    if (isPresetGroupBinding(binding)) {
      const group = binding.presetGroupId ? groupById.get(binding.presetGroupId) ?? null : null;
      if (!group) continue;

      for (const stage of ["lora1", "lora2"] as const) {
        group.members.forEach((member, memberIndex) => {
          const order = stage === "lora1" ? member.lora1Order : member.lora2Order;
          member[stage].forEach((lora, loraIndex) => {
            if (isPresetPathSuppressed(stage, binding.bindingKey, lora.path, suppressedPresetPathKeys)) return;

            sortable[stage].push({
              entry: makePresetGroupLoraEntry(binding, group, member, stage, memberIndex, loraIndex, lora),
              order,
              secondaryOrder: binding.sortOrder,
              index,
            });
            index += 1;
          });
        });
      }
      continue;
    }

    const variant = resolveBindingVariant(binding, variants);
    if (!variant) continue;

    const resolved = resolvePresetVariantContentFromRows(variant.id, {
      variants: [...variants],
      variantLinks: input.variantLinks ?? [],
    });
    missingReferences.push(...resolved.missingReferences);

    for (const stage of ["lora1", "lora2"] as const) {
      const order = stage === "lora1" ? binding.category.lora1Order : binding.category.lora2Order;
      resolved[stage].forEach((lora, loraIndex) => {
        if (isPresetPathSuppressed(stage, binding.bindingKey, lora.path, suppressedPresetPathKeys)) return;

        sortable[stage].push({
          entry: makePresetLoraEntry(binding, stage, loraIndex, lora),
          order,
          secondaryOrder: binding.sortOrder,
          index,
        });
        index += 1;
      });
    }
  }

  for (const row of input.manualLoraEntries) {
    const stage = resolveStage(row.stage);
    if (!stage) continue;

    sortable[stage].push({
      entry: makeManualLoraEntry(row, bindingById),
      order: row.sortOrder,
      secondaryOrder: 0,
      index,
    });
    index += 1;
  }

  return {
    lora1: dedupeLoraEntriesByPath(sortResolvedLoras(sortable.lora1)),
    lora2: dedupeLoraEntriesByPath(sortResolvedLoras(sortable.lora2)),
  };
}

export function resolveSectionConfigFromRows(input: ResolveSectionConfigInput): ResolvedSectionConfig {
  const variants = collectPresetVariants(input);
  const missingReferences: MissingReference[] = [];
  const promptBlocks = resolvePromptBlocks(input, variants, missingReferences);
  const loraConfig = resolveLoraConfig(input, variants, missingReferences);

  return buildResolvedSectionConfig(input, promptBlocks, loraConfig, missingReferences);
}

async function resolveInitialVariantIds(
  bindings: readonly SectionPresetBindingRow[],
  client: SectionResolverDbClient,
) {
  const variantIds: string[] = [];

  for (const binding of bindings) {
    if (!binding.presetId) continue;
    if (binding.variantId) {
      variantIds.push(binding.variantId);
      continue;
    }

    const localDefaultVariant = sortBySortOrder(
      (binding.preset?.variants ?? []).filter((variant) => variant.isActive !== false),
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

export async function resolveSectionConfig(
  sectionId: string,
  client?: SectionResolverDbClient,
) {
  const db = client ?? ((await import("@/lib/prisma")).prisma as SectionResolverDbClient);
  const section = await db.projectSection.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      aspectRatio: true,
      aspectRatios: true,
      shortSidePx: true,
      batchSize: true,
      seedPolicy1: true,
      seedPolicy2: true,
      upscaleFactor: true,
      checkpointName: true,
      ksampler1: true,
      ksampler2: true,
      extraParams: true,
      project: {
        select: {
          checkpointName: true,
          projectLevelOverrides: true,
        },
      },
      presetBindingRows: {
        select: {
          id: true,
          projectSectionId: true,
          bindingKey: true,
          categoryId: true,
          presetId: true,
          variantId: true,
          presetGroupId: true,
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
          presetGroup: {
            select: {
              id: true,
              categoryId: true,
              name: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      sectionPromptBlocks: {
        select: {
          id: true,
          projectSectionId: true,
          sectionBindingId: true,
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
          projectSectionId: true,
          sectionBindingId: true,
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

  if (!section) return null;

  const resolverInput: ResolveSectionConfigInput = {
    section,
    presetBindings: section.presetBindingRows,
    promptBlockRows: section.sectionPromptBlocks,
    manualLoraEntries: section.manualLoraEntries,
    presetVariants: [],
    variantLinks: [],
  };

  const initialVariantIds = await resolveInitialVariantIds(section.presetBindingRows, db);
  const presetGroupIds = section.presetBindingRows
    .filter(isPresetGroupBinding)
    .map((binding) => binding.presetGroupId)
    .filter((groupId): groupId is string => Boolean(groupId));
  const canResolvePresetGroups = Boolean(db.presetGroup && db.preset && db.presetVariant && db.presetVariantLink);
  const [variantGraph, presetGroupResolutions] = await Promise.all([
    loadReachablePresetVariantGraph(initialVariantIds, db),
    presetGroupIds.length > 0 && canResolvePresetGroups
      ? resolvePresetGroupContents(presetGroupIds, db as PresetGroupResolverDbClient)
      : Promise.resolve([]),
  ]);

  return resolveSectionConfigFromRows({
    ...resolverInput,
    presetVariants: variantGraph.variants,
    variantLinks: variantGraph.variantLinks,
    presetGroupResolutions,
  });
}
