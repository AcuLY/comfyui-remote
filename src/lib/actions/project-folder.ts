"use server";

import {
  createProjectFolder as createProjectFolderInService,
  deleteProjectFolder as deleteProjectFolderInService,
  moveProjectToFolder as moveProjectToFolderInService,
  renameProjectFolder as renameProjectFolderInService,
  reorderProjectFolders as reorderProjectFoldersInService,
} from "@/server/services/project-folder-service";

export async function createProjectFolder(parentId: string | null, name: string) {
  return createProjectFolderInService({ parentId, name });
}

export async function renameProjectFolder(id: string, name: string) {
  await renameProjectFolderInService(id, { name });
}

export async function deleteProjectFolder(id: string) {
  await deleteProjectFolderInService(id);
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  await moveProjectToFolderInService(projectId, folderId);
}

export async function reorderProjectFolders(parentId: string | null, ids: string[]) {
  await reorderProjectFoldersInService({ parentId, ids });
}
