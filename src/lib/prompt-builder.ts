/**
 * Prompt Builder
 *
 * Resolves a PositionRun's config into a ComfyUI workflow prompt payload.
 * Currently builds a basic txt2img workflow. Can be extended to support
 * custom workflow templates from disk.
 */

import type { ComfyNode, ComfyPromptPayload } from "./comfyui-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved config extracted from DB for a single PositionRun */
export type ResolvedRunConfig = {
  // Prompts
  characterPrompt: string;
  scenePrompt: string | null;
  stylePrompt: string | null;
  positionPrompt: string;
  positivePromptOverride: string | null;
  negativePrompt: string | null;

  // LoRA
  characterLoraPath: string;

  // Generation params
  aspectRatio: string; // e.g. "3:4"
  batchSize: number;
  seedPolicy: string; // "random" | "fixed"

  // Extra
  extraParams?: Record<string, unknown>;
};

/** Aspect ratio → width/height lookup */
const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 896, height: 1152 },
  "4:3": { width: 1152, height: 896 },
  "9:16": { width: 768, height: 1344 },
  "16:9": { width: 1344, height: 768 },
  "2:3": { width: 832, height: 1216 },
  "3:2": { width: 1216, height: 832 },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a ComfyUI prompt payload from a resolved run config.
 *
 * This generates a basic SDXL txt2img workflow with:
 *   KSampler → VAEDecode → SaveImage
 *   + optional LoRA loader
 *
 * For production use, this should be replaced with a template-based system
 * that loads workflow JSON from config/workflows/*.json.
 */
export function buildPromptPayload(config: ResolvedRunConfig): ComfyPromptPayload {
  const { width, height } = ASPECT_RATIOS[config.aspectRatio] ?? ASPECT_RATIOS["3:4"];

  // Compose the positive prompt from parts
  const positivePromptParts = [
    config.characterPrompt,
    config.positionPrompt,
    config.scenePrompt,
    config.stylePrompt,
    config.positivePromptOverride,
  ].filter(Boolean);
  const positivePrompt = positivePromptParts.join(", ");

  const negativePrompt =
    config.negativePrompt ?? "bad anatomy, extra limbs, blurry, low quality, watermark";

  const seed =
    config.seedPolicy === "fixed"
      ? 42
      : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const prompt: Record<string, ComfyNode> = {};

  // --- Node 1: Checkpoint Loader ---
  prompt["1"] = {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: process.env.COMFYUI_CHECKPOINT ?? "sd_xl_base_1.0.safetensors",
    },
    _meta: { title: "Load Checkpoint" },
  };

  // --- Node 2: LoRA Loader (if character LoRA is provided) ---
  if (config.characterLoraPath) {
    prompt["2"] = {
      class_type: "LoraLoader",
      inputs: {
        lora_name: config.characterLoraPath,
        strength_model: 0.8,
        strength_clip: 0.8,
        model: ["1", 0],
        clip: ["1", 1],
      },
      _meta: { title: "LoRA Loader" },
    };
  }

  const modelSource = config.characterLoraPath ? "2" : "1";
  const clipSource = config.characterLoraPath ? "2" : "1";

  // --- Node 3: CLIP Text Encode (positive) ---
  prompt["3"] = {
    class_type: "CLIPTextEncode",
    inputs: {
      text: positivePrompt,
      clip: [clipSource, config.characterLoraPath ? 1 : 1],
    },
    _meta: { title: "Positive Prompt" },
  };

  // --- Node 4: CLIP Text Encode (negative) ---
  prompt["4"] = {
    class_type: "CLIPTextEncode",
    inputs: {
      text: negativePrompt,
      clip: [clipSource, config.characterLoraPath ? 1 : 1],
    },
    _meta: { title: "Negative Prompt" },
  };

  // --- Node 5: Empty Latent Image ---
  prompt["5"] = {
    class_type: "EmptyLatentImage",
    inputs: {
      width,
      height,
      batch_size: config.batchSize,
    },
    _meta: { title: "Empty Latent" },
  };

  // --- Node 6: KSampler ---
  prompt["6"] = {
    class_type: "KSampler",
    inputs: {
      model: [modelSource, 0],
      positive: ["3", 0],
      negative: ["4", 0],
      latent_image: ["5", 0],
      seed,
      steps: 25,
      cfg: 7.0,
      sampler_name: "euler_ancestral",
      scheduler: "normal",
      denoise: 1.0,
    },
    _meta: { title: "KSampler" },
  };

  // --- Node 7: VAE Decode ---
  prompt["7"] = {
    class_type: "VAEDecode",
    inputs: {
      samples: ["6", 0],
      vae: ["1", 2],
    },
    _meta: { title: "VAE Decode" },
  };

  // --- Node 8: Save Image ---
  prompt["8"] = {
    class_type: "SaveImage",
    inputs: {
      images: ["7", 0],
      filename_prefix: "comfyui-remote",
    },
    _meta: { title: "Save Image" },
  };

  return { prompt };
}
