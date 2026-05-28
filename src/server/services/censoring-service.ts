import { readFile, mkdir, writeFile, rename, unlink, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import {
  pollComfyPromptHistory,
  extractOutputImages,
  type ComfyPromptOutputImage,
} from "@/server/services/comfyui-service";

const log = createLogger({ module: "censoring" });

// --- Constants ---
const MOSAIC_LORA_PATH = "nsfw/illustrious_mosaic_censor_v2.safetensors";
const MOSAIC_LORA_WEIGHT = 1.2;
const THUMBNAIL_WIDTH = 300;

// --- Types ---

type ImageResultForCensor = {
  id: string;
  filePath: string;
  reviewStatus: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Upload a latent file buffer to ComfyUI's /upload/image endpoint.
 */
async function uploadLatentToComfyUI(
  apiUrl: string,
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([buffer as unknown as BlobPart]);
  formData.append("image", blob, filename);
  formData.append("overwrite", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.comfyRequestTimeoutMs);

  try {
    const response = await fetch(`${apiUrl}/upload/image`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ComfyUI upload failed (${response.status}): ${text}`);
    }

    const json = (await response.json()) as { name?: string };
    if (!json.name) {
      throw new Error("ComfyUI upload response missing 'name' field");
    }

    return json.name;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Derive batch index from file path.
 * e.g. "data/images/.../raw/01.jpg" → 0 (1-indexed filename to 0-indexed batch)
 */
function deriveBatchIndex(filePath: string): number {
  const match = filePath.match(/(\d+)\.\w+$/);
  if (!match) {
    throw new Error(`Cannot derive batch index from filePath: ${filePath}`);
  }
  return parseInt(match[1], 10) - 1;
}

/**
 * Build the ComfyUI API prompt JSON for the latent-based mosaic censoring workflow.
 */
function buildLatentCensorWorkflow(params: {
  latentFilename: string;
  batchIndex: number;
  checkpointName: string;
  lora2List: Array<{ path: string; weight: number; enabled: boolean }>;
  positivePrompt: string;
  negativePrompt: string;
  ks2Seed: number;
  ks2Steps: number;
  ks2Cfg: number;
  ks2Sampler: string;
  ks2Scheduler: string;
  ks2Denoise: number;
  outputPrefix: string;
}): Record<string, unknown> {
  // Build lora inputs for Power Lora Loader (rgthree)
  const loraInputs: Record<string, unknown> = {
    model: ["1", 0],
    clip: ["1", 1],
  };

  for (let i = 0; i < params.lora2List.length; i++) {
    const lora = params.lora2List[i];
    loraInputs[`lora_${i + 1}`] = {
      on: true,
      lora: lora.path.replace(/\\/g, "/"),
      strength: lora.weight,
    };
  }

  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: params.checkpointName },
    },
    "36": {
      class_type: "Power Lora Loader (rgthree)",
      inputs: loraInputs,
    },
    "511": {
      class_type: "Text Multiline",
      inputs: { text: params.positivePrompt },
    },
    "513": {
      class_type: "Text Multiline",
      inputs: { text: params.negativePrompt },
    },
    "519": {
      class_type: "CLIPTextEncode",
      inputs: { text: ["511", 0], clip: ["36", 1] },
    },
    "520": {
      class_type: "CLIPTextEncode",
      inputs: { text: ["513", 0], clip: ["36", 1] },
    },
    "900": {
      class_type: "LoadLatent",
      inputs: { latent: params.latentFilename },
    },
    "901": {
      class_type: "LatentFromBatch",
      inputs: { samples: ["900", 0], batch_index: params.batchIndex, length: 1 },
    },
    "427": {
      class_type: "KSampler",
      inputs: {
        model: ["36", 0],
        positive: ["519", 0],
        negative: ["520", 0],
        latent_image: ["901", 0],
        seed: params.ks2Seed,
        steps: params.ks2Steps,
        cfg: params.ks2Cfg,
        sampler_name: params.ks2Sampler,
        scheduler: params.ks2Scheduler,
        denoise: params.ks2Denoise,
      },
    },
    "410": {
      class_type: "VAEDecode",
      inputs: { samples: ["427", 0], vae: ["1", 2] },
    },
    "10": {
      class_type: "SaveImage",
      inputs: { images: ["410", 0], filename_prefix: params.outputPrefix },
    },
  };
}

/**
 * Download the censored output image from ComfyUI's /view endpoint.
 */
async function downloadCensoredImage(
  apiUrl: string,
  outputImage: ComfyPromptOutputImage,
): Promise<Buffer> {
  const url = `${apiUrl}/view?filename=${encodeURIComponent(outputImage.filename)}&subfolder=${encodeURIComponent(outputImage.subfolder)}&type=${encodeURIComponent(outputImage.type)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.comfyRequestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        `ComfyUI download failed (${response.status}) for ${outputImage.filename}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Write buffer to file atomically.
 */
async function atomicWriteFile(targetPath: string, data: Buffer): Promise<void> {
  const tempPath = `${targetPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, data);

  try {
    await unlink(targetPath);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }

  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Phase 1: Submit — upload latent + submit prompt (fast, ~1s)
// ---------------------------------------------------------------------------

/**
 * Upload the source latent to ComfyUI and submit the censoring prompt.
 * Returns the promptId and image info for the polling phase.
 */
export async function submitCensorPrompt(imageResultId: string): Promise<{
  promptId: string;
  imageResult: ImageResultForCensor;
}> {
  const imageResult = await prisma.imageResult.findUnique({
    where: { id: imageResultId },
    select: {
      id: true,
      filePath: true,
      reviewStatus: true,
      run: {
        select: {
          latentFilePath: true,
          executionMeta: true,
        },
      },
    },
  });

  if (!imageResult) {
    throw new Error(`ImageResult not found: ${imageResultId}`);
  }

  if (imageResult.reviewStatus !== "kept" && imageResult.reviewStatus !== "pending") {
    throw new Error(
      `ImageResult ${imageResultId} has status "${imageResult.reviewStatus}", expected "kept" or "pending"`,
    );
  }

  if (!imageResult.run?.latentFilePath) {
    throw new Error("此图片不支持打码（无潜空间文件）");
  }

  // Read latent file from disk
  const latentAbsPath = resolve(process.cwd(), imageResult.run.latentFilePath);
  let latentBuffer: Buffer;
  try {
    await access(latentAbsPath);
    latentBuffer = await readFile(latentAbsPath);
  } catch {
    throw new Error("潜空间文件丢失");
  }

  // Derive batch index from imageResult.filePath
  const batchIndex = deriveBatchIndex(imageResult.filePath);

  // Upload latent to ComfyUI
  const apiUrl = env.comfyApiUrl.replace(/\/$/, "");
  const latentUploadFilename = `censor_${randomUUID().slice(0, 8)}.latent`;
  const comfyLatentFilename = await uploadLatentToComfyUI(apiUrl, latentBuffer, latentUploadFilename);

  // Parse executionMeta
  const meta = imageResult.run.executionMeta as Record<string, unknown>;
  const checkpointName = meta.checkpointName as string;
  const lora2 = (meta.lora2 as Array<{ path: string; weight: number; enabled: boolean }>) ?? [];
  const positivePrompt = meta.positivePrompt as string;
  const negativePrompt = meta.negativePrompt as string;
  const ks2Seed = meta.ks2Seed as number;
  const ks2Steps = meta.ks2Steps as number;
  const ks2Cfg = meta.ks2Cfg as number;
  const ks2Sampler = meta.ks2Sampler as string;
  const ks2Scheduler = meta.ks2Scheduler as string;
  const ks2Denoise = meta.ks2Denoise as number;

  // Build lora2 list: original + mosaic LoRA appended
  const lora2List = [
    ...lora2.filter((l) => l.enabled),
    { path: MOSAIC_LORA_PATH, weight: MOSAIC_LORA_WEIGHT, enabled: true },
  ];

  // Build workflow
  const outputPrefix = `censored_${randomUUID().slice(0, 8)}`;
  const workflow = buildLatentCensorWorkflow({
    latentFilename: comfyLatentFilename,
    batchIndex,
    checkpointName,
    lora2List,
    positivePrompt,
    negativePrompt,
    ks2Seed,
    ks2Steps,
    ks2Cfg,
    ks2Sampler,
    ks2Scheduler,
    ks2Denoise,
    outputPrefix,
  });

  // Submit to ComfyUI
  const controller = new AbortController();
  const submitTimeout = setTimeout(() => controller.abort(), env.comfyRequestTimeoutMs);

  let promptId: string;
  try {
    const submitResponse = await fetch(`${apiUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
      signal: controller.signal,
    });

    if (!submitResponse.ok) {
      const text = await submitResponse.text().catch(() => "");
      throw new Error(`ComfyUI prompt submission failed (${submitResponse.status}): ${text}`);
    }

    const submitJson = (await submitResponse.json()) as { prompt_id?: string };
    if (!submitJson.prompt_id) {
      throw new Error("ComfyUI prompt response missing 'prompt_id'");
    }
    promptId = submitJson.prompt_id;
  } finally {
    clearTimeout(submitTimeout);
  }

  log.info("Submitted censoring prompt (latent-based)", { imageResultId, promptId });

  return {
    promptId,
    imageResult: { id: imageResult.id, filePath: imageResult.filePath, reviewStatus: imageResult.reviewStatus },
  };
}

// ---------------------------------------------------------------------------
// Phase 2: Poll + download + save (slow, runs in background per task)
// ---------------------------------------------------------------------------

/**
 * Poll ComfyUI for prompt completion, download result, compress, and save.
 */
export async function pollCensorCompletion(
  promptId: string,
  imageResult: ImageResultForCensor,
): Promise<void> {
  const apiUrl = env.comfyApiUrl.replace(/\/$/, "");

  // Poll for completion
  const historyEntry = await pollComfyPromptHistory(apiUrl, promptId);

  // Extract output images
  const outputImages = extractOutputImages(historyEntry);
  if (outputImages.length === 0) {
    throw new Error(`Censoring produced no output images for ${imageResult.id}`);
  }

  // Download the first output image
  const rawOutputBuffer = await downloadCensoredImage(apiUrl, outputImages[0]);
  log.info("Downloaded censored image", {
    imageResultId: imageResult.id,
    size: rawOutputBuffer.length,
  });

  // Process with sharp
  const { data: jpegBuffer } = await sharp(rawOutputBuffer)
    .rotate()
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  // Determine censored file paths
  const censoredFilePath = imageResult.filePath.replace("/raw/", "/censored/");
  const censoredThumbPath = imageResult.filePath.replace("/raw/", "/censored-thumb/");

  // Write censored full image
  const censoredAbsPath = resolve(process.cwd(), censoredFilePath);
  await mkdir(dirname(censoredAbsPath), { recursive: true });
  await atomicWriteFile(censoredAbsPath, jpegBuffer);

  // Generate and write thumbnail
  const thumbBuffer = await sharp(jpegBuffer)
    .resize({ width: THUMBNAIL_WIDTH })
    .jpeg({ quality: 80 })
    .toBuffer();

  const censoredThumbAbsPath = resolve(process.cwd(), censoredThumbPath);
  await mkdir(dirname(censoredThumbAbsPath), { recursive: true });
  await atomicWriteFile(censoredThumbAbsPath, thumbBuffer);

  // Update the database record
  await prisma.imageResult.update({
    where: { id: imageResult.id },
    data: {
      censoredFilePath,
      censoredThumbPath,
      censoredAt: new Date(),
    },
  });

  log.info("Censoring complete", { imageResultId: imageResult.id, censoredFilePath });
}

// ---------------------------------------------------------------------------
// Legacy single-image function (kept for backwards compat)
// ---------------------------------------------------------------------------

/**
 * Run the full censoring pipeline synchronously for a single image.
 * Used by the single-image censor button in the lightbox.
 */
export async function censorSingleImage(imageResultId: string): Promise<void> {
  const { promptId, imageResult } = await submitCensorPrompt(imageResultId);
  await pollCensorCompletion(promptId, imageResult);
}
