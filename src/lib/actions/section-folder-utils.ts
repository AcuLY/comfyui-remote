import { randomUUID } from "node:crypto";

type SourceFolder = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

type SourceSection = {
  id: string;
  folderId: string | null;
};

export type TemplateSectionFolderClonePlan = {
  foldersToCreate: Array<{
    sourceId: string;
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }>;
  sectionFolderIdBySectionId: Map<string, string | null>;
};

export function buildTemplateSectionFolderClonePlan({
  projectFolders,
  projectSections,
  createFolderId = () => randomUUID(),
}: {
  projectFolders: SourceFolder[];
  projectSections: SourceSection[];
  createFolderId?: (folder: SourceFolder) => string;
}): TemplateSectionFolderClonePlan {
  const folderById = new Map(projectFolders.map((folder) => [folder.id, folder]));
  const childrenByParent = new Map<string | null, SourceFolder[]>();

  for (const folder of projectFolders) {
    const parentId = folder.parentId && folderById.has(folder.parentId)
      ? folder.parentId
      : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(folder);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  const targetIdBySourceId = new Map<string, string>();
  const foldersToCreate: TemplateSectionFolderClonePlan["foldersToCreate"] = [];

  function visit(parentId: string | null) {
    for (const folder of childrenByParent.get(parentId) ?? []) {
      const id = createFolderId(folder);
      targetIdBySourceId.set(folder.id, id);
      foldersToCreate.push({
        sourceId: folder.id,
        id,
        name: folder.name,
        parentId: parentId ? targetIdBySourceId.get(parentId) ?? null : null,
        sortOrder: folder.sortOrder,
      });
      visit(folder.id);
    }
  }

  visit(null);

  return {
    foldersToCreate,
    sectionFolderIdBySectionId: new Map(
      projectSections.map((section) => [
        section.id,
        section.folderId ? targetIdBySourceId.get(section.folderId) ?? null : null,
      ]),
    ),
  };
}
