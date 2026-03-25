/**
 * LoRA Binding Types
 *
 * Used for storing LoRA configurations in presets (Character/Scene/Style/Position)
 * and in job positions (CompleteJobPosition.loraConfig).
 */

/** Source type for tracking where a LoRA came from */
export type LoraSource = "character" | "scene" | "style" | "position" | "manual";

/** Individual LoRA binding configuration */
export type LoraBinding = {
  path: string;
  weight: number; // 0.00 - 2.00, 2 decimal places
  enabled: boolean;
};

/** Extended LoRA entry with source tracking (used in job sections) */
export type LoraEntry = LoraBinding & {
  id: string; // unique id for React key and operations
  source: LoraSource;
  sourceLabel?: string; // e.g. "角色: Miku" or "场景: Park"
};

/** LoRA config structure stored in CompleteJobPosition.loraConfig */
export type PositionLoraConfig = {
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
 */
export function parsePositionLoraConfig(json: unknown): PositionLoraConfig {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { entries: [] };
  }
  const obj = json as Record<string, unknown>;
  return {
    entries: Array.isArray(obj.entries)
      ? obj.entries
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
          }))
      : [],
  };
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
  return {
    entries: config.entries.map((e) => ({
      id: e.id,
      path: e.path,
      weight: Math.round(e.weight * 100) / 100,
      enabled: e.enabled,
      source: e.source,
      sourceLabel: e.sourceLabel,
    })),
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
