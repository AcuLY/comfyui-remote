"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// PresetFolder CRUD
// ---------------------------------------------------------------------------

export async function createPresetFolder(
  categoryId: string,
  parentId: string | null,
  name: string,
) {
  const maxSort = await prisma.presetFolder.aggregate({
    where: { categoryId, parentId: parentId ?? undefined },
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
  await prisma.presetFolder.update({ where: { id }, data: { name } });
  revalidatePath("/assets/presets");
}

export async function deletePresetFolder(id: string) {
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
  if (type === "preset") {
    await prisma.preset.update({ where: { id }, data: { folderId } });
  } else {
    await prisma.presetGroup.update({ where: { id }, data: { folderId } });
  }
  revalidatePath("/assets/presets");
}

export async function reorderPresetFolders(
  categoryId: string,
  parentId: string | null,
  ids: string[],
) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetFolder.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}
