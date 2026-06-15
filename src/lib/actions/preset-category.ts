"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  ORDINARY_PRESET_CATEGORY_TYPE,
  assertOrdinaryPresetCategories,
  assertOrdinaryPresetCategory,
} from "./preset-resource-scope";

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

function normalizeSlotTemplate(
  slotTemplate: Array<{ categoryId: string; label?: string }> | null | undefined,
) {
  if (!slotTemplate) return [];

  return slotTemplate
    .map((slot, index) => ({
      slotKey: `${index}:${slot.categoryId}`,
      slotCategoryId: slot.categoryId,
      label: slot.label?.trim() || null,
      sortOrder: index,
    }))
    .filter((slot) => slot.slotCategoryId);
}

async function replaceCategorySlotTemplate(
  tx: Prisma.TransactionClient,
  categoryId: string,
  slotTemplate: Array<{ categoryId: string; label?: string }> | null | undefined,
) {
  const slots = normalizeSlotTemplate(slotTemplate);
  await tx.presetCategorySlot.deleteMany({ where: { categoryId } });
  if (slots.length === 0) return;

  await tx.presetCategorySlot.createMany({
    data: slots.map((slot) => ({
      categoryId,
      slotKey: slot.slotKey,
      slotCategoryId: slot.slotCategoryId,
      label: slot.label,
      sortOrder: slot.sortOrder,
    })),
  });
}

// ---------------------------------------------------------------------------
// PresetCategory CRUD
// ---------------------------------------------------------------------------

export async function createPresetCategory(input: PresetCategoryInput) {
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxOrder = await prisma.presetCategory.aggregate({
      where: { type: ORDINARY_PRESET_CATEGORY_TYPE },
      _max: { sortOrder: true },
    });
    sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }

  let color = input.color;
  if (!color) {
    const hue = Math.floor(Math.random() * 360);
    color = `${hue} 50% 55%`;
  }
  const { slotTemplate, ...rest } = input;
  const cat = await prisma.$transaction(async (tx) => {
    const created = await tx.presetCategory.create({
      data: {
        ...rest,
        color,
        sortOrder,
        type: ORDINARY_PRESET_CATEGORY_TYPE,
      },
    });
    if (slotTemplate !== undefined) {
      await replaceCategorySlotTemplate(tx, created.id, slotTemplate);
    }
    return created;
  });
  revalidatePath("/assets/presets");
  return cat;
}

export async function updatePresetCategory(id: string, input: Partial<PresetCategoryInput>) {
  await assertOrdinaryPresetCategory(id);
  if (input.slotTemplate) {
    await assertOrdinaryPresetCategories(input.slotTemplate.map((slot) => slot.categoryId));
  }

  const { slotTemplate, ...rest } = input;
  delete rest.type;
  const cat = await prisma.$transaction(async (tx) => {
    const updated = await tx.presetCategory.update({ where: { id }, data: rest });
    if (slotTemplate !== undefined) {
      await replaceCategorySlotTemplate(tx, id, slotTemplate);
    }
    return updated;
  });
  revalidatePath("/assets/presets");
  return cat;
}

export async function deletePresetCategory(id: string) {
  await assertOrdinaryPresetCategory(id);
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
  await assertOrdinaryPresetCategories(ids);
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
  await assertOrdinaryPresetCategories(ids);
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
  await assertOrdinaryPresetCategory(categoryId);
  await assertOrdinaryPresetCategories(slotTemplate.map((slot) => slot.categoryId));
  await prisma.$transaction(async (tx) => {
    await replaceCategorySlotTemplate(tx, categoryId, slotTemplate);
  });
  revalidatePath("/assets/presets");
}
