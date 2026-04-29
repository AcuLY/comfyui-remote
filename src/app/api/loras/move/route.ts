import { rename, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { ok, fail } from "@/lib/api-response";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

/** Ensure resolved path stays within baseDir */
function isWithinBase(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

export async function POST(request: Request) {
  if (!env.loraBaseDir) {
    return fail("LORA_BASE_DIR is not configured.", 500);
  }

  let body: { sourcePath?: string; targetDir?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { sourcePath, targetDir } = body;
  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    return fail("sourcePath is required", 400);
  }
  if (typeof targetDir !== "string") {
    return fail("targetDir is required", 400);
  }

  const absoluteSource = path.resolve(env.loraBaseDir, /* turbopackIgnore: true */ sourcePath);
  const absoluteTargetDir = path.resolve(env.loraBaseDir, /* turbopackIgnore: true */ targetDir || ".");
  const fileName = path.basename(absoluteSource);
  const absoluteTarget = `${absoluteTargetDir}${path.sep}${fileName}`;

  // Security checks
  if (!isWithinBase(env.loraBaseDir, absoluteSource)) {
    return fail("Invalid source path", 400);
  }
  if (!isWithinBase(env.loraBaseDir, absoluteTarget)) {
    return fail("Invalid target path", 400);
  }

  // Verify source exists and is a file
  try {
    const sourceStat = await stat(absoluteSource);
    if (!sourceStat.isFile()) {
      return fail("Source is not a file", 400);
    }
  } catch {
    return fail("Source file not found", 404);
  }

  // Ensure target directory exists
  await mkdir(absoluteTargetDir, { recursive: true });

  // Move file
  try {
    await rename(absoluteSource, absoluteTarget);
  } catch (error) {
    return fail("Failed to move file", 500, String(error));
  }

  // Update DB record if exists
  const newRelativePath = path
    .relative(env.loraBaseDir, absoluteTarget)
    .replace(/\\/g, "/");
  const newCategory = targetDir || ".";

  try {
    await db.loraAsset.updateMany({
      where: { absolutePath: absoluteSource },
      data: {
        absolutePath: absoluteTarget,
        relativePath: newRelativePath,
        category: newCategory,
      },
    });
  } catch {
    // DB update is best-effort; file is already moved
  }

  return ok({ newPath: newRelativePath });
}
