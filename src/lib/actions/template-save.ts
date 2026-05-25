"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import { toJsonValue } from "./_helpers";
import type { PresetBinding } from "./project";
import { buildTemplateSectionFolderClonePlan } from "./section-folder-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateSectionJsonBlock = {
  type?: string | null;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      sectionFolders: {
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          parentId: true,
          sortOrder: true,
        },
      },
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

  const folderClonePlan = buildTemplateSectionFolderClonePlan({
    projectFolders: project.sectionFolders,
    projectSections: project.sections.map((section) => ({
      id: section.id,
      folderId: section.folderId,
    })),
  });

  const buildSectionCreateData = (section: (typeof project.sections)[number]) => {
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
      folderId: folderClonePlan.sectionFolderIdBySectionId.get(section.id) ?? null,
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
        ? toJsonValue(templateLoraConfig)
        : undefined,
      extraParams: section.extraParams ?? undefined,
      promptBlocks: templateBlocks.length > 0 ? toJsonValue(templateBlocks) : undefined,
    };
  };

  const template = await prisma.$transaction(async (tx) => {
    const createdTemplate = await tx.projectTemplate.create({
      data: {
        name: templateName,
        description: templateDescription ?? null,
      },
    });

    for (const folder of folderClonePlan.foldersToCreate) {
      await tx.projectTemplateSectionFolder.create({
        data: {
          id: folder.id,
          projectTemplateId: createdTemplate.id,
          parentId: folder.parentId,
          name: folder.name,
          sortOrder: folder.sortOrder,
        },
      });
    }

    for (const section of project.sections) {
      await tx.projectTemplateSection.create({
        data: {
          projectTemplateId: createdTemplate.id,
          ...buildSectionCreateData(section),
        },
      });
    }

    return createdTemplate;
  });

  revalidatePath("/assets/templates");
  return template.id;
}
