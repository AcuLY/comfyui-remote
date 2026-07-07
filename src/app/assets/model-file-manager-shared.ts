export type AssetBrowseItem = {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
  notes?: string;
  triggerWords?: string;
  civitaiLink?: string;
};

export type AssetBrowseResult = {
  currentPath: string;
  parentPath: string | null;
  items: AssetBrowseItem[];
};

export function formatAssetFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function assetPathSegments(path: string): string[] {
  if (!path) return [];
  return path.split("/").filter(Boolean);
}
