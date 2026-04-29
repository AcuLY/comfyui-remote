import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { ModelKind } from "@/lib/model-constants";

type ModelFileItem = {
  name: string;
  type: "file";
  path: string;
  size?: number;
  notes?: string;
  triggerWords?: string;
};

export type ModelBrowseItem =
  | {
      name: string;
      type: "directory";
      path: string;
    }
  | ModelFileItem;

const MODEL_CONFIG: Record<ModelKind, {
  label: string;
  baseDir: () => string;
  extensions: Set<string>;
}> = {
  lora: {
    label: "LoRA",
    baseDir: () => env.loraBaseDir,
    extensions: new Set([".safetensors", ".ckpt", ".pt", ".pth"]),
  },
  checkpoint: {
    label: "checkpoint",
    baseDir: () => env.checkpointBaseDir,
    extensions: new Set([".safetensors"]),
  },
};

export class ModelAssetError extends Error {
  constructor(message: string, readonly status = 400, readonly details?: unknown) {
    super(message);
    this.name = "ModelAssetError";
  }
}

export function parseModelKind(value: string | null | undefined): ModelKind {
  if (!value || value === "lora") {
    return "lora";
  }

  if (value === "checkpoint") {
    return "checkpoint";
  }

  throw new ModelAssetError("Unsupported model kind", 400, {
    supportedKinds: ["lora", "checkpoint"],
  });
}

export function getModelBaseDir(kind: ModelKind) {
  return MODEL_CONFIG[kind].baseDir();
}

function getRequiredModelBaseDir(kind: ModelKind) {
  const baseDir = getModelBaseDir(kind);
  if (!baseDir) {
    throw new ModelAssetError("MODEL_BASE_DIR is not configured.", 500);
  }
  return baseDir;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_");
}

function isWithinBase(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/");
}

function isAllowedModelFile(kind: ModelKind, fileName: string) {
  return MODEL_CONFIG[kind].extensions.has(path.extname(fileName).toLowerCase());
}

