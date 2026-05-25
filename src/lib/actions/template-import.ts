"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { resolveVariantContent } from "./preset-variant";
import { createBindingId, createLoraEntryId } from "./_helpers";
import type { PresetBinding } from "./project";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Import Template into Project
// ---------------------------------------------------------------------------

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
      const resolvedTemplatePresetBindingIds = new Set<string>();

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

      // Track preset IDs added from project bindings to avoid duplicates in step 2b
      const projectBindingPresetIds = new Set<string>();

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
        projectBindingPresetIds.add(preset.id);
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

          const blockType = block.type === "preset" ? "preset" : "custom";
          let categoryId = typeof block.categoryId === "string" ? block.categoryId : null;
          const sourceId = blockType === "preset" && typeof block.sourceId === "string" ? block.sourceId : null;
          let variantId = blockType === "preset" && typeof block.variantId === "string" ? block.variantId : null;
          let catOrder = categoryId ? (catByIdMap.get(categoryId)?.positivePromptOrder ?? 999) : 999;

          const oldGroupBindingId = typeof block.groupBindingId === "string" ? block.groupBindingId : null;

          // Skip template preset blocks already covered by project bindings
          // (unless they belong to a group — group members are always section-level)
          if (sourceId && !oldGroupBindingId && projectBindingPresetIds.has(sourceId)) {
            continue;
          }

          const oldBindingId = typeof block.bindingId === "string" ? block.bindingId : null;
          const newBindingId = oldBindingId ? (bindingIdMap.get(oldBindingId) ?? null) : (sourceId ? createBindingId() : null);
          const newGroupBindingId = oldGroupBindingId ? (groupBindingIdMap.get(oldGroupBindingId) ?? null) : null;

          // Collect loras for this block (will be merged later)
          const blockLoras: { lora1: ImportLoraEntry[]; lora2: ImportLoraEntry[] } = { lora1: [], lora2: [] };
          let label = (typeof block.label === "string" ? block.label : null) || `Block ${allBlocks.length + 1}`;
          let nextPositive = positive;
          let nextNegative = typeof block.negative === "string" ? block.negative : null;

          if (sourceId) {
            const preset = await tx.preset.findUnique({
              where: { id: sourceId },
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    positivePromptOrder: true,
                  },
                },
                variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
              },
            });
            const variant = preset
              ? (variantId
                  ? (preset.variants.find((item) => item.id === variantId) ?? preset.variants[0])
                  : preset.variants[0])
              : null;

            if (preset && variant && newBindingId) {
              const resolved = await resolveVariantContent(variant.id);
              variantId = variant.id;
              categoryId = preset.category.id;
              catOrder = preset.category.positivePromptOrder;
              label = preset.variants.length === 1 ? preset.name : `${preset.name} / ${variant.name}`;
              nextPositive = resolved.prompt;
              nextNegative = resolved.negativePrompt;
              if (oldBindingId) resolvedTemplatePresetBindingIds.add(oldBindingId);

              const makeLora = (entry: { path: string; weight: number; enabled: boolean }): ImportLoraEntry => ({
                id: createLoraEntryId(),
                path: entry.path,
                weight: entry.weight,
                enabled: entry.enabled,
                source: "preset",
                sourceLabel: preset.category.name,
                sourceColor: preset.category.color ?? undefined,
                sourceName: preset.name,
                bindingId: newBindingId,
                groupBindingId: newGroupBindingId ?? undefined,
              });

              blockLoras.lora1.push(...resolved.lora1.map(makeLora));
              blockLoras.lora2.push(...resolved.lora2.map(makeLora));
            }
          }

          if (!nextPositive.trim()) continue;

          allBlocks.push({
            type: blockType,
            sourceId,
            variantId,
            categoryId,
            bindingId: newBindingId,
            groupBindingId: newGroupBindingId,
            label,
            positive: nextPositive,
            negative: nextNegative,
            positivePromptOrder: catOrder,
            loras: blockLoras,
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

        // Add loras from this block while preserving distinct preset bindings.
        for (const l of block.loras.lora1) {
          if (hasEquivalentTemplateLoraEntry(loraConfig.lora1, l)) continue;
          loraConfig.lora1.push(l);
        }
        for (const l of block.loras.lora2) {
          if (hasEquivalentTemplateLoraEntry(loraConfig.lora2, l)) continue;
          loraConfig.lora2.push(l);
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
            if (oldBindingId && resolvedTemplatePresetBindingIds.has(oldBindingId)) continue;
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
