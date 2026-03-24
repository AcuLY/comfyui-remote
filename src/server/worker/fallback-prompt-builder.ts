/**
 * Fallback Prompt Builder
 *
 * Generates a basic SDXL txt2img ComfyUI API prompt graph when no custom
 * workflow is provided via extraParams. This allows the worker to function
 * out-of-the-box without requiring a pre-configured ComfyUI workflow JSON.
 *
 * Node graph:
 *   CheckpointLoaderSimple → [optional LoraLoader] → CLIPTextEncode (pos/neg)
 *   → EmptyLatentImage → KSampler → VAEDecode → SaveImage
 */

import { ComfyPromptDraft } from "@/server/worker/types";

type JsonRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Aspect ratio → SDXL-optimal resolution lookup
// ---------------------------------------------------------------------------

const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 896, height: 1152 },
  "4:3": { width: 1152, height: 896 },
  "9:16": { width: 768, height: 1344 },
  "16:9": { width: 1344, height: 768 },
  "2:3": { width: 832, height: 1216 },
  "3:2": { width: 1216, height: 832 },
};

const DEFAULT_CHECKPOINT =
  process.env.COMFYUI_CHECKPOINT ?? "sd_xl_base_1.0.safetensors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLoraPath(draft: ComfyPromptDraft): string | null {
  // 1. Check loraConfig for a character LoRA path
  const loraConfig = draft.loraConfig as JsonRecord | null;

  if (loraConfig) {
    const characterLora =
      typeof loraConfig.characterLoraPath === "string"
        ? loraConfig.characterLoraPath.trim()
        : null;

    if (characterLora) {
      return characterLora;
    }
  }

  return null;
}

function resolveSeed(draft: ComfyPromptDraft): number {
  const seedPolicy = draft.parameters.seedPolicy ?? "random";

  return seedPolicy === "fixed"
    ? 42
    : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a fallback ComfyUI API prompt graph from a ComfyPromptDraft.
 *
 * Returns a Record<string, unknown> that can be submitted directly as the
 * `prompt` field to ComfyUI `/prompt`.
 */
export function buildFallbackPromptNodes(draft: ComfyPromptDraft): JsonRecord {
  const aspectRatio = draft.parameters.aspectRatio ?? "3:4";
  const { width, height } = ASPECT_RATIOS[aspectRatio] ?? ASPECT_RATIOS["3:4"];
  const batchSize = draft.parameters.batchSize ?? 1;

  const positivePrompt = draft.prompt.positive;
  const negativePrompt =
    draft.prompt.negative ??
    "bad anatomy, extra limbs, blurry, low quality, watermark";

  const seed = resolveSeed(draft);
  const loraPath = resolveLoraPath(draft);

  const nodes: JsonRecord = {};

  // Node 1: Checkpoint Loader
  nodes["1"] = {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: DEFAULT_CHECKPOINT,
    },
    _meta: { title: "Load Checkpoint" },
  };

  // Node 2: LoRA Loader (optional)
  if (loraPath) {
    nodes["2"] = {
      class_type: "LoraLoader",
      inputs: {
        lora_name: loraPath,
        strength_model: 0.8,
        strength_clip: 0.8,
        model: ["1", 0],
        clip: ["1", 1],
      },
      _meta: { title: "LoRA Loader" },
    };
  }

  const modelSource = loraPath ? "2" : "1";
  const clipSource = loraPath ? "2" : "1";

  // Node 3: Positive prompt
  nodes["3"] = {
    class_type: "CLIPTextEncode",
    inputs: {
      text: positivePrompt,
      clip: [clipSource, 1],
    },
    _meta: { title: "Positive Prompt" },
  };

  // Node 4: Negative prompt
  nodes["4"] = {
    class_type: "CLIPTextEncode",
    inputs: {
      text: negativePrompt,
      clip: [clipSource, 1],
    },
    _meta: { title: "Negative Prompt" },
  };

  // Node 5: Empty Latent Image
  nodes["5"] = {
    class_type: "EmptyLatentImage",
    inputs: {
      width,
      height,
      batch_size: batchSize,
    },
    _meta: { title: "Empty Latent" },
  };

  // Node 6: KSampler
  nodes["6"] = {
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

  // Node 7: VAE Decode
  nodes["7"] = {
    class_type: "VAEDecode",
    inputs: {
      samples: ["6", 0],
      vae: ["1", 2],
    },
    _meta: { title: "VAE Decode" },
  };

  // Node 8: Save Image
  nodes["8"] = {
    class_type: "SaveImage",
    inputs: {
      images: ["7", 0],
      filename_prefix: "comfyui-remote",
    },
    _meta: { title: "Save Image" },
  };

  return nodes;
}
