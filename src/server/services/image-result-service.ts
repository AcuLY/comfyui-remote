import { mkdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { extname, join, posix, resolve } from "node:path";

import sharp from "sharp";

import { env } from "@/lib/env";
import { ComfyPromptOutputImage } from "@/server/services/comfyui-service";
import { WorkerRunSnapshot } from "@/server/worker/types";

export type PersistedRunOutputImage = {
  filePath: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  fileSize: bigint | null;
};

export type PersistedRunOutput = {
  outputDir: string;
  images: PersistedRunOutputImage[];
};

type ManagedRunOutputPaths = {
  absoluteRunDir: string;
  absoluteOutputDir: string;
  absoluteThumbDir: string;
  relativeOutputDir: string;
  relativeThumbDir: string;
};

const THUMBNAIL_MAX_DIMENSION = 400;
const THUMBNAIL_QUALITY = 80;
const THUMBNAIL_EXTENSION = ".jpg";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isEBUSY(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EBUSY" || code === "EPERM";
  }
  return false;
}

/**
 * Retry an operation that may fail with EBUSY on Windows.
 * EBUSY occurs when a file is locked by another process (e.g. the image
 * serving route or a sharp instance). The lock is typically short-lived.
 */
async function retryOnEBUSY<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 200,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isEBUSY(error) || attempt === maxRetries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  // Unreachable, but TypeScript needs it
  throw new Error("retryOnEBUSY: unexpected exit");
}

function sanitizePathSegment(value: string, fallback: string) {
  const sanitizedValue = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitizedValue || fallback;
}

function normalizeSubfolder(subfolder: string) {
  const normalizedSubfolder = subfolder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!normalizedSubfolder) {
    return "";
  }

  const segments = normalizedSubfolder.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`ComfyUI output subfolder is invalid: "${subfolder}"`);
  }

  return segments.join("/");
}

function normalizeApiUrl(apiUrl: string) {
  const normalizedApiUrl = apiUrl.trim().replace(/\/+$/, "");

  if (!normalizedApiUrl) {
    throw new Error("ComfyUI API URL is empty");
  }

  return normalizedApiUrl;
}

function resolveManagedRunOutputPaths(run: WorkerRunSnapshot): ManagedRunOutputPaths {
  const projectSegment = sanitizePathSegment(run.project.slug, run.project.id);
  const sectionSegment = sanitizePathSegment(run.section.slug, run.section.id);
  const runSegment = `run-${String(run.runIndex).padStart(2, "0")}`;
  const absoluteRunDir = resolve(process.cwd(), "data", "images", projectSegment, sectionSegment, runSegment);
  const absoluteOutputDir = join(absoluteRunDir, "raw");
  const absoluteThumbDir = join(absoluteRunDir, "thumb");

  return {
    absoluteRunDir,
    absoluteOutputDir,
    absoluteThumbDir,
    relativeOutputDir: posix.join("data", "images", projectSegment, sectionSegment, runSegment, "raw"),
    relativeThumbDir: posix.join("data", "images", projectSegment, sectionSegment, runSegment, "thumb"),
  };
}

function resolveTargetExtension(outputImage: ComfyPromptOutputImage) {
  const extension = extname(outputImage.filename).toLowerCase();
  return extension && extension.length <= 10 ? extension : ".png";
}

/**
 * Atomic write: write to a temp file first, then rename to the target.
 * Prevents partial reads when the file is being served concurrently
 * by the /api/images/ route.
 * On Windows, rename cannot overwrite an existing file, so we delete first.
 */
