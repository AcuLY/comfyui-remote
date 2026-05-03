"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import { resolveVariantContent } from "./preset-variant";
import { createBindingId, createLoraEntryId, toJsonValue } from "./_helpers";
import type { PresetBinding } from "./project";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateProjectTemplateInput = {
  name: string;
  description?: string | null;
  sections: ProjectTemplateSectionData[];
};

export type UpdateProjectTemplateInput = {
  id: string;
  name?: string;
  description?: string | null;
  sections?: ProjectTemplateSectionData[];
};

export type UpdateProjectTemplateSectionInput = {
  templateId: string;
  sectionId: string;
  section: ProjectTemplateSectionData;
};

type ImportLoraEntry = {
  id: string;
  path: string;
  weight: number;
  enabled: boolean;
  source: "preset" | "manual";
  sourceLabel?: string;
  sourceColor?: string;
  sourceName?: string;
  bindingId?: string;
  groupBindingId?: string;
};

type TemplateSectionJsonBlock = {
  type?: string | null;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  sortOrder: number;
};

export type TemplatePresetImportInput = {
  presetId: string;
  variantId?: string | null;
};

export type TemplateResolvedPresetImport = {
  presetId: string;
  presetName: string;
  variantId: string;
  variantName: string;
  label: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryOrders: {
    positivePromptOrder: number;
    lora1Order: number;
    lora2Order: number;
  };
};

// ---------------------------------------------------------------------------
// Project Template CRUD
// ---------------------------------------------------------------------------

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildTemplateSectionUpdateData(section: ProjectTemplateSectionData) {
  return {
    name: section.name,
    notes: section.notes,
    aspectRatio: section.aspectRatio,
    shortSidePx: section.shortSidePx,
    batchSize: section.batchSize,
    seedPolicy1: section.seedPolicy1,
    seedPolicy2: section.seedPolicy2,
    ksampler1: toNullableJsonValue(section.ksampler1),
    ksampler2: toNullableJsonValue(section.ksampler2),
    upscaleFactor: section.upscaleFactor,
    checkpointName: section.checkpointName,
    loraConfig: toNullableJsonValue(section.loraConfig),
    extraParams: toNullableJsonValue(section.extraParams),
    promptBlocks:
      section.promptBlocks.length > 0
        ? toNullableJsonValue(section.promptBlocks)
        : Prisma.DbNull,
  };
}

function hasEquivalentTemplateLoraEntry(
  entries: ImportLoraEntry[],
  candidate: ImportLoraEntry,
) {
  const isBoundCandidate = Boolean(candidate.bindingId || candidate.groupBindingId);
  return entries.some((existing) => {
    if (existing.path !== candidate.path) return false;
    if (!isBoundCandidate) return true;
    return (
      existing.bindingId === candidate.bindingId &&
      existing.groupBindingId === candidate.groupBindingId
    );
  });
}

function findProjectLevelTemplateBindings(
  blocks: TemplateSectionJsonBlock[],
  projectBindings: PresetBinding[],
) {
  const projectLevelBlockIndexes = new Set<number>();
  const projectLevelBindingIds = new Set<string>();

  for (const binding of projectBindings) {
    const blockIndex = blocks.findIndex(
      (block, index) =>
        !projectLevelBlockIndexes.has(index) &&
        block.type === "preset" &&
        !block.groupBindingId &&
        block.sourceId === binding.presetId &&
        (!binding.categoryId || block.categoryId === binding.categoryId),
    );

    if (blockIndex < 0) continue;
    projectLevelBlockIndexes.add(blockIndex);
    const bindingId = blocks[blockIndex].bindingId;
    if (bindingId) projectLevelBindingIds.add(bindingId);
  }

  return { projectLevelBlockIndexes, projectLevelBindingIds };
}

