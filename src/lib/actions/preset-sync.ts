"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

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

// ---------------------------------------------------------------------------
// Preset usage check + cascade operations
// ---------------------------------------------------------------------------

function addUsageSection(
  sectionMap: Map<string, { sectionId: string; sectionName: string; projectTitle: string; blockCount: number }>,
  section: {
    id: string;
    name: string | null;
    sortOrder: number;
    project: { title: string };
  },
) {
  const existing = sectionMap.get(section.id);
  if (existing) {
    existing.blockCount += 1;
    return;
  }

  sectionMap.set(section.id, {
    sectionId: section.id,
    sectionName: section.name || `小节 ${section.sortOrder}`,
    projectTitle: section.project.title,
    blockCount: 1,
  });
}

function addUsageEntry(
  sectionMap: Map<string, { sectionId: string; sectionName: string; projectTitle: string; blockCount: number }>,
  entry: { sectionId: string; sectionName: string; projectTitle: string },
) {
  const existing = sectionMap.get(entry.sectionId);
  if (existing) {
    existing.blockCount += 1;
    return;
  }

  sectionMap.set(entry.sectionId, { ...entry, blockCount: 1 });
}

/** Check which sections reference a given preset via binding rows or legacy PromptBlock.sourceId */
export async function getPresetUsage(presetId: string): Promise<PresetUsageInfo> {
  const [
    blocks,
    sectionBindings,
    templateSectionBindings,
    projectBindings,
    projectTemplateBindings,
  ] = await Promise.all([
    prisma.promptBlock.findMany({
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
    }),
    prisma.sectionPresetBinding.findMany({
      where: { presetId },
      select: {
        id: true,
        projectSection: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
            project: { select: { title: true } },
          },
        },
      },
    }),
    prisma.templateSectionPresetBinding.findMany({
      where: { presetId },
      select: {
        id: true,
        projectTemplateSection: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
            projectTemplate: { select: { name: true } },
          },
        },
      },
    }),
    prisma.projectPresetBinding.findMany({
      where: { presetId },
      select: {
        id: true,
        project: { select: { id: true, title: true } },
      },
    }),
    prisma.projectTemplatePresetBinding.findMany({
      where: { presetId },
      select: {
        id: true,
        projectTemplate: { select: { id: true, name: true } },
      },
    }),
  ]);

  const sectionMap = new Map<
    string,
    { sectionId: string; sectionName: string; projectTitle: string; blockCount: number }
  >();
  for (const block of blocks) {
    addUsageSection(sectionMap, block.projectSection);
  }
  for (const binding of sectionBindings) {
    addUsageSection(sectionMap, binding.projectSection);
  }
  for (const binding of templateSectionBindings) {
    const section = binding.projectTemplateSection;
    addUsageEntry(sectionMap, {
      sectionId: `template-section:${section.id}`,
      sectionName: section.name || `模板小节 ${section.sortOrder}`,
      projectTitle: `模板：${section.projectTemplate.name}`,
    });
  }
  for (const binding of projectBindings) {
    addUsageEntry(sectionMap, {
      sectionId: `project:${binding.project.id}`,
      sectionName: "项目级预制",
      projectTitle: binding.project.title,
    });
  }
  for (const binding of projectTemplateBindings) {
    addUsageEntry(sectionMap, {
      sectionId: `project-template:${binding.projectTemplate.id}`,
      sectionName: "模板级预制",
      projectTitle: `模板：${binding.projectTemplate.name}`,
    });
  }

  return {
    sections: [...sectionMap.values()],
    totalBlocks:
      blocks.length +
      sectionBindings.length +
      templateSectionBindings.length +
      projectBindings.length +
      projectTemplateBindings.length,
  };
}