async function collectFilesRecursive(
  kind: ModelKind,
  baseDir: string,
  dirRelative: string,
): Promise<ModelFileItem[]> {
  const absoluteDir = path.resolve(baseDir, dirRelative);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const results: ModelFileItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relPath = dirRelative ? `${dirRelative}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push(...await collectFilesRecursive(kind, baseDir, relPath));
    } else if (entry.isFile() && isAllowedModelFile(kind, entry.name)) {
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

  return results;
}

async function attachAssetNotes(kind: ModelKind, baseDir: string, items: ModelBrowseItem[]) {
  const fileAbsolutePaths = items
    .filter((item): item is ModelFileItem => item.type === "file")
    .map((item) => path.resolve(baseDir, item.path));

  if (fileAbsolutePaths.length === 0) {
    return;
  }

  const assets = await db.loraAsset.findMany({
    where: {
      modelType: kind,
      absolutePath: { in: fileAbsolutePaths },
    },
    select: { absolutePath: true, notes: true, triggerWords: true },
  });
  const notesMap = new Map(
    assets.filter((asset) => asset.notes).map((asset) => [asset.absolutePath, asset.notes!]),
  );
  const triggerMap = new Map(
    assets.filter((asset) => asset.triggerWords).map((asset) => [asset.absolutePath, asset.triggerWords!]),
  );

  for (const item of items) {
    if (item.type !== "file") continue;
    const absPath = path.resolve(baseDir, item.path);
    const note = notesMap.get(absPath);
    if (note) item.notes = note;
    const triggerWords = triggerMap.get(absPath);
    if (kind === "lora" && triggerWords) {
      item.triggerWords = triggerWords;
    }
  }
}

export async function browseModelDirectory(
  kind: ModelKind,
  rawRelativePath: string,
  recursive: boolean,
) {
  const baseDir = getRequiredModelBaseDir(kind);
  const relativePath = normalizeRelativePath(rawRelativePath);
  const absoluteDir = path.resolve(baseDir, relativePath);

  if (!isWithinBase(baseDir, absoluteDir)) {
    throw new ModelAssetError("Invalid path", 400);
  }

  try {
    if (recursive) {
      const files = await collectFilesRecursive(kind, baseDir, relativePath);
      await attachAssetNotes(kind, baseDir, files);
      files.sort((a, b) => a.name.localeCompare(b.name));
      return { currentPath: relativePath, parentPath: null, items: files };
    }

    const entries = await readdir(absoluteDir, { withFileTypes: true });
    const items: ModelBrowseItem[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          type: "directory",
          path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
        });
      } else if (entry.isFile() && isAllowedModelFile(kind, entry.name)) {
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

    await attachAssetNotes(kind, baseDir, items);
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    let parentPath: string | null = null;
    if (relativePath) {
      const parent = path.dirname(relativePath).replace(/\\/g, "/");
      parentPath = parent === "." ? "" : parent;
    }

    return { currentPath: relativePath, parentPath, items };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ModelAssetError("Directory not found", 404);
    }
    throw new ModelAssetError("Failed to browse directory", 500, String(error));
  }
}

export async function listModelAssets(kind: ModelKind) {
  const assets = await db.loraAsset.findMany({
    where: { modelType: kind },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return assets.map((asset) => ({
    ...asset,
    size: asset.size === null ? null : Number(asset.size),
    uploadedAt: asset.uploadedAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }));
}

export async function getModelNotes(kind: ModelKind, rawPaths: string) {
  const baseDir = getRequiredModelBaseDir(kind);
  if (!rawPaths.trim()) {
    return {};
  }

  const relativePaths = rawPaths.split(",").filter(Boolean).map(normalizeRelativePath);
  const absolutePaths = relativePaths.map((relativePath) => path.resolve(baseDir, relativePath));

  const assets = await db.loraAsset.findMany({
    where: {
      modelType: kind,
      absolutePath: { in: absolutePaths },
    },
    select: { absolutePath: true, notes: true, triggerWords: true },
  });

  const result: Record<string, { notes?: string; triggerWords?: string }> = {};
  for (const asset of assets) {
    if (!asset.notes && !asset.triggerWords) continue;
    const relativePath = path.relative(baseDir, asset.absolutePath).replace(/\\/g, "/");
    result[relativePath] = {};
    if (asset.notes) result[relativePath].notes = asset.notes;
    if (kind === "lora" && asset.triggerWords) {
      result[relativePath].triggerWords = asset.triggerWords;
    }
  }

  return result;
}

export async function updateModelNotes(
  kind: ModelKind,
  input: { path?: string; notes?: string; triggerWords?: string },
) {
  const baseDir = getRequiredModelBaseDir(kind);
  const relativePath = input.path ? normalizeRelativePath(input.path) : "";
  const notes = input.notes ?? "";
  const triggerWords = kind === "lora" ? (input.triggerWords ?? "") : null;

  if (!relativePath.trim()) {
    throw new ModelAssetError("path is required", 400);
  }

  const absolutePath = path.resolve(baseDir, relativePath);
  if (!isWithinBase(baseDir, absolutePath)) {
    throw new ModelAssetError("Invalid path", 400);
  }

  const fileName = path.basename(relativePath);
  const name = path.parse(fileName).name;
  const category = path.dirname(relativePath).replace(/\\/g, "/") || ".";

  const asset = await db.loraAsset.upsert({
    where: { absolutePath },
    update: {
      modelType: kind,
      notes,
      triggerWords,
    },
    create: {
      modelType: kind,
      name,
      category,
      fileName,
      absolutePath,
      relativePath,
      notes,
      triggerWords,
    },
  });

  return { id: asset.id, notes: asset.notes, triggerWords: asset.triggerWords };
}

export async function saveUploadedModelFile(kind: ModelKind, file: File, targetDir: string) {
  const baseDir = getRequiredModelBaseDir(kind);
  const safeName = sanitizeFileName(file.name);
  if (!isAllowedModelFile(kind, safeName)) {
    throw new ModelAssetError(`${MODEL_CONFIG[kind].label} only supports ${[...MODEL_CONFIG[kind].extensions].join(", ")} files.`, 400);
  }

  const normalizedDir = normalizeRelativePath(targetDir || "");
  const absoluteTargetDir = path.resolve(baseDir, normalizedDir);
  if (!isWithinBase(baseDir, absoluteTargetDir)) {
    throw new ModelAssetError("Invalid target directory", 400);
  }

  const targetPath = path.join(absoluteTargetDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(absoluteTargetDir, { recursive: true });
  await writeFile(targetPath, buffer);

  const relativePath = path.relative(baseDir, targetPath).replace(/\\/g, "/");
  const record = await db.loraAsset.upsert({
    where: { absolutePath: targetPath },
    update: {
      modelType: kind,
      name: safeName,
      category: normalizedDir || ".",
      fileName: safeName,
      relativePath,
      size: BigInt(buffer.byteLength),
      source: "upload",
    },
    create: {
      modelType: kind,
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

export async function moveModelFile(
  kind: ModelKind,
  input: { sourcePath?: string; targetDir?: string },
) {
  const baseDir = getRequiredModelBaseDir(kind);
  const { sourcePath, targetDir } = input;

  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    throw new ModelAssetError("sourcePath is required", 400);
  }
  if (typeof targetDir !== "string") {
    throw new ModelAssetError("targetDir is required", 400);
  }

  const absoluteSource = path.resolve(baseDir, normalizeRelativePath(sourcePath));
  const absoluteTargetDir = path.resolve(baseDir, normalizeRelativePath(targetDir || "."));
  const fileName = path.basename(absoluteSource);
  const absoluteTarget = `${absoluteTargetDir}${path.sep}${fileName}`;

  if (!isWithinBase(baseDir, absoluteSource)) {
    throw new ModelAssetError("Invalid source path", 400);
  }
  if (!isWithinBase(baseDir, absoluteTarget)) {
    throw new ModelAssetError("Invalid target path", 400);
  }

  try {
    const sourceStat = await stat(absoluteSource);
    if (!sourceStat.isFile()) {
      throw new ModelAssetError("Source is not a file", 400);
    }
  } catch (error) {
    if (error instanceof ModelAssetError) throw error;
    throw new ModelAssetError("Source file not found", 404);
  }

  await mkdir(absoluteTargetDir, { recursive: true });

  try {
    await rename(absoluteSource, absoluteTarget);
  } catch (error) {
    throw new ModelAssetError("Failed to move file", 500, String(error));
  }

  const newRelativePath = path.relative(baseDir, absoluteTarget).replace(/\\/g, "/");
  const newCategory = targetDir || ".";

  await db.loraAsset.updateMany({
    where: { absolutePath: absoluteSource, modelType: kind },
    data: {
      absolutePath: absoluteTarget,
      relativePath: newRelativePath,
      category: newCategory,
    },
  }).catch(() => {});

  return { newPath: newRelativePath };
}
