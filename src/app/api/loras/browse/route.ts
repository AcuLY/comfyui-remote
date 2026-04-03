import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

const LORA_EXTENSIONS = new Set([".safetensors", ".ckpt", ".pt", ".pth"]);

/** Ensure resolved path stays within baseDir (prevent path traversal) */
function isWithinBase(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

/** Recursively collect all lora files under a directory */
async function collectFilesRecursive(
  baseDir: string,
  dirRelative: string,
): Promise<{ name: string; type: "file"; path: string; size?: number }[]> {
  const absoluteDir = path.resolve(baseDir, dirRelative);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const results: { name: string; type: "file"; path: string; size?: number }[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relPath = dirRelative ? `${dirRelative}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFiles = await collectFilesRecursive(baseDir, relPath);
      results.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (LORA_EXTENSIONS.has(ext)) {
        const filePath = path.join(absoluteDir, entry.name);
        const fileStat = await stat(filePath);
        results.push({
          name: entry.name,
          type: "file",
          path: relPath,
          size: Number(fileStat.size),
        });
      }
    }
  }
  return results;
}

export async function GET(request: NextRequest) {
  if (!env.loraBaseDir) {
    return fail("LORA_BASE_DIR is not configured.", 500);
  }

  const searchParams = request.nextUrl.searchParams;
  const relativePath = (searchParams.get("path") ?? "").replace(/\\/g, "/");
  const recursive = searchParams.get("recursive") === "true";

  const absoluteDir = path.resolve(env.loraBaseDir, relativePath);

  if (!isWithinBase(env.loraBaseDir, absoluteDir)) {
    return fail("Invalid path", 400);
  }

  try {
    // Recursive mode: return all files across all subdirectories (for search)
    if (recursive) {
      const files = await collectFilesRecursive(env.loraBaseDir, relativePath);

      // Batch-fetch notes for all recursive files
      const allAbsPaths = files.map((f) => path.resolve(env.loraBaseDir, f.path));
      if (allAbsPaths.length > 0) {
        const assets = await db.loraAsset.findMany({
          where: { absolutePath: { in: allAbsPaths } },
          select: { absolutePath: true, notes: true, triggerWords: true },
        });
        const notesMap = new Map(
          assets.filter((a) => a.notes).map((a) => [a.absolutePath, a.notes!])
        );
        const triggerMap = new Map(
          assets.filter((a) => a.triggerWords).map((a) => [a.absolutePath, a.triggerWords!])
        );
        for (const file of files) {
          const absPath = path.resolve(env.loraBaseDir, file.path);
          const note = notesMap.get(absPath);
          if (note) (file as Record<string, unknown>).notes = note;
          const tw = triggerMap.get(absPath);
          if (tw) (file as Record<string, unknown>).triggerWords = tw;
        }
      }

      files.sort((a, b) => a.name.localeCompare(b.name));
      return ok({ currentPath: relativePath, parentPath: null, items: files });
    }
    const entries = await readdir(absoluteDir, { withFileTypes: true });

    const items: {
      name: string;
      type: "directory" | "file";
      path: string;
      size?: number;
      notes?: string;
    }[] = [];

    const fileAbsolutePaths: string[] = [];

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
          fileAbsolutePaths.push(filePath);
        }
      }
    }

    // Batch-fetch notes + triggerWords from DB for all files in this directory
    if (fileAbsolutePaths.length > 0) {
      const assets = await db.loraAsset.findMany({
        where: { absolutePath: { in: fileAbsolutePaths } },
        select: { absolutePath: true, notes: true, triggerWords: true },
      });
      const notesMap = new Map(
        assets.filter((a) => a.notes).map((a) => [a.absolutePath, a.notes!])
      );
      const triggerMap = new Map(
        assets.filter((a) => a.triggerWords).map((a) => [a.absolutePath, a.triggerWords!])
      );
      for (const item of items) {
        if (item.type === "file") {
          const absPath = path.resolve(env.loraBaseDir, item.path);
          const note = notesMap.get(absPath);
          if (note) item.notes = note;
          const tw = triggerMap.get(absPath);
          if (tw) (item as Record<string, unknown>).triggerWords = tw;
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
