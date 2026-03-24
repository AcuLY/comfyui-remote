import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
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
  const jobSegment = sanitizePathSegment(run.job.slug, run.job.id);
  const positionSegment = sanitizePathSegment(run.position.slug, run.position.id);
  const runSegment = `run-${String(run.runIndex).padStart(2, "0")}`;
  const absoluteRunDir = resolve(process.cwd(), "data", "images", jobSegment, positionSegment, runSegment);
  const absoluteOutputDir = join(absoluteRunDir, "raw");
  const absoluteThumbDir = join(absoluteRunDir, "thumb");

  return {
    absoluteRunDir,
    absoluteOutputDir,
    absoluteThumbDir,
    relativeOutputDir: posix.join("data", "images", jobSegment, positionSegment, runSegment, "raw"),
    relativeThumbDir: posix.join("data", "images", jobSegment, positionSegment, runSegment, "thumb"),
  };
}

function resolveTargetExtension(outputImage: ComfyPromptOutputImage) {
  const extension = extname(outputImage.filename).toLowerCase();
  return extension && extension.length <= 10 ? extension : ".png";
}

async function tryCopyLocalOutputImage(
  outputImage: ComfyPromptOutputImage,
  targetAbsolutePath: string,
) {
  const imageBaseDir = env.imageBaseDir.trim();

  if (!imageBaseDir) {
    return null;
  }

  const normalizedSubfolder = normalizeSubfolder(outputImage.subfolder);
  const sourceAbsolutePath = normalizedSubfolder
    ? resolve(imageBaseDir, normalizedSubfolder, outputImage.filename)
    : resolve(imageBaseDir, outputImage.filename);

  try {
    await copyFile(sourceAbsolutePath, targetAbsolutePath);
    const fileStats = await stat(targetAbsolutePath);
    return BigInt(fileStats.size);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return null;
    }

    throw new Error(
      `Failed to copy ComfyUI output "${outputImage.filename}" from "${sourceAbsolutePath}": ${formatError(error)}`,
    );
  }
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

    await writeFile(targetAbsolutePath, buffer);

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
  const localFileSize = await tryCopyLocalOutputImage(outputImage, targetAbsolutePath);

  if (localFileSize !== null) {
    return localFileSize;
  }

  return downloadOutputImage(apiUrl, outputImage, targetAbsolutePath);
}

async function createThumbnailAndReadDimensions(
  sourceAbsolutePath: string,
  targetThumbAbsolutePath: string,
) {
  const sourceImage = sharp(sourceAbsolutePath);
  const metadata = await sourceImage.metadata();

  await sourceImage
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
    .toFile(targetThumbAbsolutePath);

  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

export async function removeManagedRunOutput(run: WorkerRunSnapshot) {
  const { absoluteRunDir } = resolveManagedRunOutputPaths(run);
  await rm(absoluteRunDir, { recursive: true, force: true });
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

  await rm(absoluteRunDir, { recursive: true, force: true });
  await mkdir(absoluteOutputDir, { recursive: true });
  await mkdir(absoluteThumbDir, { recursive: true });

  try {
    const persistedImages: PersistedRunOutputImage[] = [];

    for (const [index, outputImage] of outputImages.entries()) {
      const fileName = `${String(index + 1).padStart(2, "0")}${resolveTargetExtension(outputImage)}`;
      const thumbFileName = `${String(index + 1).padStart(2, "0")}${THUMBNAIL_EXTENSION}`;
      const relativeFilePath = posix.join(relativeOutputDir, fileName);
      const relativeThumbPath = posix.join(relativeThumbDir, thumbFileName);
      const absoluteFilePath = join(absoluteOutputDir, fileName);
      const absoluteThumbPath = join(absoluteThumbDir, thumbFileName);
      const fileSize = await persistSingleOutputImage(apiUrl, outputImage, absoluteFilePath);
      const { width, height } = await createThumbnailAndReadDimensions(
        absoluteFilePath,
        absoluteThumbPath,
      );

      persistedImages.push({
        filePath: relativeFilePath,
        thumbPath: relativeThumbPath,
        width,
        height,
        fileSize,
      });
    }

    return {
      outputDir: relativeOutputDir,
      images: persistedImages,
    };
  } catch (error) {
    await rm(absoluteRunDir, { recursive: true, force: true });
    throw error;
  }
}
