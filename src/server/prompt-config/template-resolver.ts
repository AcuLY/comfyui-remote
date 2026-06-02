import { resolveSectionConfigFromRows } from "./section-resolver";
import { loadReachablePresetVariantGraph } from "./preset-resolver";
import { sortBySortOrder } from "./order";
import type {
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

type ProjectSectionForTemplateSave = {
  id: string;
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

function relationId(prefix: string, ownerId: string, key: string) {
  return `${prefix}:${ownerId}:${key}`;
}

function adaptTemplateInput(input: ResolveTemplateSectionConfigInput): ResolveSectionConfigInput {
  return {
    section: input.templateSection,
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
    presetVariants: [],
    variantLinks: [],
  };

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

  for (const binding of input.presetBindings) {
    if (isProjectLevelBinding(binding, projectLevelBindings)) {
      skippedSectionBindingIds.add(binding.id);
      continue;
    }

    const write = templateBindingWriteFromSectionBinding(input.projectTemplateSectionId, binding);
    presetBindings.push(write);
    sectionBindingIdToTemplateBindingId.set(binding.id, write.id);
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
      customPositive: row.customPositive,
      customNegative: row.customNegative,
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

export function buildProjectSectionRowsForTemplateImport(input: {
  projectSectionId: string;
  templateProjectPresetBindings?: readonly ProjectTemplatePresetBindingRow[];
  projectLevelBindings?: readonly ProjectLevelBindingLike[];
  templatePresetBindings: readonly TemplateSectionPresetBindingRow[];
  templatePromptBlocks: readonly TemplateSectionPromptBlockRow[];
  templateManualLoraEntries: readonly TemplateSectionManualLoraEntryRow[];
}) {
  const presetBindings: SectionPresetBindingWrite[] = [];
  const promptBlocks: SectionPromptBlockWrite[] = [];
  const manualLoraEntries: SectionManualLoraEntryWrite[] = [];
  const templateBindingIdToSectionBindingId = new Map<string, string>();
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
  }

  for (const binding of input.templatePresetBindings) {
    const write = sectionBindingWriteFromTemplateBinding(input.projectSectionId, binding);
    presetBindings.push(write);
    templateBindingIdToSectionBindingId.set(binding.id, write.id);
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
