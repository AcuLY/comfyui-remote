"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProjectFolder(parentId: string | null, name: string) {
  const maxSort = await prisma.projectFolder.aggregate({
    where: { parentId: parentId ?? null },
    _max: { sortOrder: true },
  });
  const folder = await prisma.projectFolder.create({
    data: {
      parentId,
      name,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/projects");
  return folder;
}

export async function renameProjectFolder(id: string, name: string) {
  await prisma.projectFolder.update({ where: { id }, data: { name } });
  revalidatePath("/projects");
}

export async function deleteProjectFolder(id: string) {
  const [childCount, projectCount] = await Promise.all([
    prisma.projectFolder.count({ where: { parentId: id } }),
    prisma.project.count({ where: { folderId: id } }),
  ]);
  if (childCount + projectCount > 0) {
    throw new Error(`文件夹不为空，包含 ${childCount} 个子文件夹、${projectCount} 个项目`);
  }
  await prisma.projectFolder.delete({ where: { id } });
  revalidatePath("/projects");
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  await prisma.project.update({ where: { id: projectId }, data: { folderId } });
  revalidatePath("/projects");
}

export async function reorderProjectFolders(parentId: string | null, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.projectFolder.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/projects");
}
