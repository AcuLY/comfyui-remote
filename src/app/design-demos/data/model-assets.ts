import fs from "node:fs";
import path from "node:path";

import type { DemoAsset } from "./types";
import { formatSize } from "./row-shaping";

export function modelAssetsFromEnv(): DemoAsset[] {
  const baseDir = process.env.MODEL_BASE_DIR;
  if (!baseDir) return [];

  const roots = [
    { dir: path.join(baseDir, "checkpoints"), modelType: "checkpoint", category: "checkpoints" },
    { dir: path.join(baseDir, "loras"), modelType: "lora", category: "loras" },
  ];
  const assets: DemoAsset[] = [];

  function walk(root: string, current: string, modelType: string, category: string, depth: number) {
    if (assets.length >= 80 || depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(/* turbopackIgnore: true */ current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (assets.length >= 80) break;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(root, fullPath, modelType, category, depth + 1);
      } else if (/\.(safetensors|ckpt|pt|pth)$/i.test(entry.name)) {
        let size: number | null = null;
        try {
          size = fs.statSync(/* turbopackIgnore: true */ fullPath).size;
        } catch {
          size = null;
        }
        assets.push({
          id: `${modelType}-${assets.length}`,
          name: path.basename(entry.name, path.extname(entry.name)),
          modelType,
          category,
          fileName: entry.name,
          relativePath: path.relative(root, fullPath).replace(/\\/g, "/"),
          sizeLabel: formatSize(size),
          source: "MODEL_BASE_DIR",
          notes: "",
          triggerWords: "",
        });
      }
    }
  }

  for (const root of roots) {
    walk(root.dir, root.dir, root.modelType, root.category, 0);
  }
  return assets;
}
