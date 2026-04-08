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
import { resolveResolution } from "@/lib/aspect-ratio-utils";

type JsonRecord = Record<string, unknown>;

const DEFAULT_CHECKPOINT =
  process.env.COMFYUI_CHECKPOINT ?? "sd_xl_base_1.0.safetensors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSeed(draft: ComfyPromptDraft): number {
  const seedPolicy = draft.parameters.seedPolicy ?? "random";

  return seedPolicy === "fixed"
    ? 42
    : Math.floor(Math.random() * 4294967295);
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
  const { width, height } = resolveResolution(
    draft.parameters.aspectRatio,
    draft.parameters.shortSidePx,
  );
  const batchSize = draft.parameters.batchSize ?? 1;

  const positivePrompt = draft.prompt.positive;
  const negativePrompt =
    draft.prompt.negative ?? "";

  const seed = resolveSeed(draft);

  const nodes: JsonRecord = {};

  // Node 1: Checkpoint Loader
  nodes["1"] = {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: DEFAULT_CHECKPOINT,
    },
    _meta: { title: "Load Checkpoint" },
  };

  // Node 3: Positive prompt
  nodes["3"] = {
    class_type: "CLIPTextEncode",
    inputs: {
      text: positivePrompt,
      clip: ["1", 1],
    },
    _meta: { title: "Positive Prompt" },
  };

  // Node 4: Negative prompt
  nodes["4"] = {
    class_type: "CLIPTextEncode",
    inputs: {
      text: negativePrompt,
      clip: ["1", 1],
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
      model: ["1", 0],
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
