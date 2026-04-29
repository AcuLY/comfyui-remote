import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export class LoraUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "LoraUploadError";
    this.status = status;
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_");
}

/** Ensure resolved path stays within baseDir */
function isWithinBase(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

/**
 * Save an uploaded LoRA file to disk and create a DB record.
 * @param file - The uploaded file
 * @param targetDir - Relative directory within MODEL_BASE_DIR/loras (e.g. "characters/miku" or "")
 */
export async function saveUploadedLora(file: File, targetDir: string) {
  if (!env.loraBaseDir) {
    throw new LoraUploadError("MODEL_BASE_DIR is not configured.", 500);
  }

  // Sanitize targetDir: allow empty (root), but prevent traversal
  const normalizedDir = (targetDir || "").replace(/\\/g, "/");
  const absoluteTargetDir = path.resolve(env.loraBaseDir, normalizedDir);

  if (!isWithinBase(env.loraBaseDir, absoluteTargetDir)) {
    throw new LoraUploadError("Invalid target directory", 400);
  }

  const safeName = sanitizeFileName(file.name);
  const targetPath = path.join(absoluteTargetDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(absoluteTargetDir, { recursive: true });
  await writeFile(targetPath, buffer);

  const relativePath = path
    .relative(env.loraBaseDir, targetPath)
    .replace(/\\/g, "/");

  const record = await db.loraAsset.create({
    data: {
      modelType: "lora",
      name: safeName,
      category: normalizedDir || ".",
      fileName: safeName,
      absolutePath: targetPath,
      relativePath,
      size: BigInt(buffer.byteLength),
      source: "upload",
    },
  });

  return {
    ...record,
    size: record.size === null ? null : Number(record.size),
    uploadedAt: record.uploadedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function getUploadMeta() {
  return {
    loraBaseDir: env.loraBaseDir ? "configured" : "not configured",
  };
}
