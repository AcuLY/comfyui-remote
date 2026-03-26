import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { env } from "@/lib/env";

const LORA_EXTENSIONS = new Set([".safetensors", ".ckpt", ".pt", ".pth"]);

/** Ensure resolved path stays within baseDir (prevent path traversal) */
function isWithinBase(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

export async function GET(request: NextRequest) {
  if (!env.loraBaseDir) {
    return fail("LORA_BASE_DIR is not configured.", 500);
  }

  const searchParams = request.nextUrl.searchParams;
  const relativePath = (searchParams.get("path") ?? "").replace(/\\/g, "/");

  const absoluteDir = path.resolve(env.loraBaseDir, relativePath);

  if (!isWithinBase(env.loraBaseDir, absoluteDir)) {
    return fail("Invalid path", 400);
  }

  try {
    const entries = await readdir(absoluteDir, { withFileTypes: true });

    const items: {
      name: string;
      type: "directory" | "file";
      path: string;
      size?: number;
    }[] = [];

    for (const entry of entries) {
      // Skip hidden files/directories
      if (entry.name.startsWith(".")) continue;

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          type: "directory",
          path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
        });
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (LORA_EXTENSIONS.has(ext)) {
          const filePath = path.join(absoluteDir, entry.name);
          const fileStat = await stat(filePath);
          items.push({
            name: entry.name,
            type: "file",
            path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
            size: Number(fileStat.size),
          });
        }
      }
    }

    // Sort: directories first, then files, each alphabetical
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Compute parent path
    let parentPath: string | null = null;
    if (relativePath) {
      const parent = path.dirname(relativePath).replace(/\\/g, "/");
      parentPath = parent === "." ? "" : parent;
    }

    return ok({
      currentPath: relativePath,
      parentPath,
      items,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fail("Directory not found", 404);
    }
    return fail("Failed to browse directory", 500, String(error));
  }
}
