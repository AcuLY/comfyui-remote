"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetCategoryInput = {
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  type?: string; // "preset" | "group"
  slotTemplate?: Array<{ categoryId: string; label?: string }> | null;
  positivePromptOrder?: number;
  negativePromptOrder?: number;
  lora1Order?: number;
  lora2Order?: number;
  sortOrder?: number;
};

type SortDimension = "positivePromptOrder" | "negativePromptOrder" | "lora1Order" | "lora2Order";

// ---------------------------------------------------------------------------
// PresetCategory CRUD
// ---------------------------------------------------------------------------

export async function createPresetCategory(input: PresetCategoryInput) {
  // Auto-assign sortOrder if not provided
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.presetCategory.aggregate({ _max: { sortOrder: true } });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  // Auto-generate a random HSL color if not provided
  if (!input.color) {
    const hue = Math.floor(Math.random() * 360);
    input.color = `${hue} 50% 55%`;
  }
  const { slotTemplate, ...rest } = input;
  const data = { ...rest } as Record<string, unknown>;
  if (slotTemplate !== undefined) {
    data.slotTemplate = slotTemplate != null ? (slotTemplate as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  const cat = await prisma.presetCategory.create({ data: data as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  revalidatePath("/assets/presets");
  return cat;
}

export async function updatePresetCategory(id: string, input: Partial<PresetCategoryInput>) {
  const { slotTemplate, ...rest } = input;
  const data = { ...rest } as Record<string, unknown>;
  if (slotTemplate !== undefined) {
    data.slotTemplate = slotTemplate != null ? (slotTemplate as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  const cat = await prisma.presetCategory.update({ where: { id }, data: data as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  revalidatePath("/assets/presets");
  return cat;
}

export async function deletePresetCategory(id: string) {
  // Only allow deletion if no presets or groups exist in this category
  const presetCount = await prisma.preset.count({ where: { categoryId: id } });
  if (presetCount > 0) {
    throw new Error(`分类下还有 ${presetCount} 个预制，请先删除或移动它们`);
  }
  const groupCount = await prisma.presetGroup.count({ where: { categoryId: id } });
  if (groupCount > 0) {
    throw new Error(`分类下还有 ${groupCount} 个预制组，请先删除或移动它们`);
  }
  await prisma.presetCategory.delete({ where: { id } });
  revalidatePath("/assets/presets");
}

export async function reorderPresetCategories(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetCategory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

export async function updateCategorySortOrders(dimension: SortDimension, ids: string[]) {
  const validDimensions: SortDimension[] = [
    "positivePromptOrder",
    "negativePromptOrder",
    "lora1Order",
    "lora2Order",
  ];
  if (!validDimensions.includes(dimension)) {
    throw new Error(`Invalid dimension: ${dimension}`);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetCategory.update({
        where: { id },
        data: { [dimension]: index },
      }),
    ),
  );
  revalidatePath("/assets/presets");
  revalidatePath("/assets/presets/sort-rules");
}

// ---------------------------------------------------------------------------
// Category slot template
// ---------------------------------------------------------------------------

export async function updateCategorySlotTemplate(
  categoryId: string,
  slotTemplate: Array<{ categoryId: string; label?: string }>,
) {
  await prisma.presetCategory.update({
    where: { id: categoryId },
    data: { slotTemplate: slotTemplate as Prisma.InputJsonValue },
  });
  revalidatePath("/assets/presets");
}