/** Delete preset and cascade-remove all related PromptBlocks + LoRAs in sections */
export async function deletePresetCascade(presetId: string) {
  await prisma.$transaction(async (tx) => {
    const presetVariantIds = (await tx.presetVariant.findMany({
      where: { presetId },
      select: { id: true },
    })).map((variant) => variant.id);

    if (presetVariantIds.length > 0) {
      await tx.presetVariantLink.deleteMany({
        where: {
          OR: [
            { sourceVariantId: { in: presetVariantIds } },
            { linkedVariantId: { in: presetVariantIds } },
          ],
        },
      });
    }

    const [sectionBindings, templateSectionBindings] = await Promise.all([
      tx.sectionPresetBinding.findMany({
        where: { presetId },
        select: { id: true, projectSectionId: true },
      }),
      tx.templateSectionPresetBinding.findMany({
        where: { presetId },
        select: { id: true, projectTemplateSectionId: true },
      }),
    ]);

    const sectionBindingIds = sectionBindings.map((binding) => binding.id);
    const templateSectionBindingIds = templateSectionBindings.map((binding) => binding.id);

    if (sectionBindingIds.length > 0) {
      await tx.sectionManualLoraEntry.deleteMany({
        where: { sectionBindingId: { in: sectionBindingIds } },
      });
      await tx.sectionPromptBlock.deleteMany({
        where: { sectionBindingId: { in: sectionBindingIds } },
      });
      await tx.sectionPresetBinding.deleteMany({
        where: { id: { in: sectionBindingIds } },
      });
    }

    if (templateSectionBindingIds.length > 0) {
      await tx.templateSectionManualLoraEntry.deleteMany({
        where: { templateSectionBindingId: { in: templateSectionBindingIds } },
      });
      await tx.templateSectionPromptBlock.deleteMany({
        where: { templateSectionBindingId: { in: templateSectionBindingIds } },
      });
      await tx.templateSectionPresetBinding.deleteMany({
        where: { id: { in: templateSectionBindingIds } },
      });
    }

    await tx.projectPresetBinding.deleteMany({ where: { presetId } });
    await tx.projectTemplatePresetBinding.deleteMany({ where: { presetId } });

    const blocks = await tx.promptBlock.findMany({
      where: { sourceId: presetId },
      select: { id: true, bindingId: true, projectSectionId: true },
    });

    const blockIds = blocks.map((block) => block.id);
    const bindingIdsBySection = new Map<string, Set<string>>();
    const sectionIds = new Set<string>();
    for (const block of blocks) {
      if (block.bindingId) {
        const sectionBindingIds = bindingIdsBySection.get(block.projectSectionId) ?? new Set<string>();
        sectionBindingIds.add(block.bindingId);
        bindingIdsBySection.set(block.projectSectionId, sectionBindingIds);
      }
      sectionIds.add(block.projectSectionId);
    }

    if (blockIds.length > 0) {
      await tx.promptBlock.deleteMany({
        where: { id: { in: blockIds } },
      });
    }

    for (const sectionId of sectionIds) {
      const sectionBindingIds = bindingIdsBySection.get(sectionId) ?? new Set<string>();
      const survivingBindingIds = new Set<string>();
      if (sectionBindingIds.size > 0) {
        const survivingBlocks = await tx.promptBlock.findMany({
          where: {
            projectSectionId: sectionId,
            bindingId: { in: [...sectionBindingIds] },
          },
          select: { bindingId: true },
        });
        for (const block of survivingBlocks) {
          if (block.bindingId) survivingBindingIds.add(block.bindingId);
        }
      }

      const section = await tx.projectSection.findUnique({
        where: { id: sectionId },
        select: { loraConfig: true },
      });
      if (!section?.loraConfig) continue;

      const config = section.loraConfig as {
        lora1?: Array<Record<string, unknown>>;
        lora2?: Array<Record<string, unknown>>;
      };
      let changed = false;

      if (config.lora1) {
        const before = config.lora1.length;
        config.lora1 = config.lora1.filter((entry) =>
          typeof entry.bindingId !== "string" ||
          !sectionBindingIds.has(entry.bindingId) ||
          survivingBindingIds.has(entry.bindingId)
        );
        if (config.lora1.length !== before) changed = true;
      }
      if (config.lora2) {
        const before = config.lora2.length;
        config.lora2 = config.lora2.filter((entry) =>
          typeof entry.bindingId !== "string" ||
          !sectionBindingIds.has(entry.bindingId) ||
          survivingBindingIds.has(entry.bindingId)
        );
        if (config.lora2.length !== before) changed = true;
      }

      if (changed) {
        await tx.projectSection.update({
          where: { id: sectionId },
          data: { loraConfig: config as Prisma.InputJsonValue },
        });
      }
    }

    await tx.preset.update({ where: { id: presetId }, data: { isActive: false } });
  });

  revalidatePath("/assets/presets");
  revalidatePath("/projects");
}

/**
 * Preset content now resolves lazily through binding rows. The old sync endpoint
 * is retained for callers but no longer rewrites PromptBlock, ProjectSection, or
 * ProjectTemplateSection caches.
 */
export async function syncPresetToSections(presetId: string) {
  revalidatePath("/projects");
  revalidatePath("/assets/templates");
  return { ok: true, presetId, skipped: true as const };
}
