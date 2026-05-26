"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  parseSectionLoraConfig,
  serializeSectionLoraConfig,
  type SectionLoraConfig,
  type LoraEntry,
} from "@/lib/lora-types";
import { getDetachedPresetPaths } from "@/lib/preset-binding-utils";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import { createLoraEntryId, sortSectionLoraEntriesByCategoryOrder } from "./_helpers";
import { resolveVariantContent } from "./preset-variant";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetUsageInfo = {
  sections: Array<{
    sectionId: string;
    sectionName: string;
    projectTitle: string;
    blockCount: number;
  }>;
  totalBlocks: number;
};

type TemplatePromptBlockJson = Record<string, unknown> & {
  label?: string;
  positive?: string;
  negative?: string | null;
  sortOrder?: number;
  type?: string | null;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
};

// ---------------------------------------------------------------------------
// Preset usage check + cascade operations
// ---------------------------------------------------------------------------

/** Check which sections reference a given preset via PromptBlock.sourceId */
export async function getPresetUsage(presetId: string): Promise<PresetUsageInfo> {
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: {
      id: true,
      bindingId: true,
      projectSection: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
          project: { select: { title: true } },
        },
      },
    },
  });

  // Group by section
  const sectionMap = new Map<string, { sectionId: string; sectionName: string; projectTitle: string; blockCount: number }>();
  for (const block of blocks) {
    const sec = block.projectSection;
    const existing = sectionMap.get(sec.id);
    if (existing) {
      existing.blockCount++;
    } else {
      sectionMap.set(sec.id, {
        sectionId: sec.id,
        sectionName: sec.name || `小节 ${sec.sortOrder}`,
        projectTitle: sec.project.title,
        blockCount: 1,
      });
    }
  }

  return {
    sections: [...sectionMap.values()],
    totalBlocks: blocks.length,
  };
}

/** Delete preset and cascade-remove all related PromptBlocks + LoRAs in sections */
export async function deletePresetCascade(presetId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Find all blocks referencing this preset
    const blocks = await tx.promptBlock.findMany({
      where: { sourceId: presetId },
      select: { id: true, bindingId: true, projectSectionId: true },
    });

    // 2. Collect unique bindingIds and sectionIds
    const bindingIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const block of blocks) {
      if (block.bindingId) bindingIds.add(block.bindingId);
      sectionIds.add(block.projectSectionId);
    }

    // 3. Delete all blocks with matching bindingIds (includes blocks from same import)
    if (bindingIds.size > 0) {
      await tx.promptBlock.deleteMany({
        where: { bindingId: { in: [...bindingIds] } },
      });
    }
    // Also delete blocks without bindingId that reference this preset
    await tx.promptBlock.deleteMany({
      where: { sourceId: presetId, bindingId: null },
    });

    // 4. Remove LoRAs with matching bindingIds from section loraConfig JSON
    for (const sectionId of sectionIds) {
      const section = await tx.projectSection.findUnique({
        where: { id: sectionId },
        select: { loraConfig: true },
      });
      if (!section?.loraConfig) continue;

      const config = section.loraConfig as { lora1?: Array<Record<string, unknown>>; lora2?: Array<Record<string, unknown>> };
      let changed = false;

      if (config.lora1) {
        const before = config.lora1.length;
        config.lora1 = config.lora1.filter((e) => !e.bindingId || !bindingIds.has(e.bindingId as string));
        if (config.lora1.length !== before) changed = true;
      }
      if (config.lora2) {
        const before = config.lora2.length;
        config.lora2 = config.lora2.filter((e) => !e.bindingId || !bindingIds.has(e.bindingId as string));
        if (config.lora2.length !== before) changed = true;
      }

      if (changed) {
        await tx.projectSection.update({
          where: { id: sectionId },
          data: { loraConfig: config as Prisma.InputJsonValue },
        });
      }
    }

    // 5. Soft delete the preset
    await tx.preset.update({ where: { id: presetId }, data: { isActive: false } });
  });

  revalidatePath("/assets/presets");
  revalidatePath("/projects");
}

