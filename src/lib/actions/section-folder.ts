"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function ensureProjectSectionFolderParent(projectId: string, parentId: string | null) {
  if (!parentId) return;
  const parent = await prisma.projectSectionFolder.findFirst({
    where: { id: parentId, projectId },
    select: { id: true },
  });
  if (!parent) throw new Error("SECTION_FOLDER_PARENT_NOT_FOUND");
}

async function ensureTemplateSectionFolderParent(templateId: string, parentId: string | null) {
  if (!parentId) return;
  const parent = await prisma.projectTemplateSectionFolder.findFirst({
    where: { id: parentId, projectTemplateId: templateId },
    select: { id: true },
  });
  if (!parent) throw new Error("TEMPLATE_SECTION_FOLDER_PARENT_NOT_FOUND");
}

async function ensureProjectSectionTargetFolder(projectId: string, folderId: string | null) {
  if (!folderId) return;
  const folder = await prisma.projectSectionFolder.findFirst({
    where: { id: folderId, projectId },
    select: { id: true },
  });
  if (!folder) throw new Error("SECTION_FOLDER_NOT_FOUND");
}

async function ensureTemplateSectionTargetFolder(templateId: string, folderId: string | null) {
  if (!folderId) return;
  const folder = await prisma.projectTemplateSectionFolder.findFirst({
    where: { id: folderId, projectTemplateId: templateId },
    select: { id: true },
  });
  if (!folder) throw new Error("TEMPLATE_SECTION_FOLDER_NOT_FOUND");
}

export async function createProjectSectionFolder(
  projectId: string,
  parentId: string | null,
  name: string,
) {
  const folderName = name.trim();
  if (!folderName) throw new Error("文件夹名称不能为空");
  await ensureProjectSectionFolderParent(projectId, parentId);

  const maxSort = await prisma.projectSectionFolder.aggregate({
    where: { projectId, parentId: parentId ?? null },
    _max: { sortOrder: true },
  });
  const folder = await prisma.projectSectionFolder.create({
    data: {
      projectId,
      parentId,
      name: folderName,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return folder;
}

export async function renameProjectSectionFolder(id: string, name: string) {
  const folderName = name.trim();
  if (!folderName) throw new Error("文件夹名称不能为空");
  const folder = await prisma.projectSectionFolder.update({
    where: { id },
    data: { name: folderName },
    select: { projectId: true },
  });
  revalidatePath(`/projects/${folder.projectId}`);
}

export async function deleteProjectSectionFolder(id: string) {
  const folder = await prisma.projectSectionFolder.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!folder) return;

  const [childCount, sectionCount] = await Promise.all([
    prisma.projectSectionFolder.count({ where: { parentId: id } }),
    prisma.projectSection.count({ where: { folderId: id } }),
  ]);
  if (childCount + sectionCount > 0) {
    throw new Error(`文件夹不为空，包含 ${childCount} 个子文件夹、${sectionCount} 个小节`);
  }

  await prisma.projectSectionFolder.delete({ where: { id } });
  revalidatePath(`/projects/${folder.projectId}`);
}

export async function moveProjectSectionsToFolder(
  projectId: string,
  sectionIds: string[],
  folderId: string | null,
) {
  const uniqueSectionIds = [...new Set(sectionIds)];
  if (uniqueSectionIds.length === 0) return;
  await ensureProjectSectionTargetFolder(projectId, folderId);

  await prisma.projectSection.updateMany({
    where: {
      projectId,
      id: { in: uniqueSectionIds },
    },
    data: { folderId },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function reorderProjectSectionFolders(
  projectId: string,
  parentId: string | null,
  ids: string[],
) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.projectSectionFolder.updateMany({
        where: { id, projectId, parentId: parentId ?? null },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function createTemplateSectionFolder(
  templateId: string,
  parentId: string | null,
  name: string,
) {
  const folderName = name.trim();
  if (!folderName) throw new Error("文件夹名称不能为空");
  await ensureTemplateSectionFolderParent(templateId, parentId);

  const maxSort = await prisma.projectTemplateSectionFolder.aggregate({
    where: { projectTemplateId: templateId, parentId: parentId ?? null },
    _max: { sortOrder: true },
  });
  const folder = await prisma.projectTemplateSectionFolder.create({
    data: {
      projectTemplateId: templateId,
      parentId,
      name: folderName,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${templateId}/edit`);
  return folder;
}

export async function renameTemplateSectionFolder(id: string, name: string) {
  const folderName = name.trim();
  if (!folderName) throw new Error("文件夹名称不能为空");
  const folder = await prisma.projectTemplateSectionFolder.update({
    where: { id },
    data: { name: folderName },
    select: { projectTemplateId: true },
  });
  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${folder.projectTemplateId}/edit`);
}

export async function deleteTemplateSectionFolder(id: string) {
  const folder = await prisma.projectTemplateSectionFolder.findUnique({
    where: { id },
    select: { projectTemplateId: true },
  });
  if (!folder) return;

  const [childCount, sectionCount] = await Promise.all([
    prisma.projectTemplateSectionFolder.count({ where: { parentId: id } }),
    prisma.projectTemplateSection.count({ where: { folderId: id } }),
  ]);
  if (childCount + sectionCount > 0) {
    throw new Error(`文件夹不为空，包含 ${childCount} 个子文件夹、${sectionCount} 个小节`);
  }

  await prisma.projectTemplateSectionFolder.delete({ where: { id } });
  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${folder.projectTemplateId}/edit`);
}

export async function moveTemplateSectionsToFolder(
  templateId: string,
  sectionIds: string[],
  folderId: string | null,
) {
  const uniqueSectionIds = [...new Set(sectionIds)];
  if (uniqueSectionIds.length === 0) return;
  await ensureTemplateSectionTargetFolder(templateId, folderId);

  await prisma.projectTemplateSection.updateMany({
    where: {
      projectTemplateId: templateId,
      id: { in: uniqueSectionIds },
    },
    data: { folderId },
  });
  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${templateId}/edit`);
}

export async function reorderTemplateSectionFolders(
  templateId: string,
  parentId: string | null,
  ids: string[],
) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.projectTemplateSectionFolder.updateMany({
        where: { id, projectTemplateId: templateId, parentId: parentId ?? null },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${templateId}/edit`);
}
