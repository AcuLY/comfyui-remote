import fs from "node:fs";
import path from "node:path";

import { toImageUrl } from "@/lib/image-url";

import type { DemoImage } from "./types";
import { isRenderableLocalImageFile } from "./local-image-files";

export function fallbackImages(): DemoImage[] {
  const imageRoot = path.resolve(
    /* turbopackIgnore: true */ process.env.OUTPUT_BASE_PATH ?? path.join(process.cwd(), "data", "images"),
  );
  const files: string[] = [];

  function walk(dir: string) {
    if (files.length >= 24) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(/* turbopackIgnore: true */ dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= 24) break;
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
        if (isRenderableLocalImageFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(imageRoot);

  return files
    .map((file, index): DemoImage | null => {
      const relative = path.relative(imageRoot, file).replace(/\\/g, "/");
      const url = toImageUrl(relative);
      if (!url) return null;
      return {
        id: `local-image-${index}`,
        src: url,
        full: url,
        label: String(index + 1).padStart(2, "0"),
        status: "pending" as const,
        featured: index % 7 === 0,
        featured2: index % 11 === 0,
        cover: index === 0,
        width: null,
        height: null,
      };
    })
    .filter((image): image is DemoImage => Boolean(image));
}