/** Sync preset variant content to all sections that imported it */
export async function syncPresetToSections(presetId: string) {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { id: true, name: true, color: true, lora1Order: true, lora2Order: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset || preset.variants.length === 0) return;

  const defaultVariant = preset.variants[0];
  type ActiveVariant = typeof defaultVariant;
  type ResolvedVariantContent = Awaited<ReturnType<typeof resolveVariantContent>>;
  const resolvedByVariantId = new Map<string, ResolvedVariantContent>();
  const getResolvedVariantContent = async (variantId: string) => {
    const cached = resolvedByVariantId.get(variantId);
    if (cached) return cached;
    const resolved = await resolveVariantContent(variantId);
    resolvedByVariantId.set(variantId, resolved);
    return resolved;
  };
  const resolvePresetVariant = (variantId: string | null | undefined, label: string | null | undefined): ActiveVariant => {
    if (variantId) {
      const found = preset.variants.find((v) => v.id === variantId);
      if (found) return found;
    }

    if (label) {
      for (const v of preset.variants) {
        const expectedLabel = preset.variants.length === 1
          ? preset.name : `${preset.name} / ${v.name}`;
        if (label === expectedLabel) return v;
      }
    }

    return defaultVariant;
  };
  const makePresetLabel = (variant: ActiveVariant) => preset.variants.length === 1
    ? preset.name : `${preset.name} / ${variant.name}`;

  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: {
      id: true,
      variantId: true,
      bindingId: true,
      groupBindingId: true,
      projectSectionId: true,
      projectSection: { select: { projectId: true } },
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
  const templateSections = await prisma.projectTemplateSection.findMany({
    select: {
      id: true,
      projectTemplateId: true,
      promptBlocks: true,
      loraConfig: true,
    },
  });

  const categories = await prisma.presetCategory.findMany({
    select: { name: true, lora1Order: true, lora2Order: true },
  });
  const categoryOrderByName = new Map(
    categories.map((category) => [
      category.name,
      { lora1Order: category.lora1Order, lora2Order: category.lora2Order },
    ]),
  );
  const syncPresetLoraConfig = (
    config: SectionLoraConfig,
    bindingId: string,
    groupBindingId: string | null | undefined,
    resolved: ResolvedVariantContent,
  ) => {
    const makeLora = (b: { path: string; weight: number; enabled: boolean }): LoraEntry => ({
      id: createLoraEntryId(),
      path: b.path, weight: b.weight, enabled: b.enabled,
      source: "preset", sourceLabel: preset.category.name,
      sourceColor: preset.category.color ?? undefined, sourceName: preset.name,
      bindingId,
      groupBindingId: groupBindingId ?? undefined,
    });
    const detachedLora1Paths = getDetachedPresetPaths(config.lora1, bindingId);
    const detachedLora2Paths = getDetachedPresetPaths(config.lora2, bindingId);
    const nextPresetLora1 = resolved.lora1
      .filter((entry) => !detachedLora1Paths.has(entry.path))
      .map(makeLora);
    const nextPresetLora2 = resolved.lora2
      .filter((entry) => !detachedLora2Paths.has(entry.path))
      .map(makeLora);
    config.lora1 = sortSectionLoraEntriesByCategoryOrder(
      [...config.lora1.filter((e) => e.bindingId !== bindingId), ...nextPresetLora1],
      "lora1Order",
      categoryOrderByName,
    );
    config.lora2 = sortSectionLoraEntriesByCategoryOrder(
      [...config.lora2.filter((e) => e.bindingId !== bindingId), ...nextPresetLora2],
      "lora2Order",
      categoryOrderByName,
    );
  };

  const affectedSections = new Map<string, string>();
  for (const block of blocks) {
    affectedSections.set(block.projectSectionId, block.projectSection.projectId);
  }

  // Resolve variant content outside the transaction to avoid holding it open during I/O
  const resolvedBlocks = await Promise.all(
    blocks.map(async (block) => {
      const variant = resolvePresetVariant(block.variantId, block.label);
      const resolved = await getResolvedVariantContent(variant.id);
      const label = makePresetLabel(variant);
      return { block, variant, resolved, label };
    }),
  );

  await prisma.$transaction(async (tx) => {
    for (const { block, resolved, label } of resolvedBlocks) {
      const updatedBlock = await tx.promptBlock.update({
        where: { id: block.id },
        data: { label, positive: resolved.prompt, negative: resolved.negativePrompt },
        select: { id: true, label: true, positive: true, negative: true, sortOrder: true, bindingId: true, groupBindingId: true },
      });
      await recordSectionChange({
        sectionId: block.projectSectionId,
        dimension: "prompt",
        title: `同步预制提示词：${label}`,
        before: {
          id: block.id,
          label: block.label,
          positive: block.positive,
          negative: block.negative,
          sortOrder: block.sortOrder,
          bindingId: block.bindingId,
          groupBindingId: block.groupBindingId,
        },
        after: updatedBlock,
      });

      if (block.bindingId) {
        const bindingId = block.bindingId;
        const section = await tx.projectSection.findUnique({
          where: { id: block.projectSectionId },
          select: { loraConfig: true },
        });
        if (!section) continue;

        const beforeLoraConfig = section.loraConfig ?? null;
        const config = parseSectionLoraConfig(section.loraConfig);
        const currentConfig = serializeSectionLoraConfig(config);
        syncPresetLoraConfig(config, bindingId, block.groupBindingId, resolved);
        const nextConfig = serializeSectionLoraConfig(config);
        const changed = JSON.stringify(currentConfig) !== JSON.stringify(nextConfig);
        if (changed) {
          await tx.projectSection.update({
            where: { id: block.projectSectionId },
            data: { loraConfig: nextConfig as Prisma.InputJsonValue },
          });
          await recordSectionChange({
            sectionId: block.projectSectionId,
            dimension: "lora",
            title: `同步预制 LoRA：${label}`,
            before: beforeLoraConfig,
            after: nextConfig,
          });
        }
      }
    }
  });
  const affectedTemplateIds = new Set<string>();
  for (const templateSection of templateSections) {
    const rawBlocks = Array.isArray(templateSection.promptBlocks) ? templateSection.promptBlocks : [];
    let hasPresetBlock = false;
    const nextBlocks: TemplatePromptBlockJson[] = [];
    const config = parseSectionLoraConfig(templateSection.loraConfig);
    const currentConfig = serializeSectionLoraConfig(config);

    for (const rawBlock of rawBlocks) {
      if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
        continue;
      }

      const block = rawBlock as TemplatePromptBlockJson;
      if (block.type !== "preset" || block.sourceId !== presetId) {
        nextBlocks.push(block);
        continue;
      }

      hasPresetBlock = true;
      const variant = resolvePresetVariant(block.variantId, block.label);
      const resolved = await getResolvedVariantContent(variant.id);
      const nextBlock: TemplatePromptBlockJson = {
        ...block,
        label: makePresetLabel(variant),
        positive: resolved.prompt,
        negative: resolved.negativePrompt,
        variantId: variant.id,
        categoryId: preset.category.id,
      };
      nextBlocks.push(nextBlock);

      if (typeof block.bindingId === "string" && block.bindingId) {
        syncPresetLoraConfig(config, block.bindingId, block.groupBindingId, resolved);
      }
    }

    if (!hasPresetBlock) continue;

    const nextConfig = serializeSectionLoraConfig(config);
    const promptBlocksChanged = JSON.stringify(rawBlocks) !== JSON.stringify(nextBlocks);
    const loraConfigChanged = JSON.stringify(currentConfig) !== JSON.stringify(nextConfig);
    if (!promptBlocksChanged && !loraConfigChanged) continue;

    await prisma.projectTemplateSection.update({
      where: { id: templateSection.id },
      data: {
        promptBlocks: nextBlocks as Prisma.InputJsonValue,
        loraConfig: nextConfig as Prisma.InputJsonValue,
      },
    });
    affectedTemplateIds.add(templateSection.projectTemplateId);
  }
  for (const [sectionId, projectId] of affectedSections) {
    const sectionBlocks = await prisma.promptBlock.findMany({
      where: { projectSectionId: sectionId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { positive: true, negative: true },
    });
    const positiveParts = sectionBlocks
      .map((block) => block.positive)
      .filter((value): value is string => Boolean(value && value.trim()));
    const negativeParts = sectionBlocks
      .map((block) => block.negative)
      .filter((value): value is string => Boolean(value && value.trim()));

    await prisma.projectSection.update({
      where: { id: sectionId },
      data: {
        positivePrompt: positiveParts.join(" BREAK "),
        negativePrompt: negativeParts.length > 0 ? negativeParts.join(" BREAK ") : null,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/sections/${sectionId}`);
  }
  for (const templateId of affectedTemplateIds) {
    revalidatePath(`/assets/templates/${templateId}/edit`);
  }
  if (affectedTemplateIds.size > 0) {
    revalidatePath("/assets/templates");
  }
  revalidatePath("/projects");
}
