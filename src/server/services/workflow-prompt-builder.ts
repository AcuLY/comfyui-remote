/**
 * Workflow Prompt Builder (v0.5)
 *
 * Fills the standard `docs/workflow.api.json` template with per-section
 * parameters (prompts, dimensions, LoRAs, KSampler settings, output path)
 * and returns a ready-to-submit ComfyUI API prompt graph.
 *
 * Node mapping (from workflow.api.json):
 *
 *   1    Checkpoint Loader
 *   511  positive prompt (Text Multiline)
 *   513  negative prompt (Text Multiline)
 *   407  Empty Latent Image (width, height, batch_size)
 *   522  lora 1 — Power Lora Loader (checkpoint → 522 → KS1)
 *   36   lora 2 — Power Lora Loader (checkpoint → 36 → KS2)
 *   3    KSampler1 (model from 522)
 *   425  Upscale Latent (width, height)
 *   427  KSampler2 (model from 36)
 *   410  VAE Decode
 *   515  Image Save (output_path)
 */

import type { LoraBinding, KSamplerParams } from "@/lib/lora-types";
import { DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2 } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WorkflowBuildInput = {
  /** Deep-cloned workflow.api.json content (caller must deep-clone before passing) */
  workflowTemplate: Record<string, unknown>;
  positivePrompt: string;
  negativePrompt: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  batchSize: number;
  /** Upscale factor for LatentUpscale (default 2) */
  upscaleFactor?: number;
  /** LoRA 1 list (fills node 522 → KS1) */
  lora1List: LoraBinding[];
  /** LoRA 2 list (fills node 36 → KS2) */
  lora2List: LoraBinding[];
  ksampler1: KSamplerParams;
  ksampler2: KSamplerParams;
  /** e.g. "MyProject/1.close_up_shot" */
  outputPath: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JsonRecord = Record<string, unknown>;

/** Safely get a node's inputs object, creating it if missing. */
function nodeInputs(template: JsonRecord, nodeId: string): JsonRecord {
  let node = template[nodeId] as JsonRecord | undefined;
  if (!node) {
    node = { inputs: {} };
    template[nodeId] = node;
  }
  let inputs = node.inputs as JsonRecord | undefined;
  if (!inputs) {
    inputs = {};
    node.inputs = inputs;
  }
  return inputs;
}

/**
 * Build Power Lora Loader entries from a LoraBinding list.
 *
 * Returns key-value pairs like:
 *   lora_1: { on: true, lora: "category\\file.safetensors", strength: 0.8 }
 *   lora_2: { ... }
 *
 * Existing lora_N keys in the target inputs are cleared first.
 */
function fillPowerLoraLoader(
  inputs: JsonRecord,
  bindings: LoraBinding[],
): void {
  const enabledBindings = bindings.filter((b) => b.enabled);

  // Only clear and replace existing lora_N entries when we have new bindings.
  // If the list is empty, keep template defaults untouched.
  if (enabledBindings.length === 0) {
    return;
  }

  // Remove all existing lora_N entries
  for (const key of Object.keys(inputs)) {
    if (/^lora_\d+$/.test(key)) {
      delete inputs[key];
    }
  }

  // Fill with new bindings
  for (let i = 0; i < enabledBindings.length; i++) {
    const b = enabledBindings[i];
    inputs[`lora_${i + 1}`] = {
      on: true,
      lora: b.path.replace(/\\/g, "/"),
      strength: b.weight,
    };
  }
}

/** Resolve seed from KSamplerParams and optional run context. */
function resolveSeed(params: KSamplerParams): number {
  const policy = params.seedPolicy ?? "random";
  // ComfyUI seeds must fit within a safe integer range.
  // Use 2^32 - 1 (4294967295) as upper bound for maximum compatibility.
  const MAX_SEED = 4294967295;
  switch (policy) {
    case "fixed":
      return 42;
    case "increment":
      return Math.floor(Math.random() * MAX_SEED);
    case "random":
    default:
      return Math.floor(Math.random() * MAX_SEED);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fill the workflow template with section-specific parameters.
 *
 * The caller must provide a deep-cloned `workflowTemplate` — this function
 * mutates it in-place and returns it.
 */
export function buildWorkflowPrompt(input: WorkflowBuildInput): Record<string, unknown> {
  const wf = input.workflowTemplate;
  const upscale = input.upscaleFactor ?? 2;
  const skipHiresFix = upscale === 1;

  // 1. Prompts — nodes 511, 513
  nodeInputs(wf, "511").text = input.positivePrompt;
  nodeInputs(wf, "513").text = input.negativePrompt;

  // 2. Image dimensions — node 407 (Empty Latent Image)
  const latent = nodeInputs(wf, "407");
  latent.width = input.width;
  latent.height = input.height;
  latent.batch_size = input.batchSize;

  if (skipHiresFix) {
    // 1x: bypass hires fix — remove Upscale Latent (425), KSampler2 (427),
    // and KS2 LoRA node (36). Rewire VAEDecode (410) to read from KS1 (3).
    delete (wf as Record<string, unknown>)["425"];
    delete (wf as Record<string, unknown>)["427"];
    delete (wf as Record<string, unknown>)["36"];
    nodeInputs(wf, "410").samples = ["3", 0];
  } else {
    // 3. Upscale dimensions — node 425 (Upscale Latent)
    // Round to nearest multiple of 8 for latent alignment
    const upscaleInputs = nodeInputs(wf, "425");
    upscaleInputs.width = Math.round((input.width * upscale) / 8) * 8;
    upscaleInputs.height = Math.round((input.height * upscale) / 8) * 8;
  }

  // 4. LoRA 1 — node 522 (checkpoint → 522 → KS1)
  fillPowerLoraLoader(nodeInputs(wf, "522"), input.lora1List);

  // 5. LoRA 2 — node 36 (checkpoint → 36 → KS2, only when hires fix active)
  if (!skipHiresFix) {
    fillPowerLoraLoader(nodeInputs(wf, "36"), input.lora2List);
  }

  // 7. KSampler1 — node 3
  const ks1Defaults = DEFAULT_KSAMPLER1;
  const ks1 = nodeInputs(wf, "3");
  ks1.steps = input.ksampler1.steps ?? ks1Defaults.steps;
  ks1.cfg = input.ksampler1.cfg ?? ks1Defaults.cfg;
  ks1.sampler_name = input.ksampler1.sampler_name ?? ks1Defaults.sampler_name;
  ks1.scheduler = input.ksampler1.scheduler ?? ks1Defaults.scheduler;
  ks1.denoise = input.ksampler1.denoise ?? ks1Defaults.denoise;
  ks1.seed = resolveSeed(input.ksampler1);

  // 8. KSampler2 — node 427 (only when hires fix is active)
  if (!skipHiresFix) {
    const ks2Defaults = DEFAULT_KSAMPLER2;
    const ks2 = nodeInputs(wf, "427");
    ks2.steps = input.ksampler2.steps ?? ks2Defaults.steps;
    ks2.cfg = input.ksampler2.cfg ?? ks2Defaults.cfg;
    ks2.sampler_name = input.ksampler2.sampler_name ?? ks2Defaults.sampler_name;
    ks2.scheduler = input.ksampler2.scheduler ?? ks2Defaults.scheduler;
    ks2.denoise = input.ksampler2.denoise ?? ks2Defaults.denoise;
    ks2.seed = resolveSeed(input.ksampler2);
  }

  // 9. Output path — node 515 (Image Save)
  // Normalize path to Unix-style separators for ComfyUI API (prevent [Errno 22] on Windows)
  nodeInputs(wf, "515").output_path = input.outputPath.replace(/\\/g, "/");

  return wf;
}
