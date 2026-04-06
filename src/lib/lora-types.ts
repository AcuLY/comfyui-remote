/**
 * LoRA Binding Types
 *
 * Used for storing LoRA configurations in presets and project sections.
 */

/** Source type for tracking where a LoRA came from */
export type LoraSource = "preset" | "manual";

/** Individual LoRA binding configuration */
export type LoraBinding = {
  path: string;
  weight: number; // 0.00 - 2.00, 2 decimal places
  enabled: boolean;
};

/** Extended LoRA entry with source tracking (used in project sections) */
export type LoraEntry = LoraBinding & {
  id: string; // unique id for React key and operations
  source: LoraSource;
  sourceLabel?: string; // category name e.g. "角色" or "场景"
  sourceColor?: string; // HSL color string e.g. "200 50% 55%"
  sourceName?: string;  // preset name e.g. "Miku" (displayed as row title)
  bindingId?: string;   // groups loras from same preset import
  groupBindingId?: string; // groups all loras from same group import
};

// ---------------------------------------------------------------------------
// KSampler Parameters
// ---------------------------------------------------------------------------

/** Seed policy for KSampler */
export type SeedPolicy = "random" | "fixed" | "increment";

/** KSampler parameters for workflow filling */
export type KSamplerParams = {
  steps?: number;          // 默认 30
  cfg?: number;            // 默认 4 (KSampler1) / 7 (KSampler2)
  sampler_name?: string;   // 默认 "euler_ancestral" (KSampler1) / "dpmpp_2m" (KSampler2)
  scheduler?: string;      // 默认 "karras"
  denoise?: number;        // 默认 1 (KSampler1) / 0.6 (KSampler2)
  seedPolicy?: SeedPolicy; // 默认 "random"
};

/** Default KSampler1 parameters */
export const DEFAULT_KSAMPLER1: Required<KSamplerParams> = {
  steps: 30,
  cfg: 4,
  sampler_name: "euler_ancestral",
  scheduler: "karras",
  denoise: 1,
  seedPolicy: "random",
};

/** Default KSampler2 parameters (高清修复) */
export const DEFAULT_KSAMPLER2: Required<KSamplerParams> = {
  steps: 30,
  cfg: 7,
  sampler_name: "dpmpp_2m",
  scheduler: "karras",
  denoise: 0.6,
  seedPolicy: "random",
};

/** Parse KSamplerParams JSON from database */
export function parseKSamplerParams(
  json: unknown,
  defaults: Required<KSamplerParams>,
): KSamplerParams {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { ...defaults };
  }
  const obj = json as Record<string, unknown>;
  return {
    steps: typeof obj.steps === "number" ? obj.steps : defaults.steps,
    cfg: typeof obj.cfg === "number" ? obj.cfg : defaults.cfg,
    sampler_name: typeof obj.sampler_name === "string" ? obj.sampler_name : defaults.sampler_name,
    scheduler: typeof obj.scheduler === "string" ? obj.scheduler : defaults.scheduler,
    denoise: typeof obj.denoise === "number" ? obj.denoise : defaults.denoise,
    seedPolicy: isSeedPolicy(obj.seedPolicy) ? obj.seedPolicy : defaults.seedPolicy,
  };
}

function isSeedPolicy(value: unknown): value is SeedPolicy {
  return value === "random" || value === "fixed" || value === "increment";
}

// ---------------------------------------------------------------------------
// LoRA Config
// ---------------------------------------------------------------------------

/**
 * LoRA config structure stored in ProjectSection.loraConfig
 */
export type SectionLoraConfig = {
  lora1: LoraEntry[];          // lora1 列表（可编辑，来自 preset 或手动添加）
  lora2: LoraEntry[];          // lora2 列表（可编辑，来自 preset 或手动添加）
};

/**
 * Parse loraBindings JSON from database
 */
export function parseLoraBindings(json: unknown): LoraBinding[] {
  if (!json || !Array.isArray(json)) return [];
  return json
    .filter(
      (item): item is LoraBinding =>
        typeof item === "object" &&
        item !== null &&
        typeof item.path === "string" &&
        typeof item.weight === "number" &&
        typeof item.enabled === "boolean",
    )
    .map((item) => ({
      path: item.path,
      weight: Math.round(item.weight * 100) / 100, // ensure 2 decimal places
      enabled: item.enabled,
    }));
}

/**
 * Parse SectionLoraConfig JSON from database
 */
export function parseSectionLoraConfig(json: unknown): SectionLoraConfig {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { lora1: [], lora2: [] };
  }
  const obj = json as Record<string, unknown>;

  return {
    lora1: parseLoraEntryArray(obj.lora1),
    lora2: parseLoraEntryArray(obj.lora2),
  };
}

/** Helper: parse array of LoraEntry */
function parseLoraEntryArray(arr: unknown): LoraEntry[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (item): item is LoraEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as LoraEntry).id === "string" &&
        typeof (item as LoraEntry).path === "string" &&
        typeof (item as LoraEntry).weight === "number" &&
        typeof (item as LoraEntry).enabled === "boolean" &&
        typeof (item as LoraEntry).source === "string",
    )
    .map((item) => ({
      ...item,
      weight: Math.round(item.weight * 100) / 100,
    }));
}

/**
 * Serialize LoRA bindings for database storage
 */
export function serializeLoraBindings(bindings: LoraBinding[]): LoraBinding[] {
  return bindings.map((b) => ({
    path: b.path,
    weight: Math.round(b.weight * 100) / 100,
    enabled: b.enabled,
  }));
}

/**
 * Serialize SectionLoraConfig for database storage
 */
export function serializeSectionLoraConfig(config: SectionLoraConfig): SectionLoraConfig {
  const serializeEntry = (e: LoraEntry) => ({
    id: e.id,
    path: e.path,
    weight: Math.round(e.weight * 100) / 100,
    enabled: e.enabled,
    source: e.source,
    sourceLabel: e.sourceLabel,
    sourceColor: e.sourceColor,
    sourceName: e.sourceName,
    bindingId: e.bindingId,
  });

  return {
    lora1: config.lora1.map(serializeEntry),
    lora2: config.lora2.map(serializeEntry),
  };
}

/**
 * Generate unique ID for LoRA entry
 */
export function generateLoraEntryId(): string {
  return `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert LoraBinding to LoraEntry with source
 */
export function bindingToEntry(
  binding: LoraBinding,
  source: LoraSource,
  sourceLabel?: string,
): LoraEntry {
  return {
    id: generateLoraEntryId(),
    path: binding.path,
    weight: Math.round(binding.weight * 100) / 100,
    enabled: binding.enabled,
    source,
    sourceLabel,
  };
}

/**
 * Create default LoRA binding
 */
export function createDefaultLoraBinding(): LoraBinding {
  return {
    path: "",
    weight: 1.0,
    enabled: true,
  };
}
