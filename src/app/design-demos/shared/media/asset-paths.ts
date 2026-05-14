import type { DemoAsset } from "../../data/types";
import type { ModelKind } from "../../routing/types";

export function assetKind(asset: DemoAsset): ModelKind {
  const text = `${asset.modelType} ${asset.category} ${asset.relativePath} ${asset.fileName}`.toLowerCase();
  return text.includes("checkpoint") || text.includes("ckpt") ? "checkpoint" : "lora";
}

export function assetPath(asset: DemoAsset) {
  return (asset.relativePath || asset.fileName).replace(/\\/g, "/");
}

export function pathParts(value: string) {
  return value.split("/").filter(Boolean);
}

export function entriesForPath(assets: DemoAsset[], currentPath: string) {
  const currentParts = pathParts(currentPath);
  const folders = new Map<string, { name: string; path: string; count: number }>();
  const files: DemoAsset[] = [];

  for (const asset of assets) {
    const parts = pathParts(assetPath(asset));
    const inPath = currentParts.every((part, index) => parts[index] === part);
    if (!inPath) continue;

    const rest = parts.slice(currentParts.length);
    if (rest.length > 1) {
      const folderPath = [...currentParts, rest[0]].join("/");
      const folder = folders.get(folderPath) ?? { name: rest[0], path: folderPath, count: 0 };
      folder.count += 1;
      folders.set(folderPath, folder);
    } else if (rest.length === 1 || currentParts.length === 0) {
      if (rest.length <= 1) files.push(asset);
    }
  }

  return {
    folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name)),
    files: files.sort((a, b) => assetPath(a).localeCompare(assetPath(b))),
  };
}

export function folderEntriesForAssets(assets: DemoAsset[]) {
  const folders = new Map<string, { name: string; path: string; count: number; depth: number }>();

  for (const asset of assets) {
    const folderParts = pathParts(assetPath(asset)).slice(0, -1);
    for (let index = 0; index < folderParts.length; index += 1) {
      const path = folderParts.slice(0, index + 1).join("/");
      const entry = folders.get(path) ?? {
        name: folderParts[index],
        path,
        count: 0,
        depth: index + 1,
      };
      entry.count += 1;
      folders.set(path, entry);
    }
  }

  return [
    { name: "根目录", path: "", count: assets.length, depth: 0 },
    ...[...folders.values()].sort((a, b) => a.path.localeCompare(b.path)),
  ];
}

export function parentPath(currentPath: string) {
  return pathParts(currentPath).slice(0, -1).join("/");
}