async function atomicWriteFile(targetPath: string, data: Buffer) {
  const tempPath = targetPath + ".tmp";
  await writeFile(tempPath, data);

  // On Windows, rename cannot overwrite an existing file.
  // We need to delete the target first, with retry on EBUSY/EPERM.
  try {
    await retryOnEBUSY(() => unlink(targetPath));
  } catch (error) {
    // Ignore ENOENT (file doesn't exist) — that's fine
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Now rename the temp file to target, with retry on EBUSY/EPERM
  await retryOnEBUSY(() => rename(tempPath, targetPath));
}

async function downloadOutputImage(
  apiUrl: string,
  outputImage: ComfyPromptOutputImage,
  targetAbsolutePath: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, env.comfyRequestTimeoutMs);

  try {
    const searchParams = new URLSearchParams({
      filename: outputImage.filename,
      subfolder: normalizeSubfolder(outputImage.subfolder),
      type: outputImage.type,
    });
    const response = await fetch(`${normalizeApiUrl(apiUrl)}/view?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        Accept: "image/*",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `ComfyUI output download failed with ${response.status}: ${responseText || response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await atomicWriteFile(targetAbsolutePath, buffer);

    return BigInt(buffer.byteLength);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`ComfyUI output download timed out after ${env.comfyRequestTimeoutMs}ms`);
    }

    throw new Error(
      `Failed to download ComfyUI output "${outputImage.filename}" via /view: ${formatError(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function persistSingleOutputImage(
  apiUrl: string,
  outputImage: ComfyPromptOutputImage,
  targetAbsolutePath: string,
) {
  // Always download via ComfyUI API — avoids path mismatches between
  // ComfyUI output dir and our managed image store.
  return downloadOutputImage(apiUrl, outputImage, targetAbsolutePath);
}

async function createThumbnailAndReadDimensions(
  sourceAbsolutePath: string,
  targetThumbAbsolutePath: string,
) {
  // Read source file into memory first to avoid holding a file handle
  // (prevents EBUSY on Windows when the file is deleted later)
  const { readFile } = await import("node:fs/promises");
  const sourceBuffer = await readFile(sourceAbsolutePath);

  const sourceImage = sharp(sourceBuffer);
  const metadata = await sourceImage.metadata();

  const thumbBuffer = await sourceImage
    .clone()
    .rotate()
    .resize({
      width: THUMBNAIL_MAX_DIMENSION,
      height: THUMBNAIL_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: THUMBNAIL_QUALITY,
    })
    .toBuffer();

  // Write thumbnail atomically
  await atomicWriteFile(targetThumbAbsolutePath, thumbBuffer);

  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

/**
 * Clean up leftover files in a directory that are not in the keep set.
 * Used after writing new images to remove stale files from a previous run.
 * NOTE: .tmp files are preserved to avoid conflicts with concurrent atomic writes.
 */
async function cleanupStaleFiles(dirPath: string, keepFiles: Set<string>) {
  const { readdir } = await import("node:fs/promises");
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return; // Directory doesn't exist, nothing to clean
  }

  for (const entry of entries) {
    // Skip .tmp files - they may be part of an in-progress atomic write
    if (entry.endsWith(".tmp")) {
      continue;
    }
    if (!keepFiles.has(entry)) {
      const entryPath = join(dirPath, entry);
      await retryOnEBUSY(() => unlink(entryPath)).catch(() => {
        // Best-effort — don't block the main flow
      });
    }
  }
}

export async function removeManagedRunOutput(run: WorkerRunSnapshot) {
  const { absoluteRunDir } = resolveManagedRunOutputPaths(run);
  await retryOnEBUSY(() => rm(absoluteRunDir, { recursive: true, force: true }));
}

export async function persistComfyOutputImages(
  run: WorkerRunSnapshot,
  apiUrl: string,
  outputImages: ComfyPromptOutputImage[],
): Promise<PersistedRunOutput> {
  if (outputImages.length === 0) {
    throw new Error("ComfyUI history did not include any output images");
  }

  const {
    absoluteRunDir,
    absoluteOutputDir,
    absoluteThumbDir,
    relativeOutputDir,
    relativeThumbDir,
  } = resolveManagedRunOutputPaths(run);

  // Ensure directories exist (don't delete first — avoids EBUSY on Windows)
  await mkdir(absoluteOutputDir, { recursive: true });
  await mkdir(absoluteThumbDir, { recursive: true });

  const persistedImages: PersistedRunOutputImage[] = [];
  const writtenRawFiles = new Set<string>();
  const writtenThumbFiles = new Set<string>();

  try {
    for (const [index, outputImage] of outputImages.entries()) {
      const fileName = `${String(index + 1).padStart(2, "0")}${resolveTargetExtension(outputImage)}`;
      const thumbFileName = `${String(index + 1).padStart(2, "0")}${THUMBNAIL_EXTENSION}`;
      const relativeFilePath = posix.join(relativeOutputDir, fileName);
      const relativeThumbPath = posix.join(relativeThumbDir, thumbFileName);
      const absoluteFilePath = join(absoluteOutputDir, fileName);
      const absoluteThumbPath = join(absoluteThumbDir, thumbFileName);

      const fileSize = await persistSingleOutputImage(apiUrl, outputImage, absoluteFilePath);
      writtenRawFiles.add(fileName);

      const { width, height } = await createThumbnailAndReadDimensions(
        absoluteFilePath,
        absoluteThumbPath,
      );
      writtenThumbFiles.add(thumbFileName);

      persistedImages.push({
        filePath: relativeFilePath,
        thumbPath: relativeThumbPath,
        width,
        height,
        fileSize,
      });
    }

    // Clean up stale files from a previous attempt (e.g. if this is a re-run
    // or recovery and the old run produced more images)
    await cleanupStaleFiles(absoluteOutputDir, writtenRawFiles);
    await cleanupStaleFiles(absoluteThumbDir, writtenThumbFiles);

    return {
      outputDir: relativeOutputDir,
      images: persistedImages,
    };
  } catch (error) {
    // On failure, attempt to clean up. Use retryOnEBUSY since the
    // files might still be held by sharp or the image serving route.
    await retryOnEBUSY(() => rm(absoluteRunDir, { recursive: true, force: true })).catch(() => {
      // Best-effort cleanup — don't mask the original error
    });
    throw error;
  }
}
