import type {
  MissingReference,
  ResolvedSectionConfig,
  SectionLoraConfig,
} from "./types";

export type ResolvedSectionConfigDiffCategory =
  | "prompt"
  | "lora"
  | "params"
  | "missingReference"
  | "legacyOnly";

export type ResolvedSectionConfigDiff = {
  category: ResolvedSectionConfigDiffCategory;
  path: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortObject(value));
}

function normalizePromptBlocks(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.promptBlocks)) return [];

  return value.promptBlocks.map((block) => {
    if (!isRecord(block)) return block;
    return {
      type: block.type ?? null,
      sourceId: block.sourceId ?? null,
      variantId: block.variantId ?? null,
      categoryId: block.categoryId ?? null,
      bindingId: block.bindingId ?? null,
      groupBindingId: block.groupBindingId ?? null,
      label: block.label ?? null,
      positive: block.positive ?? null,
      negative: block.negative ?? null,
    };
  });
}

function normalizeLoraConfig(value: unknown) {
  if (!isRecord(value) || !isRecord(value.loraConfig)) return { lora1: [], lora2: [] };
  const config = value.loraConfig as Partial<SectionLoraConfig>;

  const normalizeStage = (entries: unknown) => {
    if (!Array.isArray(entries)) return [];
    return entries.map((entry) => {
      if (!isRecord(entry)) return entry;
      return {
        path: entry.path ?? null,
        weight: entry.weight ?? null,
        enabled: entry.enabled ?? null,
        source: entry.source ?? null,
        bindingId: entry.bindingId ?? null,
        groupBindingId: entry.groupBindingId ?? null,
        detachedBindingId: entry.detachedBindingId ?? null,
        detachedPresetPath: entry.detachedPresetPath ?? null,
        suppressed: entry.suppressed === true ? true : undefined,
      };
    });
  };

  return {
    lora1: normalizeStage(config.lora1),
    lora2: normalizeStage(config.lora2),
  };
}

function normalizeParams(value: unknown) {
  if (!isRecord(value)) return {};

  return {
    parameters: value.parameters ?? null,
    ksampler1: value.ksampler1 ?? null,
    ksampler2: value.ksampler2 ?? null,
    extraParams: value.extraParams ?? null,
  };
}

function readMissingReferences(value: ResolvedSectionConfig): MissingReference[] {
  return value.missingReferences ?? [];
}

function addMismatch(
  diffs: ResolvedSectionConfigDiff[],
  category: ResolvedSectionConfigDiffCategory,
  path: string,
  message: string,
) {
  diffs.push({ category, path, message });
}

export function diffResolvedSectionConfig(
  oldSnapshotLike: unknown,
  resolved: ResolvedSectionConfig,
): ResolvedSectionConfigDiff[] {
  const diffs: ResolvedSectionConfigDiff[] = [];
  const oldPrompt = normalizePromptBlocks(oldSnapshotLike);
  const nextPrompt = normalizePromptBlocks(resolved);
  const oldLora = normalizeLoraConfig(oldSnapshotLike);
  const nextLora = normalizeLoraConfig(resolved);
  const oldParams = normalizeParams(oldSnapshotLike);
  const nextParams = normalizeParams(resolved);

  if (stableStringify(oldPrompt) !== stableStringify(nextPrompt)) {
    addMismatch(diffs, "prompt", "promptBlocks", "resolved prompt blocks differ");
  }

  if (stableStringify(oldLora) !== stableStringify(nextLora)) {
    addMismatch(diffs, "lora", "loraConfig", "resolved LoRA config differs");
  }

  if (stableStringify(oldParams) !== stableStringify(nextParams)) {
    addMismatch(diffs, "params", "parameters", "resolved parameters differ");
  }

  for (const missingReference of readMissingReferences(resolved)) {
    addMismatch(
      diffs,
      "missingReference",
      missingReference.ownerId
        ? `${missingReference.kind}:${missingReference.ownerId}:${missingReference.id}`
        : `${missingReference.kind}:${missingReference.id}`,
      "resolver could not resolve a referenced row",
    );
  }

  if (isRecord(oldSnapshotLike)) {
    for (const key of ["positivePrompt", "negativePrompt", "loraConfigJson", "composedPrompt"]) {
      if (key in oldSnapshotLike && !(key in resolved)) {
        addMismatch(diffs, "legacyOnly", key, "legacy-only field is not part of resolver output");
      }
    }

    if (isRecord(oldSnapshotLike.section)) {
      for (const key of ["positivePrompt", "negativePrompt"]) {
        if (key in oldSnapshotLike.section) {
          addMismatch(diffs, "legacyOnly", `section.${key}`, "legacy section prompt field is not part of resolver output");
        }
      }
    }
  }

  return diffs;
}
