"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import {
  buildTemplateSectionRowsForProjectSectionSave,
  type TemplateSectionManualLoraEntryWrite,
  type TemplateSectionPresetBindingWrite,
  type TemplateSectionPromptBlockWrite,
} from "@/server/prompt-config/template-resolver";
import { buildTemplateSectionFolderClonePlan } from "./section-folder-utils";

type ProjectLevelTemplateBinding = {
  categoryId: string;
  presetId: string;
  variantId?: string | null;
  sortOrder?: number | null;
};

function uniqueProjectLevelBindings(bindings: readonly ProjectLevelTemplateBinding[]) {
  const seen = new Set<string>();
  const unique: ProjectLevelTemplateBinding[] = [];

  for (const binding of bindings) {
    if (seen.has(binding.categoryId)) continue;
    seen.add(binding.categoryId);
    unique.push(binding);
  }

  return unique;
}

function projectTemplatePresetBindingData(
  projectTemplateId: string,
  binding: ProjectLevelTemplateBinding,
  index: number,
) {
  return {
    id: `projectTemplatePresetBinding:${projectTemplateId}:${binding.categoryId}`,
    projectTemplateId,
    categoryId: binding.categoryId,
    presetId: binding.presetId,
    variantId: binding.variantId ?? null,
    sortOrder: binding.sortOrder ?? index,
  };
}

async function createTemplateSectionRows(
  tx: typeof prisma,
  rows: {
    presetBindings: TemplateSectionPresetBindingWrite[];
    promptBlocks: TemplateSectionPromptBlockWrite[];
    manualLoraEntries: TemplateSectionManualLoraEntryWrite[];
  },
) {
  for (const row of rows.presetBindings) {
    await tx.templateSectionPresetBinding.create({ data: row });
  }
  for (const row of rows.promptBlocks) {
    await tx.templateSectionPromptBlock.create({ data: row });
  }
  for (const row of rows.manualLoraEntries) {
    await tx.templateSectionManualLoraEntry.create({
      data: {
        ...row,
        metadata: row.metadata == null
          ? undefined
          : JSON.parse(JSON.stringify(row.metadata)) as Prisma.InputJsonValue,
      },
    });
  }
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
      presetBindingRows: {
        select: {
          categoryId: true,
          presetId: true,
          variantId: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
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
          presetBindingRows: {
            select: {
              id: true,
              projectSectionId: true,
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
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const projectBindings = uniqueProjectLevelBindings(
    project.presetBindingRows,
  );

  const folderClonePlan = buildTemplateSectionFolderClonePlan({
    projectFolders: project.sectionFolders,
    projectSections: project.sections.map((section) => ({
      id: section.id,
      folderId: section.folderId,
    })),
  });

  const buildSectionCreateData = (section: (typeof project.sections)[number]) => ({
    folderId: folderClonePlan.sectionFolderIdBySectionId.get(section.id) ?? null,
    sortOrder: section.sortOrder,
    name: section.name,
      notes: null,
      aspectRatio: section.aspectRatio,
      aspectRatios: section.aspectRatios ?? undefined,
      shortSidePx: section.shortSidePx,
    batchSize: section.batchSize,
    seedPolicy1: section.seedPolicy1,
    seedPolicy2: section.seedPolicy2,
    ksampler1: section.ksampler1 ?? undefined,
    ksampler2: section.ksampler2 ?? undefined,
    upscaleFactor: section.upscaleFactor ?? undefined,
    checkpointName: section.checkpointName ?? project.checkpointName ?? DEFAULT_CHECKPOINT_NAME,
    extraParams: section.extraParams ?? undefined,
  });

  const template = await prisma.$transaction(async (tx) => {
    const createdTemplate = await tx.projectTemplate.create({
      data: {
        name: templateName,
        description: templateDescription ?? null,
      },
    });

    for (const [index, binding] of projectBindings.entries()) {
      await tx.projectTemplatePresetBinding.create({
        data: projectTemplatePresetBindingData(createdTemplate.id, binding, index),
      });
    }

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
      const createdSection = await tx.projectTemplateSection.create({
        data: {
          projectTemplateId: createdTemplate.id,
          ...buildSectionCreateData(section),
        },
      });

      const relationRows = buildTemplateSectionRowsForProjectSectionSave({
        projectTemplateSectionId: createdSection.id,
        projectSection: section,
        presetBindings: section.presetBindingRows,
        promptBlockRows: section.sectionPromptBlocks,
        manualLoraEntries: section.manualLoraEntries,
        projectLevelBindings: projectBindings,
      });
      await createTemplateSectionRows(tx as typeof prisma, relationRows);
    }

    return createdTemplate;
  });

  revalidatePath("/assets/templates");
  return template.id;
}
