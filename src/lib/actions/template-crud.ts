"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import {
  buildTemplateSectionRowsFromLegacyTemplateData,
  type TemplateSectionManualLoraEntryWrite,
  type TemplateSectionPresetBindingWrite,
  type TemplateSectionPromptBlockWrite,
} from "@/server/prompt-config/template-resolver";
import { resolveVariantContent } from "./preset-variant";

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

export type DeleteProjectTemplateSectionInput = {
  templateId: string;
  sectionId: string;
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
// Helpers
// ---------------------------------------------------------------------------

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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

function buildTemplateSectionUpdateData(section: ProjectTemplateSectionData) {
  return {
    folderId: section.folderId,
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
    loraConfig: Prisma.DbNull,
    extraParams: toNullableJsonValue(section.extraParams),
    promptBlocks: Prisma.DbNull,
  };
}

async function createTemplateSectionRelationRows(
  tx: Prisma.TransactionClient,
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

async function replaceTemplateSectionRelationRows(
  tx: Prisma.TransactionClient,
  projectTemplateSectionId: string,
  section: ProjectTemplateSectionData,
) {
  await tx.templateSectionPromptBlock.deleteMany({ where: { projectTemplateSectionId } });
  await tx.templateSectionManualLoraEntry.deleteMany({ where: { projectTemplateSectionId } });
  await tx.templateSectionPresetBinding.deleteMany({ where: { projectTemplateSectionId } });

  const rows = buildTemplateSectionRowsFromLegacyTemplateData({
    projectTemplateSectionId,
    promptBlocks: section.promptBlocks,
    loraConfig: section.loraConfig,
  });
  await createTemplateSectionRelationRows(tx, rows);
}

// ---------------------------------------------------------------------------
// Project Template CRUD
// ---------------------------------------------------------------------------

export async function createProjectTemplate(
  input: CreateProjectTemplateInput,
): Promise<string> {
  const template = await prisma.$transaction(async (tx) => {
    const createdTemplate = await tx.projectTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
      },
    });

    for (const [index, section] of input.sections.entries()) {
      const createdSection = await tx.projectTemplateSection.create({
        data: {
          projectTemplateId: createdTemplate.id,
          ...buildTemplateSectionUpdateData({
            ...section,
            sortOrder: section.sortOrder ?? index,
          }),
          sortOrder: section.sortOrder ?? index,
        },
      });
      await replaceTemplateSectionRelationRows(tx, createdSection.id, section);
    }

    return createdTemplate;
  });
  safeRevalidatePath("/assets/templates");
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
      const incomingSectionIds = sections
        .map((section) => section.id)
        .filter((sectionId) => sectionId && !sectionId.startsWith("new-"));

      await tx.projectTemplateSection.deleteMany({
        where: {
          projectTemplateId: id,
          ...(incomingSectionIds.length > 0
            ? { id: { notIn: incomingSectionIds } }
            : {}),
        },
      });

      for (const [index, section] of sections.entries()) {
        const data = {
          ...buildTemplateSectionUpdateData({
            ...section,
            sortOrder: section.sortOrder ?? index,
          }),
          sortOrder: section.sortOrder ?? index,
        };

        if (section.id && !section.id.startsWith("new-")) {
          const updated = await tx.projectTemplateSection.updateMany({
            where: {
              id: section.id,
              projectTemplateId: id,
            },
            data,
          });
          if (updated.count > 0) {
            await replaceTemplateSectionRelationRows(tx, section.id, section);
            continue;
          }
        }

        const createdSection = await tx.projectTemplateSection.create({
          data: {
            projectTemplateId: id,
            ...data,
          },
        });
        await replaceTemplateSectionRelationRows(tx, createdSection.id, section);
      }
    }
  });

  safeRevalidatePath("/assets/templates");
  safeRevalidatePath(`/assets/templates/${id}/edit`);
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

  await prisma.$transaction(async (tx) => {
    await tx.projectTemplateSection.update({
      where: { id: input.sectionId },
      data: buildTemplateSectionUpdateData(input.section),
    });
    await replaceTemplateSectionRelationRows(tx, input.sectionId, input.section);
  });

  safeRevalidatePath("/assets/templates");
  safeRevalidatePath(`/assets/templates/${input.templateId}/edit`);
  safeRevalidatePath(`/assets/templates/${input.templateId}/sections/${existing.sortOrder}`);
}