export async function createProjectTemplate(
  input: CreateProjectTemplateInput,
): Promise<string> {
  const template = await prisma.projectTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      sections: {
        create: input.sections.map((s, index) => ({
          sortOrder: s.sortOrder ?? index,
          name: s.name,
          notes: s.notes,
          aspectRatio: s.aspectRatio,
          shortSidePx: s.shortSidePx,
          batchSize: s.batchSize,
          seedPolicy1: s.seedPolicy1,
          seedPolicy2: s.seedPolicy2,
          ksampler1: s.ksampler1 ? toJsonValue(s.ksampler1) : undefined,
          ksampler2: s.ksampler2 ? toJsonValue(s.ksampler2) : undefined,
          upscaleFactor: s.upscaleFactor,
          checkpointName: s.checkpointName,
          loraConfig: s.loraConfig ? toJsonValue(s.loraConfig) : undefined,
          extraParams: s.extraParams ? toJsonValue(s.extraParams) : undefined,
          promptBlocks:
            s.promptBlocks.length > 0 ? toJsonValue(s.promptBlocks) : undefined,
        })),
      },
    },
  });
  revalidatePath("/assets/templates");
  return template.id;
}

export async function updateProjectTemplate(
  input: UpdateProjectTemplateInput,
): Promise<void> {
  const { id, sections, ...rest } = input;

  await prisma.$transaction(async (tx) => {
    await tx.projectTemplate.update({
      where: { id },
      data: {
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.description !== undefined ? { description: rest.description } : {}),
      },
    });

    if (sections) {
      await tx.projectTemplateSection.deleteMany({
        where: { projectTemplateId: id },
      });
      if (sections.length > 0) {
        await tx.projectTemplateSection.createMany({
          data: sections.map((s, index) => ({
            projectTemplateId: id,
            sortOrder: s.sortOrder ?? index,
            name: s.name,
            notes: s.notes,
            aspectRatio: s.aspectRatio,
            shortSidePx: s.shortSidePx,
            batchSize: s.batchSize,
            seedPolicy1: s.seedPolicy1,
            seedPolicy2: s.seedPolicy2,
            ksampler1: s.ksampler1
              ? (JSON.parse(JSON.stringify(s.ksampler1)) as Prisma.InputJsonValue)
              : undefined,
            ksampler2: s.ksampler2
              ? (JSON.parse(JSON.stringify(s.ksampler2)) as Prisma.InputJsonValue)
              : undefined,
            upscaleFactor: s.upscaleFactor,
            checkpointName: s.checkpointName,
            loraConfig: s.loraConfig
              ? (JSON.parse(JSON.stringify(s.loraConfig)) as Prisma.InputJsonValue)
              : undefined,
            extraParams: s.extraParams
              ? (JSON.parse(JSON.stringify(s.extraParams)) as Prisma.InputJsonValue)
              : undefined,
            promptBlocks:
              s.promptBlocks.length > 0
                ? (JSON.parse(JSON.stringify(s.promptBlocks)) as Prisma.InputJsonValue)
                : undefined,
          })),
        });
      }
    }
  });

  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${id}/edit`);
}

export async function updateProjectTemplateSection(
  input: UpdateProjectTemplateSectionInput,
): Promise<void> {
  const existing = await prisma.projectTemplateSection.findFirst({
    where: {
      id: input.sectionId,
      projectTemplateId: input.templateId,
    },
    select: { id: true, sortOrder: true },
  });

  if (!existing) throw new Error("TEMPLATE_SECTION_NOT_FOUND");

  await prisma.projectTemplateSection.update({
    where: { id: input.sectionId },
    data: buildTemplateSectionUpdateData(input.section),
  });

  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${input.templateId}/edit`);
  revalidatePath(`/assets/templates/${input.templateId}/sections/${existing.sortOrder}`);
}

export async function deleteProjectTemplate(
  templateId: string,
): Promise<void> {
  await prisma.projectTemplate.delete({ where: { id: templateId } });
  revalidatePath("/assets/templates");
}

