"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  buildProjectSectionDataForTemplateImport,
  buildProjectSectionRowsForTemplateImport,
  type SectionManualLoraEntryWrite,
  type SectionPresetBindingWrite,
  type SectionPromptBlockWrite,
} from "@/server/prompt-config/template-resolver";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}

async function createImportedSectionRows(
  tx: Prisma.TransactionClient,
  rows: {
    presetBindings: SectionPresetBindingWrite[];
    promptBlocks: SectionPromptBlockWrite[];
    manualLoraEntries: SectionManualLoraEntryWrite[];
  },
) {
  for (const row of rows.presetBindings) {
    await tx.sectionPresetBinding.create({ data: row });
  }
  for (const row of rows.promptBlocks) {
    await tx.sectionPromptBlock.create({ data: row });
  }
  for (const row of rows.manualLoraEntries) {
    await tx.sectionManualLoraEntry.create({
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
    include: {
      presetBindingRows: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          projectTemplateId: true,
          categoryId: true,
          presetId: true,
          variantId: true,
          sortOrder: true,
        },
      },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          presetBindingRows: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              projectTemplateSectionId: true,
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
            },
          },
          promptBlockRows: {
            orderBy: { sortOrder: "asc" },
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
          },
          manualLoraEntries: {
            orderBy: { sortOrder: "asc" },
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
          },
        },
      },
    },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      checkpointName: true,
      presetBindingRows: {
        orderBy: { sortOrder: "asc" },
        select: {
          categoryId: true,
          presetId: true,
          variantId: true,
          sortOrder: true,
        },
      },
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

  const projectBindings = project.presetBindingRows;

  await prisma.$transaction(async (tx) => {
    if (onExistingSections === "replace") {
      await tx.projectSection.deleteMany({ where: { projectId } });
    }

    const sortOrderBase = onExistingSections === "replace" ? 0 : currentSectionCount;

    for (let i = 0; i < sectionsToImport.length; i++) {
      const ts = sectionsToImport[i];

      const section = await tx.projectSection.create({
        data: buildProjectSectionDataForTemplateImport({
          projectId,
          sortOrder: sortOrderBase + i + 1,
          templateSection: ts,
        }),
      });

      const relationRows = buildProjectSectionRowsForTemplateImport({
        projectSectionId: section.id,
        templateProjectPresetBindings: template.presetBindingRows,
        projectLevelBindings: projectBindings,
        templatePresetBindings: ts.presetBindingRows,
        templatePromptBlocks: ts.promptBlockRows,
        templateManualLoraEntries: ts.manualLoraEntries,
      });
      await createImportedSectionRows(tx, relationRows);
    }
  });

  safeRevalidatePath(`/projects/${projectId}`);
  if (!options) {
    return sectionsToImport.length;
  }
  return plannedResult;
}
