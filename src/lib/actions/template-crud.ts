"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import { resolveVariantContent } from "./preset-variant";
import { toJsonValue } from "./_helpers";

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
    loraConfig: toNullableJsonValue(section.loraConfig),
    extraParams: toNullableJsonValue(section.extraParams),
    promptBlocks:
      section.promptBlocks.length > 0
        ? toNullableJsonValue(section.promptBlocks)
        : Prisma.DbNull,
  };
}

// ---------------------------------------------------------------------------
// Project Template CRUD
// ---------------------------------------------------------------------------

export async function createProjectTemplate(
  input: CreateProjectTemplateInput,
): Promise<string> {
  const template = await prisma.projectTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      sections: {
        create: input.sections.map((s, index) => ({
          folderId: s.folderId,
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
          if (updated.count > 0) continue;
        }

        await tx.projectTemplateSection.create({
          data: {
            projectTemplateId: id,
            ...data,
          },
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

  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${input.templateId}/edit`);
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
