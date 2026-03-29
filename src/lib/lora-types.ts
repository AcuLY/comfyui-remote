/**
 * LoRA Binding Types
 *
 * Used for storing LoRA configurations in presets (Character/Scene/Style/Position)
 * and in project sections (ProjectSection.loraConfig).
 */

/** Source type for tracking where a LoRA came from */
export type LoraSource = "character" | "scene" | "style" | "position" | "manual";

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
  sourceLabel?: string; // e.g. "角色: Miku" or "场景: Park"
};

// ---------------------------------------------------------------------------
// KSampler Parameters (v0.3)
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
// LoRA Config (v0.3)
// ---------------------------------------------------------------------------

/**
 * LoRA config structure stored in ProjectSection.loraConfig
 * v0.3: Restructured to separate characterLora, lora1, lora2
 */
export type PositionLoraConfig = {
  characterLora: LoraEntry[];  // 从项目角色带入（只读展示）
  lora1: LoraEntry[];          // lora1 列表（可编辑，来自 position template 或手动添加）
  lora2: LoraEntry[];          // lora2 列表（可编辑，来自 position template 或手动添加）
};

/** @deprecated Use PositionLoraConfig instead */
export type LegacyPositionLoraConfig = {
  entries: LoraEntry[];
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
 * Parse PositionLoraConfig JSON from database
 * Supports both v0.3 format (characterLora/lora1/lora2) and legacy format (entries)
 */
export function parsePositionLoraConfig(json: unknown): PositionLoraConfig {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { characterLora: [], lora1: [], lora2: [] };
  }
  const obj = json as Record<string, unknown>;

  // v0.3 format
  if ("characterLora" in obj || "lora1" in obj || "lora2" in obj) {
    return {
      characterLora: parseLoraEntryArray(obj.characterLora),
      lora1: parseLoraEntryArray(obj.lora1),
      lora2: parseLoraEntryArray(obj.lora2),
    };
  }

  // Legacy format: migrate entries to lora1
  if ("entries" in obj && Array.isArray(obj.entries)) {
    const entries = parseLoraEntryArray(obj.entries);
    // Split by source: character -> characterLora, others -> lora1
    const characterLora = entries.filter((e) => e.source === "character");
    const lora1 = entries.filter((e) => e.source !== "character");
    return { characterLora, lora1, lora2: [] };
  }

  return { characterLora: [], lora1: [], lora2: [] };
}

/**
 * Parse legacy PositionLoraConfig JSON (for migration)
 * @deprecated Use parsePositionLoraConfig
 */
export function parseLegacyPositionLoraConfig(json: unknown): LegacyPositionLoraConfig {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { entries: [] };
  }
  const obj = json as Record<string, unknown>;
  return {
    entries: parseLoraEntryArray(obj.entries),
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
 * Serialize PositionLoraConfig for database storage
 */
export function serializePositionLoraConfig(config: PositionLoraConfig): PositionLoraConfig {
  const serializeEntry = (e: LoraEntry) => ({
    id: e.id,
    path: e.path,
    weight: Math.round(e.weight * 100) / 100,
    enabled: e.enabled,
    source: e.source,
    sourceLabel: e.sourceLabel,
  });

  return {
    characterLora: config.characterLora.map(serializeEntry),
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
