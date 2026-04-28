"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import { sortSectionLoraEntriesByCategoryOrder } from "./_helpers";
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

type SectionLoraJsonEntry = Record<string, unknown>;

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
  // 1. Find all blocks referencing this preset
  const blocks = await prisma.promptBlock.findMany({
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
    await prisma.promptBlock.deleteMany({
      where: { bindingId: { in: [...bindingIds] } },
    });
  }
  // Also delete blocks without bindingId that reference this preset
  await prisma.promptBlock.deleteMany({
    where: { sourceId: presetId, bindingId: null },
  });

  // 4. Remove LoRAs with matching bindingIds from section loraConfig JSON
  for (const sectionId of sectionIds) {
    const section = await prisma.projectSection.findUnique({
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
      await prisma.projectSection.update({
        where: { id: sectionId },
        data: { loraConfig: config as Prisma.InputJsonValue },
      });
    }
  }

  // 5. Soft delete the preset
  await prisma.preset.update({ where: { id: presetId }, data: { isActive: false } });

  revalidatePath("/assets/presets");
  revalidatePath("/projects");
}

/** Sync preset variant content to all sections that imported it */
export async function syncPresetToSections(presetId: string) {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { name: true, color: true, lora1Order: true, lora2Order: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset || preset.variants.length === 0) return;

  const defaultVariant = preset.variants[0];
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: {
      id: true,
      variantId: true,
      bindingId: true,
      groupBindingId: true,
      projectSectionId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
  if (blocks.length === 0) return;

  const categories = await prisma.presetCategory.findMany({
    select: { name: true, lora1Order: true, lora2Order: true },
  });
  const categoryOrderByName = new Map(
    categories.map((category) => [
      category.name,
      { lora1Order: category.lora1Order, lora2Order: category.lora2Order },
    ]),
  );

  for (const block of blocks) {
    // Determine which variant this block uses
    let variant = defaultVariant;
    if (block.variantId) {
      // Prefer stored variantId
      const found = preset.variants.find((v) => v.id === block.variantId);
      if (found) variant = found;
    } else {
      // Fallback: match by label
      for (const v of preset.variants) {
        const expectedLabel = preset.variants.length === 1
          ? preset.name : `${preset.name} / ${v.name}`;
        if (block.label === expectedLabel) { variant = v; break; }
      }
    }

    const resolved = await resolveVariantContent(variant.id);
    const label = preset.variants.length === 1
      ? preset.name : `${preset.name} / ${variant.name}`;

    const updatedBlock = await prisma.promptBlock.update({
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
      const section = await prisma.projectSection.findUnique({
        where: { id: block.projectSectionId },
        select: { loraConfig: true },
      });
      if (!section?.loraConfig) continue;

      const config = section.loraConfig as {
        lora1?: SectionLoraJsonEntry[];
        lora2?: SectionLoraJsonEntry[];
      };
      let changed = false;
      const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
        id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        path: b.path, weight: b.weight, enabled: b.enabled,
        source: "preset", sourceLabel: preset.category.name,
        sourceColor: preset.category.color, sourceName: preset.name,
        bindingId: block.bindingId,
      });
      if (Array.isArray(config.lora1)) {
        config.lora1 = sortSectionLoraEntriesByCategoryOrder(
          [...config.lora1.filter((e) => e.bindingId !== block.bindingId), ...resolved.lora1.map(makeLora)],
          "lora1Order",
          categoryOrderByName,
        );
        changed = true;
      }
      if (Array.isArray(config.lora2)) {
        config.lora2 = sortSectionLoraEntriesByCategoryOrder(
          [...config.lora2.filter((e) => e.bindingId !== block.bindingId), ...resolved.lora2.map(makeLora)],
          "lora2Order",
          categoryOrderByName,
        );
        changed = true;
      }
      if (changed) {
        await prisma.projectSection.update({
          where: { id: block.projectSectionId },
          data: { loraConfig: config as Prisma.InputJsonValue },
        });
        await recordSectionChange({
          sectionId: block.projectSectionId,
          dimension: "lora",
          title: `同步预制 LoRA：${label}`,
          before: section.loraConfig,
          after: config,
        });
      }
    }
  }
  revalidatePath("/projects");
}
