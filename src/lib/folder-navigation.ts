export type FolderNavigationFolder = {
  id: string;
  name?: string;
  parentId: string | null;
  sortOrder: number;
};

export type FolderNavigationItem = {
  id: string;
  folderId: string | null;
};

export function buildFolderScopedItemOrder<TItem extends FolderNavigationItem>(
  folders: FolderNavigationFolder[],
  items: TItem[],
): TItem[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const childrenByParentId = new Map<string | null, FolderNavigationFolder[]>();
  const itemsByFolderId = new Map<string | null, TItem[]>();

  for (const folder of folders) {
    const parentId = folder.parentId && folderIds.has(folder.parentId)
      ? folder.parentId
      : null;
    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.push(folder);
    childrenByParentId.set(parentId, siblings);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const nameCompare = (a.name ?? "").localeCompare(b.name ?? "");
      if (nameCompare !== 0) return nameCompare;
      return a.id.localeCompare(b.id);
    });
  }

  for (const item of items) {
    const folderId = item.folderId && folderIds.has(item.folderId)
      ? item.folderId
      : null;
    const folderItems = itemsByFolderId.get(folderId) ?? [];
    folderItems.push(item);
    itemsByFolderId.set(folderId, folderItems);
  }

  const orderedItems: TItem[] = [];
  const appendFolderContents = (parentId: string | null) => {
    for (const child of childrenByParentId.get(parentId) ?? []) {
      appendFolderContents(child.id);
    }
    orderedItems.push(...(itemsByFolderId.get(parentId) ?? []));
  };

  appendFolderContents(null);
  return orderedItems;
}

export function firstSearchParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.trim();
  return normalized ? normalized : null;
}

export function hrefWithFolderQuery(
  href: string,
  queryName: string,
  folderId: string | null,
  hash?: string,
) {
  const [hrefWithoutHash, existingHash] = href.split("#", 2);
  const queryIndex = hrefWithoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? hrefWithoutHash.slice(0, queryIndex) : hrefWithoutHash;
  const queryString = queryIndex >= 0 ? hrefWithoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(queryString);

  if (folderId) params.set(queryName, folderId);
  else params.delete(queryName);

  const nextQueryString = params.toString();
  const nextHash = hash ?? existingHash;
  const normalizedHash = nextHash?.replace(/^#/, "");

  return `${pathname}${nextQueryString ? `?${nextQueryString}` : ""}${normalizedHash ? `#${normalizedHash}` : ""}`;
}