export async function copyProjectTemplateSection(sectionId: string): Promise<string | null> {
  const section = await prisma.projectTemplateSection.findUnique({
    where: { id: sectionId },
  });

  if (!section) return null;

  const count = await prisma.projectTemplateSection.count({
    where: { projectTemplateId: section.projectTemplateId },
  });

  const copied = await prisma.projectTemplateSection.create({
    data: {
      projectTemplateId: section.projectTemplateId,
      sortOrder: count,
      name: section.name ? `${section.name} (副本)` : null,
      notes: section.notes,
      aspectRatio: section.aspectRatio,
      shortSidePx: section.shortSidePx,
      batchSize: section.batchSize,
      seedPolicy1: section.seedPolicy1,
      seedPolicy2: section.seedPolicy2,
      ksampler1: section.ksampler1 ?? undefined,
      ksampler2: section.ksampler2 ?? undefined,
      upscaleFactor: section.upscaleFactor ?? undefined,
      checkpointName: section.checkpointName,
      loraConfig: section.loraConfig ?? undefined,
      extraParams: section.extraParams ?? undefined,
      promptBlocks: section.promptBlocks ?? undefined,
    },
  });

  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${section.projectTemplateId}/edit`);
  return copied.id;
}

export async function getTemplateOptionsForClient(): Promise<
  Array<{ id: string; name: string; sectionCount: number }>
> {
  const templates = await prisma.projectTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, _count: { select: { sections: true } } },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    sectionCount: t._count.sections,
  }));
}

export async function resolveTemplatePresetImports(
  inputs: TemplatePresetImportInput[],
): Promise<TemplateResolvedPresetImport[]> {
  const presetIds = [...new Set(inputs.map((input) => input.presetId))];
  if (presetIds.length === 0) return [];

  const presets = await prisma.preset.findMany({
    where: { id: { in: presetIds } },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          positivePromptOrder: true,
          lora1Order: true,
          lora2Order: true,
        },
      },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  const presetMap = new Map(presets.map((preset) => [preset.id, preset]));
  const resolvedItems: TemplateResolvedPresetImport[] = [];

  for (const input of inputs) {
    const preset = presetMap.get(input.presetId);
    if (!preset) continue;

    const variant = input.variantId
      ? preset.variants.find((item) => item.id === input.variantId)
      : preset.variants[0];
    if (!variant) continue;

    const resolved = await resolveVariantContent(variant.id);
    resolvedItems.push({
      presetId: preset.id,
      presetName: preset.name,
      variantId: variant.id,
      variantName: variant.name,
      label: preset.variants.length === 1 ? preset.name : `${preset.name} / ${variant.name}`,
      prompt: resolved.prompt,
      negativePrompt: resolved.negativePrompt,
      lora1: resolved.lora1,
      lora2: resolved.lora2,
      categoryId: preset.category.id,
      categoryName: preset.category.name,
      categoryColor: preset.category.color,
      categoryOrders: {
        positivePromptOrder: preset.category.positivePromptOrder,
        lora1Order: preset.category.lora1Order,
        lora2Order: preset.category.lora2Order,
      },
    });
  }

  return resolvedItems;
}

// ---------------------------------------------------------------------------
// Import Template into Project
// ---------------------------------------------------------------------------

export type TemplateImportDuplicatePolicy = "skip" | "replace" | "append" | "error";

export type TemplateImportOptions = {
  dryRun?: boolean;
  onExistingSections?: TemplateImportDuplicatePolicy;
};

export type TemplateImportPlanItem = {
  templateSectionId: string;
  templateSectionName: string | null;
  sortOrder: number;
  action: "import" | "skip" | "error";
  reason?: string;
};

export type TemplateImportResult = {
  dryRun: boolean;
  onExistingSections: TemplateImportDuplicatePolicy;
  importedCount: number;
  skippedCount: number;
  replacedExistingCount: number;
  sections: TemplateImportPlanItem[];
};

export async function importTemplateToProject(
  projectId: string,
  templateId: string,
): Promise<number>;
export async function importTemplateToProject(
  projectId: string,
  templateId: string,
  options: TemplateImportOptions,
): Promise<TemplateImportResult>;
export async function importTemplateToProject(
  projectId: string,
  templateId: string,
  options?: TemplateImportOptions,
): Promise<number | TemplateImportResult> {
  const onExistingSections = options?.onExistingSections ?? "append";
  const dryRun = options?.dryRun ?? false;

  const template = await prisma.projectTemplate.findUnique({
    where: { id: templateId },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      presetBindings: true,
      checkpointName: true,
      sections: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, sortOrder: true },
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const currentSectionCount = project.sections.length;
  const existingSectionNames = new Set(
    project.sections
      .map((section) => section.name?.trim().toLocaleLowerCase())
      .filter((name): name is string => Boolean(name)),
  );
  const plan: TemplateImportPlanItem[] = template.sections.map((section) => {
    const sectionName = section.name?.trim().toLocaleLowerCase();
    const hasDuplicate = Boolean(sectionName && existingSectionNames.has(sectionName));

    if (hasDuplicate && onExistingSections === "skip") {
      return {
        templateSectionId: section.id,
        templateSectionName: section.name,
        sortOrder: section.sortOrder,
        action: "skip",
        reason: "Section name already exists in project",
      };
    }

    if (hasDuplicate && onExistingSections === "error") {
      return {
        templateSectionId: section.id,
        templateSectionName: section.name,
        sortOrder: section.sortOrder,
        action: "error",
        reason: "Section name already exists in project",
      };
    }

    return {
      templateSectionId: section.id,
      templateSectionName: section.name,
      sortOrder: section.sortOrder,
      action: "import",
    };
  });
  const erroredSections = plan.filter((item) => item.action === "error");
  const sectionsToImport = template.sections.filter((section) =>
    plan.some((item) => item.templateSectionId === section.id && item.action === "import"),
  );
  const plannedResult: TemplateImportResult = {
    dryRun,
    onExistingSections,
    importedCount: sectionsToImport.length,
    skippedCount: plan.filter((item) => item.action === "skip").length,
    replacedExistingCount: onExistingSections === "replace" ? currentSectionCount : 0,
    sections: plan,
  };

  if (dryRun) {
    return plannedResult;
  }
  if (erroredSections.length > 0) {
    throw new Error("TEMPLATE_IMPORT_DUPLICATE_SECTIONS");
  }

  // Resolve project presetBindings
  const bindings = Array.isArray(project.presetBindings)
    ? (project.presetBindings as PresetBinding[])
    : [];

  // Fetch presets for project bindings
  const presets = bindings.length > 0
    ? await prisma.preset.findMany({
        where: { id: { in: bindings.map((b) => b.presetId) } },
        include: {
          category: true,
          variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      })
    : [];
  const presetMap = new Map(presets.map((p) => [p.id, p]));

  // Fetch all categories for order lookup
  const allCategories = await prisma.presetCategory.findMany({
    select: { id: true, name: true, positivePromptOrder: true, lora1Order: true, lora2Order: true },
  });
  const catByIdMap = new Map(allCategories.map((c) => [c.id, c]));
  const catByNameMap = new Map(allCategories.map((c) => [c.name, c]));

  await prisma.$transaction(async (tx) => {
    if (onExistingSections === "replace") {
      await tx.projectSection.deleteMany({ where: { projectId } });
    }

    const sortOrderBase = onExistingSections === "replace" ? 0 : currentSectionCount;

    for (let i = 0; i < sectionsToImport.length; i++) {
      const ts = sectionsToImport[i];

      // 1. Create section with basic params
      const section = await tx.projectSection.create({
        data: {
          projectId,
          sortOrder: sortOrderBase + i + 1,
          enabled: true,
          name: ts.name,
          ...(ts.aspectRatio ? { aspectRatio: ts.aspectRatio } : {}),
          ...(ts.shortSidePx ? { shortSidePx: ts.shortSidePx } : {}),
          ...(ts.batchSize ? { batchSize: ts.batchSize } : {}),
          ...(ts.seedPolicy1 ? { seedPolicy1: ts.seedPolicy1 } : {}),
          ...(ts.seedPolicy2 ? { seedPolicy2: ts.seedPolicy2 } : {}),
          ...(ts.ksampler1 ? { ksampler1: ts.ksampler1 } : {}),
          ...(ts.ksampler2 ? { ksampler2: ts.ksampler2 } : {}),
          ...(ts.upscaleFactor ? { upscaleFactor: ts.upscaleFactor } : {}),
          ...(ts.checkpointName ? { checkpointName: ts.checkpointName } : {}),
          extraParams: ts.extraParams ?? undefined,
        },
      });

      const templateBindingIdMap = new Map<string, string>();
      const templateGroupBindingIdMap = new Map<string, string>();

      // 2. Collect all blocks (from project bindings + from template)
      const allBlocks: Array<{
        type: "preset" | "custom";
        sourceId: string | null;
        variantId: string | null;
        categoryId: string | null;
        bindingId: string | null;
        groupBindingId: string | null;
        label: string;
        positive: string;
        negative: string | null;
        positivePromptOrder: number;
        loras: { lora1: ImportLoraEntry[]; lora2: ImportLoraEntry[] };
      }> = [];

      // 2a. Add blocks from project bindings
      for (const binding of bindings) {
        const preset = presetMap.get(binding.presetId);
        if (!preset) continue;

        const variant = binding.variantId
          ? preset.variants.find((v) => v.id === binding.variantId)
          : preset.variants[0];
        if (!variant) continue;

        const resolved = await resolveVariantContent(variant.id);
        const bindingId = createBindingId();

        const catOrder = preset.category?.positivePromptOrder ?? 999;

        const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
          id: createLoraEntryId(),
          path: b.path,
          weight: b.weight,
          enabled: b.enabled,
          source: "preset" as const,
          sourceLabel: preset.category?.name,
          sourceColor: preset.category?.color ?? undefined,
          sourceName: preset.name,
          bindingId,
        });

        allBlocks.push({
          type: "preset",
          sourceId: preset.id,
          variantId: variant.id,
          categoryId: preset.categoryId,
          bindingId,
          groupBindingId: null,
          label: preset.variants.length === 1 ? preset.name : `${preset.name} / ${variant.name}`,
          positive: resolved.prompt,
          negative: resolved.negativePrompt,
          positivePromptOrder: catOrder,
          loras: {
            lora1: resolved.lora1.map(makeLora),
            lora2: resolved.lora2.map(makeLora),
          },
        });
      }

      // 2b. Add blocks from template
      const tplBlocks = ts.promptBlocks;
      if (Array.isArray(tplBlocks)) {
        // Build mapping for bindingIds (old -> new)
        const bindingIdMap = templateBindingIdMap;
        const groupBindingIdMap = templateGroupBindingIdMap;

        for (const rawBlock of tplBlocks) {
          if (!rawBlock || typeof rawBlock !== "object") continue;
          const block = rawBlock as Record<string, unknown>;

          if (block.type === "preset") {
            if (typeof block.bindingId === "string" && !bindingIdMap.has(block.bindingId)) {
              bindingIdMap.set(block.bindingId, createBindingId());
            }
            if (typeof block.groupBindingId === "string" && !groupBindingIdMap.has(block.groupBindingId)) {
              groupBindingIdMap.set(block.groupBindingId, `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
            }
          }
        }

        for (const rawBlock of tplBlocks) {
          if (!rawBlock || typeof rawBlock !== "object") continue;
          const block = rawBlock as Record<string, unknown>;
          const positive = typeof block.positive === "string" ? block.positive : "";
          if (!positive.trim()) continue;

          const blockType = block.type === "preset" ? "preset" : "custom";
          const categoryId = typeof block.categoryId === "string" ? block.categoryId : null;
          const sourceId = blockType === "preset" && typeof block.sourceId === "string" ? block.sourceId : null;
          const variantId = blockType === "preset" && typeof block.variantId === "string" ? block.variantId : null;
          const catOrder = categoryId ? (catByIdMap.get(categoryId)?.positivePromptOrder ?? 999) : 999;

          const oldBindingId = typeof block.bindingId === "string" ? block.bindingId : null;
          const oldGroupBindingId = typeof block.groupBindingId === "string" ? block.groupBindingId : null;
          const newBindingId = oldBindingId ? (bindingIdMap.get(oldBindingId) ?? null) : null;
          const newGroupBindingId = oldGroupBindingId ? (groupBindingIdMap.get(oldGroupBindingId) ?? null) : null;

          // Collect loras for this block (will be merged later)
          const blockLoras: { lora1: ImportLoraEntry[]; lora2: ImportLoraEntry[] } = { lora1: [], lora2: [] };

          allBlocks.push({
            type: blockType,
            sourceId,
            variantId,
            categoryId,
            bindingId: newBindingId,
            groupBindingId: newGroupBindingId,
            label: (typeof block.label === "string" ? block.label : null) || `Block ${allBlocks.length + 1}`,
            positive,
            negative: typeof block.negative === "string" ? block.negative : null,
            positivePromptOrder: catOrder,
            loras: blockLoras, // Template blocks don't carry loras directly; loras are in loraConfig
          });
        }
      }

      // 3. Sort all blocks by positivePromptOrder
      allBlocks.sort((a, b) => a.positivePromptOrder - b.positivePromptOrder);

      // 4. Create blocks in sorted order
      const positiveParts: string[] = [];
      const negativeParts: string[] = [];
      const loraConfig: { lora1: ImportLoraEntry[]; lora2: ImportLoraEntry[] } = { lora1: [], lora2: [] };

      for (let sortOrder = 0; sortOrder < allBlocks.length; sortOrder++) {
        const block = allBlocks[sortOrder];

        await tx.promptBlock.create({
          data: {
            projectSectionId: section.id,
            type: block.type,
            sourceId: block.sourceId,
            variantId: block.variantId,
            categoryId: block.categoryId,
            bindingId: block.bindingId,
            groupBindingId: block.groupBindingId,
            label: block.label,
            positive: block.positive,
            negative: block.negative,
            sortOrder,
          },
        });

        if (block.positive?.trim()) positiveParts.push(block.positive.trim());
        if (block.negative?.trim()) negativeParts.push(block.negative.trim());

        // Add loras from this block (deduplicate by path)
        for (const l of block.loras.lora1) {
          if (!loraConfig.lora1.some((e) => e.path === l.path)) {
            loraConfig.lora1.push(l);
          }
        }
        for (const l of block.loras.lora2) {
          if (!loraConfig.lora2.some((e) => e.path === l.path)) {
            loraConfig.lora2.push(l);
          }
        }
      }

      // 5. Add loras from template loraConfig (not associated with specific blocks)
      const tplLoraConfig = ts.loraConfig as Record<string, unknown> | null;
      if (tplLoraConfig) {
        // Build bindingId mapping for template loras
        const loraBindingIdMap = templateBindingIdMap;
        const loraGroupBindingIdMap = templateGroupBindingIdMap;

        const buildLoraBindingMaps = (arr: unknown) => {
          if (!Array.isArray(arr)) return;
          for (const e of arr) {
            if (typeof e !== "object" || e === null) continue;
            const entry = e as Record<string, unknown>;
            if (entry.source === "preset") {
              if (typeof entry.bindingId === "string" && !loraBindingIdMap.has(entry.bindingId)) {
                loraBindingIdMap.set(entry.bindingId, createBindingId());
              }
              if (typeof entry.groupBindingId === "string" && !loraGroupBindingIdMap.has(entry.groupBindingId)) {
                loraGroupBindingIdMap.set(entry.groupBindingId, `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
              }
            }
          }
        };
        buildLoraBindingMaps(tplLoraConfig.lora1);
        buildLoraBindingMaps(tplLoraConfig.lora2);

        const appendTemplateLoras = (arr: unknown, dimension: "lora1" | "lora2") => {
          if (!Array.isArray(arr)) return;
          for (const entry of arr) {
            if (typeof entry !== "object" || entry === null) continue;
            const e = entry as Record<string, unknown>;
            const path = typeof e.path === "string" ? e.path : "";
            if (!path) continue;

            const source = typeof e.source === "string" && e.source === "preset" ? "preset" : "manual";
            const sourceLabel = typeof e.sourceLabel === "string" ? e.sourceLabel : undefined;
            const sourceColor = typeof e.sourceColor === "string" ? e.sourceColor : undefined;
            const sourceName = typeof e.sourceName === "string" ? e.sourceName : undefined;

            const oldBindingId = typeof e.bindingId === "string" ? e.bindingId : undefined;
            const oldGroupBindingId = typeof e.groupBindingId === "string" ? e.groupBindingId : undefined;
            const newBindingId = oldBindingId ? (loraBindingIdMap.get(oldBindingId) ?? undefined) : undefined;
            const newGroupBindingId = oldGroupBindingId ? (loraGroupBindingIdMap.get(oldGroupBindingId) ?? undefined) : undefined;

            const nextEntry: ImportLoraEntry = {
              id: typeof e.id === "string" ? e.id : createLoraEntryId(),
              path,
              weight: typeof e.weight === "number" ? e.weight : 1,
              enabled: typeof e.enabled === "boolean" ? e.enabled : true,
              source,
              sourceLabel,
              sourceColor,
              sourceName,
              bindingId: newBindingId,
              groupBindingId: newGroupBindingId,
            };
            if (hasEquivalentTemplateLoraEntry(loraConfig[dimension], nextEntry)) continue;
            loraConfig[dimension].push(nextEntry);
          }
        };
        appendTemplateLoras(tplLoraConfig.lora1, "lora1");
        appendTemplateLoras(tplLoraConfig.lora2, "lora2");
      }

      // 6. Sort loras by category order
      for (const dim of ["lora1", "lora2"] as const) {
        const orderKey = dim === "lora1" ? "lora1Order" : "lora2Order";
        loraConfig[dim].sort((a, b) => {
          const aOrder = a.source === "preset" && a.sourceLabel
            ? (catByNameMap.get(a.sourceLabel)?.[orderKey] ?? 999)
            : 999;
          const bOrder = b.source === "preset" && b.sourceLabel
            ? (catByNameMap.get(b.sourceLabel)?.[orderKey] ?? 999)
            : 999;
          return aOrder - bOrder;
        });
      }

      // 7. Update section with composed prompts and loraConfig
      await tx.projectSection.update({
        where: { id: section.id },
        data: {
          positivePrompt: positiveParts.length > 0 ? positiveParts.join(" BREAK ") : undefined,
          negativePrompt: negativeParts.length > 0 ? negativeParts.join(" BREAK ") : undefined,
          loraConfig: (loraConfig.lora1.length > 0 || loraConfig.lora2.length > 0)
            ? (loraConfig as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }
  });

  revalidatePath(`/projects/${projectId}`);
  if (!options) {
    return sectionsToImport.length;
  }
  return plannedResult;
}

// ---------------------------------------------------------------------------
// Save Project as Template
// ---------------------------------------------------------------------------

export async function saveProjectAsTemplate(
  projectId: string,
  templateName: string,
  templateDescription?: string | null,
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      presetBindings: true,
      checkpointName: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          promptBlocks: {
            orderBy: { sortOrder: "asc" },
            select: {
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
          },
        },
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const projectBindings = Array.isArray(project.presetBindings)
    ? (project.presetBindings as PresetBinding[])
    : [];

  const template = await prisma.projectTemplate.create({
    data: {
      name: templateName,
      description: templateDescription ?? null,
      sections: {
        create: project.sections.map((section) => {
          const { projectLevelBlockIndexes, projectLevelBindingIds } =
            findProjectLevelTemplateBindings(section.promptBlocks, projectBindings);

          // Filter out blocks from project-level bindings, keep section-level imports
          // For section-level imports, preserve bindingId/groupBindingId for group relationship
          const templateBlocks = section.promptBlocks
            .filter((block, index) => {
              // Keep custom blocks
              if (block.type === "custom") return true;
              // For preset blocks: only drop the concrete block matched to a project-level binding.
              if (projectLevelBlockIndexes.has(index)) return false;
              return true;
            })
            .map((block) => ({
              type: block.type,
              label: block.label,
              positive: block.positive,
              negative: block.negative,
              sortOrder: block.sortOrder,
              categoryId: block.categoryId,
              // Preserve preset identity and binding ids for section-level imports
              sourceId: block.type === "preset" ? block.sourceId : undefined,
              variantId: block.type === "preset" ? block.variantId : undefined,
              bindingId: block.type === "preset" ? block.bindingId : undefined,
              groupBindingId: block.type === "preset" ? block.groupBindingId : undefined,
            }));

          // Filter out loras from project-level bindings, keep section-level imports
          const loraCfg = section.loraConfig as Record<string, unknown> | null;

          const filterLorasByBinding = (arr: unknown) => {
            if (!Array.isArray(arr)) return [];
            return arr
              .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
              .filter((e) => {
                // Keep manual loras
                if (e.source !== "preset") return true;
                // Preset-group members are section-level imports and must remain in templates.
                if (e.groupBindingId) return true;
                // Filter out loras from project-level bindings
                if (e.bindingId && projectLevelBindingIds.has(e.bindingId as string)) return false;
                return true;
              })
              .map((e) => ({
                id: e.id,
                path: e.path,
                weight: e.weight,
                enabled: e.enabled,
                source: e.source,
                sourceLabel: e.sourceLabel,
                sourceColor: e.sourceColor,
                sourceName: e.sourceName,
                // Preserve bindingId and groupBindingId for section-level imports
                bindingId: e.source === "preset" ? e.bindingId : undefined,
                groupBindingId: e.source === "preset" ? e.groupBindingId : undefined,
              }));
          };

          const templateLoraConfig = loraCfg
            ? { lora1: filterLorasByBinding(loraCfg.lora1), lora2: filterLorasByBinding(loraCfg.lora2) }
            : null;

          return {
            sortOrder: section.sortOrder,
            name: section.name,
            notes: null,
            aspectRatio: section.aspectRatio,
            shortSidePx: section.shortSidePx,
            batchSize: section.batchSize,
            seedPolicy1: section.seedPolicy1,
            seedPolicy2: section.seedPolicy2,
            ksampler1: section.ksampler1 ?? undefined,
            ksampler2: section.ksampler2 ?? undefined,
            upscaleFactor: section.upscaleFactor ?? undefined,
            checkpointName: section.checkpointName ?? project.checkpointName ?? DEFAULT_CHECKPOINT_NAME,
            loraConfig: (templateLoraConfig && (templateLoraConfig.lora1.length > 0 || templateLoraConfig.lora2.length > 0))
              ? templateLoraConfig
              : undefined,
            extraParams: section.extraParams ?? undefined,
            promptBlocks: templateBlocks.length > 0 ? templateBlocks : undefined,
          };
        }),
      },
    },
  });

  revalidatePath("/assets/templates");
  return template.id;
}
