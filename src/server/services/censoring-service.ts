import { readFile, mkdir, writeFile, rename, unlink } from "node:fs/promises";
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

// --- Hard-coded workflow parameters ---
const CENSOR_CHECKPOINT = "waiIllustriousSDXL_v170.safetensors";
const CENSOR_LORA = "nsfw\\illustrious_mosaic_censor_v2.safetensors";
const CENSOR_LORA_STRENGTH_MODEL = 1.95;
const CENSOR_LORA_STRENGTH_CLIP = 2.08;
const CENSOR_DENOISE = 0.45;
const CENSOR_STEPS = 10;
const CENSOR_CFG = 5;
const CENSOR_SAMPLER = "dpm_adaptive";
const CENSOR_SCHEDULER = "normal";

const THUMBNAIL_WIDTH = 300;

// --- Types ---

type ImageResultForCensor = {
  id: string;
  filePath: string;
  reviewStatus: string;
};

/**
 * Upload an image buffer to ComfyUI's /upload/image endpoint.
 */
async function uploadImageToComfyUI(
  apiUrl: string,
  imageBuffer: Buffer,
  filename: string,
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([imageBuffer as unknown as BlobPart]);
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
 * Build the ComfyUI API prompt JSON for the mosaic censoring workflow.
 */
function buildCensorApiPrompt(
  inputFilename: string,
  outputPrefix: string,
): Record<string, unknown> {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: CENSOR_CHECKPOINT },
    },
    "2": {
      class_type: "LoraLoader",
      inputs: {
        model: ["1", 0],
        clip: ["1", 1],
        lora_name: CENSOR_LORA,
        strength_model: CENSOR_LORA_STRENGTH_MODEL,
        strength_clip: CENSOR_LORA_STRENGTH_CLIP,
      },
    },
    "3": {
      class_type: "LoadImage",
      inputs: { image: inputFilename },
    },
    "4": {
      class_type: "VAEEncode",
      inputs: { pixels: ["3", 0], vae: ["1", 2] },
    },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["2", 1], text: "" },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["2", 1], text: "" },
    },
    "7": {
      class_type: "KSampler",
      inputs: {
        model: ["2", 0],
        positive: ["5", 0],
        negative: ["6", 0],
        latent_image: ["4", 0],
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: CENSOR_STEPS,
        cfg: CENSOR_CFG,
        sampler_name: CENSOR_SAMPLER,
        scheduler: CENSOR_SCHEDULER,
        denoise: CENSOR_DENOISE,
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["7", 0], vae: ["1", 2] },
    },
    "10": {
      class_type: "SaveImage",
      inputs: { images: ["8", 0], filename_prefix: outputPrefix },
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
// Phase 1: Submit — upload image + submit prompt (fast, ~1s)
// ---------------------------------------------------------------------------

/**
 * Upload the source image to ComfyUI and submit the censoring prompt.
 * Returns the promptId and image info for the polling phase.
 */
export async function submitCensorPrompt(imageResultId: string): Promise<{
  promptId: string;
  imageResult: ImageResultForCensor;
}> {
  const imageResult = await prisma.imageResult.findUnique({
    where: { id: imageResultId },
    select: { id: true, filePath: true, reviewStatus: true },
  });

  if (!imageResult) {
    throw new Error(`ImageResult not found: ${imageResultId}`);
  }

  if (imageResult.reviewStatus !== "kept") {
    throw new Error(
      `ImageResult ${imageResultId} has status "${imageResult.reviewStatus}", expected "kept"`,
    );
  }

  const apiUrl = env.comfyApiUrl.replace(/\/$/, "");

  // Read source image
  const absolutePath = resolve(process.cwd(), imageResult.filePath);
  const sourceBuffer = await readFile(absolutePath);

  // Upload to ComfyUI
  const uploadFilename = `censor_input_${randomUUID().slice(0, 8)}_${imageResult.filePath.split("/").pop() ?? "image.jpg"}`;
  const comfyFilename = await uploadImageToComfyUI(apiUrl, sourceBuffer, uploadFilename);

  // Build and submit prompt
  const outputPrefix = `censored_${randomUUID().slice(0, 8)}`;
  const apiPrompt = buildCensorApiPrompt(comfyFilename, outputPrefix);

  const controller = new AbortController();
  const submitTimeout = setTimeout(() => controller.abort(), env.comfyRequestTimeoutMs);

  let promptId: string;
  try {
    const submitResponse = await fetch(`${apiUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: apiPrompt }),
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

  log.info("Submitted censoring prompt", { imageResultId, promptId });

  return { promptId, imageResult };
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
// Legacy single-image function (kept for direct single-image censoring)
// ---------------------------------------------------------------------------

/**
 * Run the full censoring pipeline synchronously for a single image.
 * Used by the single-image censor button in the lightbox.
 */
export async function censorSingleImage(imageResultId: string): Promise<void> {
  const { promptId, imageResult } = await submitCensorPrompt(imageResultId);
  await pollCensorCompletion(promptId, imageResult);
}
