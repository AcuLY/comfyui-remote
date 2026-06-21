import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { db } from "@/lib/db";
import type { ModelKind } from "@/lib/model-constants";
import { getActiveComfyTarget, type ComfyTarget } from "@/server/services/comfy-target";
import {
  browseRemoteModelDirectory,
  hashRemoteModelFile,
  moveRemoteModelFile,
  resolveRemoteModelPath,
  uploadRemoteModelFile,
} from "@/server/services/comfy-remote-file-adapter";

type ModelFileItem = {
  name: string;
  type: "file";
  path: string;
  size?: number;
  notes?: string;
  triggerWords?: string;
  civitaiLink?: string;
};

export type ModelBrowseItem =
  | {
      name: string;
      type: "directory";
      path: string;
    }
  | ModelFileItem;

export type ModelFileHash = {
  name: string;
  path: string;
  absolutePath: string;
  size: number;
  sha256: string;
};

const MODEL_CONFIG: Record<ModelKind, {
  label: string;
  extensions: Set<string>;
}> = {
  lora: {
    label: "LoRA",
    extensions: new Set([".safetensors", ".ckpt", ".pt", ".pth"]),
  },
  checkpoint: {
    label: "checkpoint",
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
  return getModelBaseDirForTarget(getActiveComfyTarget(), kind);
}

function getModelBaseDirForTarget(target: ComfyTarget, kind: ModelKind) {
  if (target.mode === "ssh") {
    return `${target.remoteModelsRoot.replace(/\/+$/, "")}/${kind === "lora" ? "loras" : "checkpoints"}`;
  }
  return kind === "lora" ? target.loraBaseDir : target.checkpointBaseDir;
}

function getRequiredModelBaseDir(kind: ModelKind, target = getActiveComfyTarget()) {
  const baseDir = getModelBaseDirForTarget(target, kind);
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

function normalizeRemoteRelativePath(value: string) {
  const parts = value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.some((part) => part === "." || part === "..")) {
    throw new ModelAssetError("Invalid path", 400);
  }

  return parts.join("/");
}

function resolveAssetPath(baseDir: string, relativePath: string, remote: boolean) {
  if (!remote) return path.resolve(baseDir, relativePath);
  const normalizedBase = baseDir.replace(/\/+$/, "");
  const normalizedRelativePath = normalizeRemoteRelativePath(relativePath);
  return normalizedRelativePath ? `${normalizedBase}/${normalizedRelativePath}` : normalizedBase;
}

function relativeAssetPath(baseDir: string, absolutePath: string, remote: boolean) {
  if (!remote) return path.relative(baseDir, absolutePath).replace(/\\/g, "/");
  const normalizedBase = baseDir.replace(/\/+$/, "");
  return absolutePath.startsWith(`${normalizedBase}/`)
    ? absolutePath.slice(normalizedBase.length + 1)
    : absolutePath;
}

function isAllowedModelFile(kind: ModelKind, fileName: string) {
  return MODEL_CONFIG[kind].extensions.has(path.extname(fileName).toLowerCase());
}

function normalizeCivitaiLink(value: string | undefined) {
  const link = value?.trim() ?? "";
  if (!link) return null;

  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    throw new ModelAssetError(`Invalid Civitai URL: ${link}`, 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ModelAssetError(`Invalid Civitai URL protocol: ${link}`, 400);
  }

  return parsed.toString();
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

async function attachAssetNotes(kind: ModelKind, baseDir: string, items: ModelBrowseItem[], remote = false) {
  const fileAbsolutePaths = items
    .filter((item): item is ModelFileItem => item.type === "file")
    .map((item) => resolveAssetPath(baseDir, item.path, remote));

  if (fileAbsolutePaths.length === 0) {
    return;
  }

  const assets = await db.loraAsset.findMany({
    where: {
      modelType: kind,
      absolutePath: { in: fileAbsolutePaths },
    },
    select: { absolutePath: true, notes: true, triggerWords: true, civitaiLink: true },
  });
  const notesMap = new Map(
    assets.filter((asset) => asset.notes).map((asset) => [asset.absolutePath, asset.notes!]),
  );
  const triggerMap = new Map(
    assets.filter((asset) => asset.triggerWords).map((asset) => [asset.absolutePath, asset.triggerWords!]),
  );
  const civitaiLinkMap = new Map(
    assets.filter((asset) => asset.civitaiLink).map((asset) => [asset.absolutePath, asset.civitaiLink!]),
  );

  for (const item of items) {
    if (item.type !== "file") continue;
    const absPath = resolveAssetPath(baseDir, item.path, remote);
    const note = notesMap.get(absPath);
    if (note) item.notes = note;
    const triggerWords = triggerMap.get(absPath);
    if (kind === "lora" && triggerWords) {
      item.triggerWords = triggerWords;
    }
    const civitaiLink = civitaiLinkMap.get(absPath);
    if (civitaiLink) item.civitaiLink = civitaiLink;
  }
}

export async function browseModelDirectory(
  kind: ModelKind,
  rawRelativePath: string,
  recursive: boolean,
) {
  const target = getActiveComfyTarget();
  if (target.mode === "ssh") {
    try {
      const data = await browseRemoteModelDirectory(target, kind, rawRelativePath, recursive);
      await attachAssetNotes(kind, getModelBaseDirForTarget(target, kind), data.items, true);
      return data;
    } catch (error) {
      throw new ModelAssetError("Failed to browse remote directory", 500, String(error));
    }
  }

  const baseDir = getRequiredModelBaseDir(kind, target);
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

export async function hashModelFile(kind: ModelKind, rawRelativePath: string): Promise<ModelFileHash> {
  const target = getActiveComfyTarget();
  if (target.mode === "ssh") {
    try {
      return await hashRemoteModelFile(target, kind, rawRelativePath);
    } catch (error) {
      throw new ModelAssetError("Failed to hash remote model file", 500, String(error));
    }
  }

  const baseDir = getRequiredModelBaseDir(kind, target);
  const requestedPath = normalizeRelativePath(rawRelativePath);
  if (!requestedPath.trim()) {
    throw new ModelAssetError("path is required", 400);
  }

  const absolutePath = path.resolve(baseDir, requestedPath);
  if (!isWithinBase(baseDir, absolutePath)) {
    throw new ModelAssetError("Invalid path", 400);
  }

  const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, "/");
  const fileName = path.basename(absolutePath);
  if (!isAllowedModelFile(kind, fileName)) {
    throw new ModelAssetError(`${MODEL_CONFIG[kind].label} only supports ${[...MODEL_CONFIG[kind].extensions].join(", ")} files.`, 400);
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ModelAssetError("File not found", 404);
    }
    throw new ModelAssetError("Failed to read file metadata", 500, String(error));
  }

  if (!fileStat.isFile()) {
    throw new ModelAssetError("Path is not a file", 400);
  }

  const sha256 = await new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absolutePath);

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", (error) => {
      reject(new ModelAssetError("Failed to hash model file", 500, String(error)));
    });
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });

  return {
    name: fileName,
    path: relativePath,
    absolutePath,
    size: Number(fileStat.size),
    sha256,
  };
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
  const target = getActiveComfyTarget();
  const remote = target.mode === "ssh";
  const baseDir = getRequiredModelBaseDir(kind, target);
  if (!rawPaths.trim()) {
    return {};
  }

  const relativePaths = rawPaths.split(",").filter(Boolean).map(normalizeRelativePath);
  const absolutePaths = relativePaths.map((relativePath) => resolveAssetPath(baseDir, relativePath, remote));

  const assets = await db.loraAsset.findMany({
    where: {
      modelType: kind,
      absolutePath: { in: absolutePaths },
    },
    select: { absolutePath: true, notes: true, triggerWords: true, civitaiLink: true },
  });

  const result: Record<string, { notes?: string; triggerWords?: string; civitaiLink?: string }> = {};
  for (const asset of assets) {
    if (!asset.notes && !asset.triggerWords && !asset.civitaiLink) continue;
    const relativePath = relativeAssetPath(baseDir, asset.absolutePath, remote);
    result[relativePath] = {};
    if (asset.notes) result[relativePath].notes = asset.notes;
    if (kind === "lora" && asset.triggerWords) {
      result[relativePath].triggerWords = asset.triggerWords;
    }
    if (asset.civitaiLink) result[relativePath].civitaiLink = asset.civitaiLink;
  }

  return result;
}