export async function deleteProjectTemplateSection(
  input: DeleteProjectTemplateSectionInput,
): Promise<void> {
  const existing = await prisma.projectTemplateSection.findFirst({
    where: {
      id: input.sectionId,
      projectTemplateId: input.templateId,
    },
    select: { id: true, sortOrder: true },
  });

  if (!existing) throw new Error("TEMPLATE_SECTION_NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.projectTemplateSection.delete({
      where: { id: input.sectionId },
    });
    await tx.projectTemplateSection.updateMany({
      where: {
        projectTemplateId: input.templateId,
        sortOrder: { gt: existing.sortOrder },
      },
      data: { sortOrder: { decrement: 1 } },
    });
  });

  safeRevalidatePath("/assets/templates");
  safeRevalidatePath(`/assets/templates/${input.templateId}/edit`);
}

export async function deleteProjectTemplate(
  templateId: string,
): Promise<void> {
  await prisma.projectTemplate.delete({ where: { id: templateId } });
  safeRevalidatePath("/assets/templates");
}

export async function copyProjectTemplateSection(sectionId: string): Promise<string | null> {
  const section = await prisma.projectTemplateSection.findUnique({
    where: { id: sectionId },
    include: {
      presetBindingRows: { orderBy: { sortOrder: "asc" } },
      promptBlockRows: { orderBy: { sortOrder: "asc" } },
      manualLoraEntries: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!section) return null;

  const count = await prisma.projectTemplateSection.count({
    where: { projectTemplateId: section.projectTemplateId },
  });

  const copied = await prisma.$transaction(async (tx) => {
    const createdSection = await tx.projectTemplateSection.create({
      data: {
        projectTemplateId: section.projectTemplateId,
        sortOrder: count,
        folderId: section.folderId,
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
        loraConfig: Prisma.DbNull,
        extraParams: section.extraParams ?? undefined,
        promptBlocks: Prisma.DbNull,
      },
    });

    if (
      section.presetBindingRows.length > 0 ||
      section.promptBlockRows.length > 0 ||
      section.manualLoraEntries.length > 0
    ) {
      const bindingIdMap = new Map<string, string>();
      for (const row of section.presetBindingRows) {
        const copiedBindingId = `templateSectionPresetBinding:${createdSection.id}:${row.bindingKey}`;
        bindingIdMap.set(row.id, copiedBindingId);
        await tx.templateSectionPresetBinding.create({
          data: {
            id: copiedBindingId,
            projectTemplateSectionId: createdSection.id,
            bindingKey: row.bindingKey,
            categoryId: row.categoryId,
            presetId: row.presetId,
            variantId: row.variantId,
            groupBindingKey: row.groupBindingKey,
            sortOrder: row.sortOrder,
          },
        });
      }
      for (const row of section.promptBlockRows) {
        await tx.templateSectionPromptBlock.create({
          data: {
            id: `templateSectionPromptBlock:${createdSection.id}:${row.id}`,
            projectTemplateSectionId: createdSection.id,
            templateSectionBindingId: row.templateSectionBindingId
              ? (bindingIdMap.get(row.templateSectionBindingId) ?? null)
              : null,
            type: row.type,
            customLabel: row.customLabel,
            customPositive: row.customPositive,
            customNegative: row.customNegative,
            sortOrder: row.sortOrder,
          },
        });
      }
      for (const row of section.manualLoraEntries) {
        await tx.templateSectionManualLoraEntry.create({
          data: {
            id: `templateSectionManualLoraEntry:${createdSection.id}:${row.id}`,
            projectTemplateSectionId: createdSection.id,
            templateSectionBindingId: row.templateSectionBindingId
              ? (bindingIdMap.get(row.templateSectionBindingId) ?? null)
              : null,
            stage: row.stage,
            path: row.path,
            weight: row.weight,
            enabled: row.enabled,
            detachedFromBindingKey: row.detachedFromBindingKey,
            detachedFromPresetId: row.detachedFromPresetId,
            detachedFromVariantId: row.detachedFromVariantId,
            detachedFromPath: row.detachedFromPath,
            metadata: row.metadata == null
              ? undefined
              : JSON.parse(JSON.stringify(row.metadata)) as Prisma.InputJsonValue,
            sortOrder: row.sortOrder,
          },
        });
      }
    } else {
      const rows = buildTemplateSectionRowsFromLegacyTemplateData({
        projectTemplateSectionId: createdSection.id,
        promptBlocks: section.promptBlocks,
        loraConfig: section.loraConfig,
      });
      await createTemplateSectionRelationRows(tx, rows);
    }

    return createdSection;
  });

  safeRevalidatePath("/assets/templates");
  safeRevalidatePath(`/assets/templates/${section.projectTemplateId}/edit`);
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
