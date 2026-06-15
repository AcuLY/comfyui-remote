"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertOrdinaryPreset,
  assertOrdinaryPresetCategory,
  assertOrdinaryPresetFolder,
  assertOrdinaryPresetGroup,
} from "./preset-resource-scope";

// ---------------------------------------------------------------------------
// PresetFolder CRUD
// ---------------------------------------------------------------------------

export async function createPresetFolder(
  categoryId: string,
  parentId: string | null,
  name: string,
) {
  await assertOrdinaryPresetCategory(categoryId);
  if (parentId) {
    const parent = await assertOrdinaryPresetFolder(parentId);
    if (parent.categoryId !== categoryId) {
      throw new Error("Ordinary preset parent folder does not belong to the selected category");
    }
  }

  const maxSort = await prisma.presetFolder.aggregate({
    where: { categoryId, parentId },
    _max: { sortOrder: true },
  });
  const folder = await prisma.presetFolder.create({
    data: {
      categoryId,
      parentId,
      name,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/assets/presets");
  return folder;
}

export async function renamePresetFolder(id: string, name: string) {
  await assertOrdinaryPresetFolder(id);
  await prisma.presetFolder.update({ where: { id }, data: { name } });
  revalidatePath("/assets/presets");
}

export async function deletePresetFolder(id: string) {
  await assertOrdinaryPresetFolder(id);
  // Only allow deleting empty folders (no children, no presets, no groups)
  const [childCount, presetCount, groupCount] = await Promise.all([
    prisma.presetFolder.count({ where: { parentId: id } }),
    prisma.preset.count({ where: { folderId: id } }),
    prisma.presetGroup.count({ where: { folderId: id } }),
  ]);
  if (childCount + presetCount + groupCount > 0) {
    throw new Error(`文件夹不为空，包含 ${childCount} 个子文件夹、${presetCount} 个预制、${groupCount} 个预制组`);
  }
  await prisma.presetFolder.delete({ where: { id } });
  revalidatePath("/assets/presets");
}

export async function moveToFolder(
  type: "preset" | "group",
  id: string,
  folderId: string | null,
) {
  const folder = folderId ? await assertOrdinaryPresetFolder(folderId) : null;
  if (type === "preset") {
    const preset = await assertOrdinaryPreset(id);
    if (folder && folder.categoryId !== preset.categoryId) {
      throw new Error("Ordinary preset folder does not belong to the selected preset category");
    }
    await prisma.preset.update({ where: { id }, data: { folderId } });
  } else {
    const group = await assertOrdinaryPresetGroup(id);
    if (folder && folder.categoryId !== group.categoryId) {
      throw new Error("Ordinary preset folder does not belong to the selected group category");
    }
    await prisma.presetGroup.update({ where: { id }, data: { folderId } });
  }
  revalidatePath("/assets/presets");
}

export async function reorderPresetFolders(
  categoryId: string,
  parentId: string | null,
  ids: string[],
) {
  await assertOrdinaryPresetCategory(categoryId);
  if (parentId) await assertOrdinaryPresetFolder(parentId);
  await Promise.all(ids.map((id) => assertOrdinaryPresetFolder(id)));
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetFolder.update({
        where: { id, categoryId, parentId },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidatePath("/assets/presets");
}
