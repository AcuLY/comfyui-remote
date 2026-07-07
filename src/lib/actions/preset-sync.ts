"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  buildGenerationProjectTemplateWhere,
  buildGenerationProjectWhere,
} from "@/server/repositories/generation-resource-boundary";
import { assertOrdinaryPreset } from "../preset-resource-scope";

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

/** Check which sections reference a given preset via normalized binding rows. */
export async function getPresetUsage(presetId: string): Promise<PresetUsageInfo> {
  await assertOrdinaryPreset(presetId);
  const [
    sectionBindings,
    templateSectionBindings,
    projectBindings,
    projectTemplateBindings,
  ] = await Promise.all([
    prisma.sectionPresetBinding.findMany({
      where: {
        presetId,
        projectSection: {
          project: buildGenerationProjectWhere(),
        },
      },
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
      where: {
        presetId,
        projectTemplateSection: {
          projectTemplate: buildGenerationProjectTemplateWhere(),
        },
      },
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
      where: {
        presetId,
        project: buildGenerationProjectWhere(),
      },
      select: {
        id: true,
        project: { select: { id: true, title: true } },
      },
    }),
    prisma.projectTemplatePresetBinding.findMany({
      where: {
        presetId,
        projectTemplate: buildGenerationProjectTemplateWhere(),
      },
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
      sectionBindings.length +
      templateSectionBindings.length +
      projectBindings.length +
      projectTemplateBindings.length,
  };
}

/** Delete preset and cascade-remove all related normalized section rows. */
export async function deletePresetCascade(presetId: string) {
  await assertOrdinaryPreset(presetId);
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
        where: {
          presetId,
          projectSection: {
            project: buildGenerationProjectWhere(),
          },
        },
        select: { id: true, projectSectionId: true },
      }),
      tx.templateSectionPresetBinding.findMany({
        where: {
          presetId,
          projectTemplateSection: {
            projectTemplate: buildGenerationProjectTemplateWhere(),
          },
        },
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

    await tx.projectPresetBinding.deleteMany({
      where: {
        presetId,
        project: buildGenerationProjectWhere(),
      },
    });
    await tx.projectTemplatePresetBinding.deleteMany({
      where: {
        presetId,
        projectTemplate: buildGenerationProjectTemplateWhere(),
      },
    });

    await tx.preset.update({ where: { id: presetId }, data: { isActive: false } });
  });

  revalidatePath("/assets/presets");
  revalidatePath("/projects");
}

/**
 * Preset content now resolves lazily through binding rows. The old sync endpoint
 * is retained for callers but no longer rewrites prompt block or section caches.
 */
export async function syncPresetToSections(presetId: string) {
  await assertOrdinaryPreset(presetId);
  revalidatePath("/projects");
  revalidatePath("/assets/templates");
  return { ok: true, presetId, skipped: true as const };
}
