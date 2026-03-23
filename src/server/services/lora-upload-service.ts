import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getLoraCategories, resolveLoraRelativeDir } from "@/lib/path-maps";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_");
}

export async function saveUploadedLora(file: File, category: string) {
  const relativeDir = resolveLoraRelativeDir(category);
  if (!relativeDir) {
    throw new Error(`Unsupported category: ${category}`);
  }
  if (!env.loraBaseDir) {
    throw new Error("LORA_BASE_DIR is not configured.");
  }

  const safeName = sanitizeFileName(file.name);
  const targetDir = path.join(env.loraBaseDir, relativeDir);
  const targetPath = path.join(targetDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, buffer);

  const record = await db.loraAsset.create({
    data: {
      name: safeName,
      category,
      fileName: safeName,
      absolutePath: targetPath,
      relativePath: path.join(relativeDir, safeName).replaceAll("\\", "/"),
      size: BigInt(buffer.byteLength),
      source: "upload",
    },
  });

  return record;
}

export function getUploadMeta() {
  return {
    categories: getLoraCategories(),
  };
}
