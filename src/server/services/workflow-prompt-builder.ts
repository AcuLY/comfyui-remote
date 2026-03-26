/**
 * Workflow Prompt Builder (v0.3)
 *
 * Fills the standard `docs/workflow.api.json` template with per-position
 * parameters (prompts, dimensions, LoRAs, KSampler settings, output path)
 * and returns a ready-to-submit ComfyUI API prompt graph.
 *
 * Node mapping (see docs/design-v0.3-workflow-integration.md §2):
 *
 *   511  positive prompt (Text Multiline)
 *   513  negative prompt (Text Multiline)
 *   407  Empty Latent Image (width, height, batch_size)
 *   425  Upscale Latent (width, height)
 *   482  character lora (Power Lora Loader)
 *   522  lora 1 — KS1 branch (Power Lora Loader, 482→522→524→KS1)
 *   24   lora 1 — KS2 branch (Power Lora Loader, 36→24→25→KS2)
 *   36   lora 2 — KS2 branch entry (Power Lora Loader, 482→36)
 *   25   lora 2 — KS2 branch cont. (Power Lora Loader, 24→25→KS2)
 *   524  lora 2 — KS1 branch (Power Lora Loader, 522→524→KS1)
 *   3    KSampler1
 *   427  KSampler2
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
  /** Short side pixels (width for portrait, height for landscape) */
  shortSidePx: number;
  /** Long side pixels */
  longSidePx: number;
  batchSize: number;
  /** Upscale factor for LatentUpscale (default 2) */
  upscaleFactor?: number;
  /** Character LoRA (fills node 482) */
  characterLora: LoraBinding[];
  /** LoRA 1 list (fills nodes 522 → 24) */
  lora1List: LoraBinding[];
  /** LoRA 2 list (fills nodes 36, 25, 524) */
  lora2List: LoraBinding[];
  ksampler1: KSamplerParams;
  ksampler2: KSamplerParams;
  /** e.g. "MyJob/1.close_up_shot" */
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
  // Remove all existing lora_N entries
  for (const key of Object.keys(inputs)) {
    if (/^lora_\d+$/.test(key)) {
      delete inputs[key];
    }
  }

  // Fill with new bindings
  const enabledBindings = bindings.filter((b) => b.enabled);
  for (let i = 0; i < enabledBindings.length; i++) {
    const b = enabledBindings[i];
    inputs[`lora_${i + 1}`] = {
      on: true,
      lora: b.path,
      strength: b.weight,
    };
  }
}

/** Resolve seed from KSamplerParams and optional run context. */
function resolveSeed(params: KSamplerParams): number {
  const policy = params.seedPolicy ?? "random";
  switch (policy) {
    case "fixed":
      return 42;
    case "increment":
      // For now, use random — actual increment requires runIndex context
      return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    case "random":
    default:
      return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fill the workflow template with position-specific parameters.
 *
 * The caller must provide a deep-cloned `workflowTemplate` — this function
 * mutates it in-place and returns it.
 */
export function buildWorkflowPrompt(input: WorkflowBuildInput): Record<string, unknown> {
  const wf = input.workflowTemplate;
  const upscale = input.upscaleFactor ?? 2;

  // 1. Prompts — nodes 511, 513
  nodeInputs(wf, "511").text = input.positivePrompt;
  nodeInputs(wf, "513").text = input.negativePrompt;

  // 2. Image dimensions — node 407 (Empty Latent Image)
  const latent = nodeInputs(wf, "407");
  latent.width = input.shortSidePx;
  latent.height = input.longSidePx;
  latent.batch_size = input.batchSize;

  // 3. Upscale dimensions — node 425 (Upscale Latent)
  //    Must match the same orientation as node 407: width = short, height = long
  const upscaleInputs = nodeInputs(wf, "425");
  upscaleInputs.width = input.shortSidePx * upscale;
  upscaleInputs.height = input.longSidePx * upscale;

  // 4. Character LoRA — node 482
  if (input.characterLora.length > 0) {
    fillPowerLoraLoader(nodeInputs(wf, "482"), input.characterLora);
  }

  // 5. LoRA 1 — nodes 522 (KS1 branch) and 24 (KS2 branch)
  //    KS1 chain: 482 → 522 → 524 → KS1(3)
  //    KS2 chain: 482 → 36 → 24 → 25 → KS2(427)
  //    Both 522 and 24 carry lora1 entries for their respective branches
  fillPowerLoraLoader(nodeInputs(wf, "522"), input.lora1List);
  fillPowerLoraLoader(nodeInputs(wf, "24"), input.lora1List);

  // 6. LoRA 2 — nodes 524 (KS1 branch), 36 and 25 (KS2 branch)
  //    KS1 chain: ... → 522 → 524(lora2) → KS1(3)
  //    KS2 chain: ... → 36(lora2) → 24 → 25(lora2) → KS2(427)
  fillPowerLoraLoader(nodeInputs(wf, "524"), input.lora2List);
  fillPowerLoraLoader(nodeInputs(wf, "36"), input.lora2List);
  fillPowerLoraLoader(nodeInputs(wf, "25"), input.lora2List);

  // 7. KSampler1 — node 3
  const ks1Defaults = DEFAULT_KSAMPLER1;
  const ks1 = nodeInputs(wf, "3");
  ks1.steps = input.ksampler1.steps ?? ks1Defaults.steps;
  ks1.cfg = input.ksampler1.cfg ?? ks1Defaults.cfg;
  ks1.sampler_name = input.ksampler1.sampler_name ?? ks1Defaults.sampler_name;
  ks1.scheduler = input.ksampler1.scheduler ?? ks1Defaults.scheduler;
  ks1.denoise = input.ksampler1.denoise ?? ks1Defaults.denoise;
  ks1.seed = resolveSeed(input.ksampler1);

  // 8. KSampler2 — node 427
  const ks2Defaults = DEFAULT_KSAMPLER2;
  const ks2 = nodeInputs(wf, "427");
  ks2.steps = input.ksampler2.steps ?? ks2Defaults.steps;
  ks2.cfg = input.ksampler2.cfg ?? ks2Defaults.cfg;
  ks2.sampler_name = input.ksampler2.sampler_name ?? ks2Defaults.sampler_name;
  ks2.scheduler = input.ksampler2.scheduler ?? ks2Defaults.scheduler;
  ks2.denoise = input.ksampler2.denoise ?? ks2Defaults.denoise;
  ks2.seed = resolveSeed(input.ksampler2);

  // 9. Output path — node 515 (Image Save)
  nodeInputs(wf, "515").output_path = input.outputPath;

  return wf;
}