export async function updateModelNotes(
  kind: ModelKind,
  input: { path?: string; notes?: string; triggerWords?: string; civitaiLink?: string },
) {
  const target = getActiveComfyTarget();
  const remote = target.mode === "ssh";
  const baseDir = getRequiredModelBaseDir(kind, target);
  const relativePath = input.path ? normalizeRelativePath(input.path) : "";
  const notes = input.notes ?? "";
  const triggerWords = kind === "lora" ? (input.triggerWords ?? "") : null;
  const civitaiLink = normalizeCivitaiLink(input.civitaiLink);

  if (!relativePath.trim()) {
    throw new ModelAssetError("path is required", 400);
  }

  const absolutePath = resolveAssetPath(baseDir, relativePath, remote);
  if (!remote && !isWithinBase(baseDir, absolutePath)) {
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
      civitaiLink,
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
      civitaiLink,
    },
  });

  return { id: asset.id, notes: asset.notes, triggerWords: asset.triggerWords, civitaiLink: asset.civitaiLink };
}

export async function saveUploadedModelFile(kind: ModelKind, file: File, targetDir: string) {
  const target = getActiveComfyTarget();
  const safeName = sanitizeFileName(file.name);
  if (!isAllowedModelFile(kind, safeName)) {
    throw new ModelAssetError(`${MODEL_CONFIG[kind].label} only supports ${[...MODEL_CONFIG[kind].extensions].join(", ")} files.`, 400);
  }

  const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 * 1024; // 10GB for model files
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new ModelAssetError("File too large (max 10GB)", 413);
  }

  if (target.mode === "ssh") {
    let saved: Awaited<ReturnType<typeof uploadRemoteModelFile>>;
    try {
      saved = await uploadRemoteModelFile(target, kind, file, targetDir);
    } catch (error) {
      throw new ModelAssetError("Failed to upload remote model file", 500, String(error));
    }

    const record = await db.loraAsset.upsert({
      where: { absolutePath: saved.absolutePath },
      update: {
        modelType: kind,
        name: saved.name,
        category: saved.category,
        fileName: saved.fileName,
        relativePath: saved.relativePath,
        size: saved.size,
        source: "upload",
      },
      create: {
        modelType: kind,
        name: saved.name,
        category: saved.category,
        fileName: saved.fileName,
        absolutePath: saved.absolutePath,
        relativePath: saved.relativePath,
        size: saved.size,
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

  const baseDir = getRequiredModelBaseDir(kind, target);

  const normalizedDir = normalizeRelativePath(targetDir || "");
  const absoluteTargetDir = path.resolve(baseDir, normalizedDir);
  if (!isWithinBase(baseDir, absoluteTargetDir)) {
    throw new ModelAssetError("Invalid target directory", 400);
  }

  const targetPath = path.join(absoluteTargetDir, safeName);

  await mkdir(absoluteTargetDir, { recursive: true });

  // Stream file to disk to avoid loading entire upload into memory
  const writeStream = createWriteStream(targetPath);
  const uploadStream = file.stream() as unknown as NodeReadableStream<Uint8Array>;
  await pipeline(Readable.fromWeb(uploadStream), writeStream);

  const fileStat = await stat(targetPath);
  const fileSize = fileStat.size;

  const relativePath = path.relative(baseDir, targetPath).replace(/\\/g, "/");
  const record = await db.loraAsset.upsert({
    where: { absolutePath: targetPath },
    update: {
      modelType: kind,
      name: safeName,
      category: normalizedDir || ".",
      fileName: safeName,
      relativePath,
      size: BigInt(fileSize),
      source: "upload",
    },
    create: {
      modelType: kind,
      name: safeName,
      category: normalizedDir || ".",
      fileName: safeName,
      absolutePath: targetPath,
      relativePath,
      size: BigInt(fileSize),
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
  const target = getActiveComfyTarget();
  const { sourcePath, targetDir } = input;

  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    throw new ModelAssetError("sourcePath is required", 400);
  }
  if (typeof targetDir !== "string") {
    throw new ModelAssetError("targetDir is required", 400);
  }

  if (target.mode === "ssh") {
    const normalizedTargetDir = normalizeRemoteRelativePath(targetDir || ".");
    try {
      const moved = await moveRemoteModelFile(target, kind, {
        sourcePath,
        targetDir: normalizedTargetDir,
      });
      const oldAbsolutePath = resolveRemoteModelPath(target.remoteModelsRoot, kind, sourcePath);
      const newAbsolutePath = resolveRemoteModelPath(target.remoteModelsRoot, kind, moved.path);
      await db.loraAsset.updateMany({
        where: { absolutePath: oldAbsolutePath, modelType: kind },
        data: {
          absolutePath: newAbsolutePath,
          relativePath: moved.path,
          category: normalizedTargetDir || ".",
        },
      }).catch(() => {});
      return { newPath: moved.path };
    } catch (error) {
      throw new ModelAssetError("Failed to move remote model file", 500, String(error));
    }
  }

  const baseDir = getRequiredModelBaseDir(kind, target);

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
