import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type TrainingTemplateRow = Prisma.TrainingTemplateGetPayload<{
  include: {
    sections: {
      include: {
        blocks: true;
      };
    };
  };
}>;

export type TrainingTemplateBlockInput = {
  id?: string;
  sourceType: "preset" | "local";
  title: string;
  localText?: string | null;
  sceneDescriptionPresetCategoryId?: string | null;
  sceneDescriptionPresetId?: string | null;
  sortOrder?: number;
  enabled?: boolean;
};

export type TrainingTemplateSectionInput = {
  id?: string;
  name: string;
  sortOrder?: number;
  enabled: boolean;
  sectionDefaultsJson?: Prisma.InputJsonValue | null;
  blocks: TrainingTemplateBlockInput[];
};

export type TrainingTemplateInput = {
  id?: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  imagePromptGuidance: string;
  imagePromptFormat: string;
  captioningGuidance: string;
  trainingCaptionFormat: string;
  trainingDefaultsJson?: Prisma.InputJsonValue | null;
  sortOrder?: number;
  isActive?: boolean;
  sections: TrainingTemplateSectionInput[];
};

const trainingTemplateInclude = {
  sections: {
    orderBy: [
      { sortOrder: "asc" as const },
      { createdAt: "asc" as const },
    ],
    include: {
      blocks: {
        orderBy: [
          { sortOrder: "asc" as const },
          { createdAt: "asc" as const },
        ],
      },
    },
  },
};

function mapSectionCreate(section: TrainingTemplateSectionInput, index: number) {
  return {
    id: section.id,
    name: section.name,
    enabled: section.enabled,
    sortOrder: section.sortOrder ?? index,
    sectionDefaultsJson: section.sectionDefaultsJson ?? Prisma.JsonNull,
    blocks: {
      create: section.blocks.map((block, blockIndex) => ({
        id: block.id,
        sourceType: block.sourceType,
        title: block.title,
        localText: block.localText ?? null,
        sceneDescriptionPresetCategoryId: block.sceneDescriptionPresetCategoryId ?? null,
        sceneDescriptionPresetId: block.sceneDescriptionPresetId ?? null,
        sortOrder: block.sortOrder ?? blockIndex,
        enabled: block.enabled ?? true,
      })),
    },
  };
}

export async function listTrainingTemplateRows() {
  return prisma.trainingTemplate.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { sortOrder: "asc" },
      { updatedAt: "desc" },
    ],
    include: trainingTemplateInclude,
  });
}

export async function getTrainingTemplateRow(templateId: string) {
  return prisma.trainingTemplate.findFirst({
    where: {
      OR: [
        { id: templateId },
        { slug: templateId },
        { name: templateId },
      ],
    },
    include: trainingTemplateInclude,
  });
}

export async function createTrainingTemplateRow(input: TrainingTemplateInput) {
  return prisma.trainingTemplate.create({
    data: {
      id: input.id,
      name: input.name,
      slug: input.slug ?? null,
      description: input.description ?? null,
      imagePromptGuidance: input.imagePromptGuidance,
      imagePromptFormat: input.imagePromptFormat,
      captioningGuidance: input.captioningGuidance,
      trainingCaptionFormat: input.trainingCaptionFormat,
      trainingDefaultsJson: input.trainingDefaultsJson ?? Prisma.JsonNull,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      sections: {
        create: input.sections.map(mapSectionCreate),
      },
    },
    include: trainingTemplateInclude,
  });
}

export async function updateTrainingTemplateRow(templateId: string, input: TrainingTemplateInput) {
  const current = await getTrainingTemplateRow(templateId);
  if (!current) return null;

  return prisma.$transaction(async (tx) => {
    await tx.trainingTemplateSection.deleteMany({
      where: {
        trainingTemplateId: current.id,
      },
    });

    return tx.trainingTemplate.update({
      where: {
        id: current.id,
      },
      data: {
        name: input.name,
        slug: input.slug ?? current.slug,
        description: input.description ?? null,
        imagePromptGuidance: input.imagePromptGuidance,
        imagePromptFormat: input.imagePromptFormat,
        captioningGuidance: input.captioningGuidance,
        trainingCaptionFormat: input.trainingCaptionFormat,
        trainingDefaultsJson: input.trainingDefaultsJson ?? Prisma.JsonNull,
        sortOrder: input.sortOrder ?? current.sortOrder,
        isActive: input.isActive ?? current.isActive,
        sections: {
          create: input.sections.map(mapSectionCreate),
        },
      },
      include: trainingTemplateInclude,
    });
  });
}

export async function softDeleteTrainingTemplateRow(templateId: string) {
  const current = await getTrainingTemplateRow(templateId);
  if (!current) return null;

  return prisma.trainingTemplate.update({
    where: {
      id: current.id,
    },
    data: {
      isActive: false,
    },
    include: trainingTemplateInclude,
  });
}
