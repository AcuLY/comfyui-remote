import { test } from "node:test";
import { strict as assert } from "node:assert";

import { diffResolvedSectionConfig } from "../src/server/prompt-config/diff";
import {
  resolveSectionConfig,
  resolveSectionConfigFromRows,
} from "../src/server/prompt-config/section-resolver";
import type {
  ResolveSectionConfigInput,
  SectionManualLoraEntryRow,
  SectionPresetBindingRow,
} from "../src/server/prompt-config/types";

function category(input: {
  id: string;
  name: string;
  positivePromptOrder?: number;
  lora1Order?: number;
  lora2Order?: number;
  color?: string | null;
}) {
  return {
    id: input.id,
    name: input.name,
    color: input.color ?? null,
    positivePromptOrder: input.positivePromptOrder ?? 0,
    negativePromptOrder: 0,
    lora1Order: input.lora1Order ?? 0,
    lora2Order: input.lora2Order ?? 0,
  };
}

function preset(input: {
  id: string;
  categoryId: string;
  name: string;
  variants: Array<{ id: string; name: string; prompt: string; negativePrompt?: string | null; lora1?: unknown; lora2?: unknown }>;
}) {
  return {
    id: input.id,
    categoryId: input.categoryId,
    name: input.name,
    variants: input.variants.map((variant, index) => ({
      id: variant.id,
      presetId: input.id,
      name: variant.name,
      prompt: variant.prompt,
      negativePrompt: variant.negativePrompt ?? null,
      lora1: variant.lora1 ?? [],
      lora2: variant.lora2 ?? [],
      linkedVariants: null,
      sortOrder: index,
      isActive: true,
    })),
  };
}

function binding(input: {
  id: string;
  bindingKey: string;
  category: ReturnType<typeof category>;
  preset: ReturnType<typeof preset>;
  variantId?: string | null;
  sortOrder?: number;
}): SectionPresetBindingRow {
  return {
    id: input.id,
    projectSectionId: "section-1",
    bindingKey: input.bindingKey,
    categoryId: input.category.id,
    presetId: input.preset.id,
    variantId: input.variantId ?? input.preset.variants[0]?.id ?? null,
    groupBindingKey: null,
    sortOrder: input.sortOrder ?? 0,
    category: input.category,
    preset: input.preset,
  };
}

function input(overrides: Partial<ResolveSectionConfigInput>): ResolveSectionConfigInput {
  return {
    section: {
      id: "section-1",
      positivePrompt: "legacy section positive",
      negativePrompt: "legacy section negative",
      loraConfig: null,
    },
    presetBindings: [],
    promptBlockRows: [],
    manualLoraEntries: [],
    legacyPromptBlocks: [],
    variantLinks: [],
    ...overrides,
  };
}

test("section bindings resolve preset prompt from source rows instead of stale downstream values", () => {
  const character = category({ id: "cat-character", name: "Character", positivePromptOrder: 10, lora1Order: 10 });
  const characterPreset = preset({
    id: "preset-character",
    categoryId: character.id,
    name: "Fresh Character",
    variants: [
      { id: "variant-character", name: "Default", prompt: "fresh character prompt", lora1: [{ path: "/fresh.safetensors", weight: 0.8, enabled: true }] },
    ],
  });
  const characterBinding = binding({
    id: "db-binding-1",
    bindingKey: "bind-character",
    category: character,
    preset: characterPreset,
  });

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [characterBinding],
    promptBlockRows: [
      {
        id: "db-block-1",
        projectSectionId: "section-1",
        sectionBindingId: characterBinding.id,
        type: "preset",
        customLabel: null,
        customPositive: null,
        customNegative: null,
        sortOrder: 0,
      },
    ],
    legacyPromptBlocks: [
      {
        type: "preset",
        sourceId: characterPreset.id,
        variantId: "variant-character",
        categoryId: character.id,
        bindingId: "old-db-id",
        groupBindingId: null,
        label: "stale copied label",
        positive: "stale copied prompt",
        negative: "stale copied negative",
        sortOrder: 0,
      },
    ],
  }));

  assert.equal(resolved.promptBlocks[0].positive, "fresh character prompt");
  assert.equal(resolved.promptBlocks[0].label, "Fresh Character");
  assert.equal(resolved.promptBlocks[0].bindingId, "bind-character");
  assert.equal(resolved.loraConfig.lora1[0].bindingId, "bind-character");
});

test("custom prompt overrides keep preset metadata but replace resolved text and label", () => {
  const style = category({ id: "cat-style", name: "Style", positivePromptOrder: 20 });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Painterly",
    variants: [{ id: "variant-style", name: "Oil", prompt: "source style prompt", negativePrompt: "source negative" }],
  });
  const styleBinding = binding({ id: "db-binding-style", bindingKey: "bind-style", category: style, preset: stylePreset });

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [styleBinding],
    promptBlockRows: [
      {
        id: "db-block-style",
        projectSectionId: "section-1",
        sectionBindingId: styleBinding.id,
        type: "preset",
        customLabel: "Local Style",
        customPositive: "custom style prompt",
        customNegative: "custom negative",
        sortOrder: 0,
      },
    ],
  }));

  assert.deepEqual(resolved.promptBlocks[0], {
    type: "preset",
    sourceId: "preset-style",
    variantId: "variant-style",
    categoryId: "cat-style",
    bindingId: "bind-style",
    groupBindingId: null,
    label: "Local Style",
    positive: "custom style prompt",
    negative: "custom negative",
    sortOrder: 0,
  });
});

test("multi-variant labels can be built from loaded presetVariants when binding metadata is partial", () => {
  const style = category({ id: "cat-style", name: "Style" });
  const partialPreset = {
    id: "preset-multi",
    categoryId: style.id,
    name: "Multi",
    variants: [],
  } as ReturnType<typeof preset>;
  const defaultVariant = {
    id: "variant-default",
    presetId: partialPreset.id,
    name: "Default",
    prompt: "default prompt",
    negativePrompt: null,
    lora1: [],
    lora2: [],
    linkedVariants: null,
    sortOrder: 0,
    isActive: true,
  };
  const altVariant = {
    id: "variant-alt",
    presetId: partialPreset.id,
    name: "Alt",
    prompt: "alt prompt",
    negativePrompt: null,
    lora1: [],
    lora2: [],
    linkedVariants: null,
    sortOrder: 1,
    isActive: true,
  };

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [
      binding({
        id: "db-binding-multi",
        bindingKey: "bind-multi",
        category: style,
        preset: partialPreset,
        variantId: "variant-alt",
      }),
    ],
    presetVariants: [defaultVariant, altVariant],
  }));

  assert.equal(resolved.promptBlocks[0].label, "Multi / Alt");
});

test("binding-only sections synthesize preset-backed blocks sorted by category order then binding order", () => {
  const lateCategory = category({ id: "cat-late", name: "Late", positivePromptOrder: 30 });
  const earlyCategory = category({ id: "cat-early", name: "Early", positivePromptOrder: 10 });
  const latePreset = preset({
    id: "preset-late",
    categoryId: lateCategory.id,
    name: "Late Preset",
    variants: [{ id: "variant-late", name: "Default", prompt: "late prompt" }],
  });
  const earlyPreset = preset({
    id: "preset-early",
    categoryId: earlyCategory.id,
    name: "Early Preset",
    variants: [{ id: "variant-early", name: "Default", prompt: "early prompt" }],
  });

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [
      binding({ id: "db-binding-late", bindingKey: "bind-late", category: lateCategory, preset: latePreset, sortOrder: 0 }),
      binding({ id: "db-binding-early", bindingKey: "bind-early", category: earlyCategory, preset: earlyPreset, sortOrder: 3 }),
    ],
  }));

  assert.deepEqual(resolved.promptBlocks.map((block) => block.bindingId), ["bind-early", "bind-late"]);
  assert.deepEqual(resolved.promptBlocks.map((block) => block.positive), ["early prompt", "late prompt"]);
});

test("manual and detached LoRA rows are resolved with stable binding keys and detached rows suppress preset paths", () => {
  const character = category({ id: "cat-character", name: "Character", lora1Order: 10 });
  const style = category({ id: "cat-style", name: "Style", lora1Order: 30 });
  const characterPreset = preset({
    id: "preset-character",
    categoryId: character.id,
    name: "Character",
    variants: [
      {
        id: "variant-character",
        name: "Default",
        prompt: "character prompt",
        lora1: [
          { path: "/char-base.safetensors", weight: 1, enabled: true },
          { path: "/char-extra.safetensors", weight: 0.6, enabled: true },
        ],
      },
    ],
  });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [
      { id: "variant-style", name: "Default", prompt: "style prompt", lora1: [{ path: "/style.safetensors", weight: 0.5, enabled: true }] },
    ],
  });
  const characterBinding = binding({ id: "db-binding-character", bindingKey: "bind-character", category: character, preset: characterPreset });
  const styleBinding = binding({ id: "db-binding-style", bindingKey: "bind-style", category: style, preset: stylePreset });
  const manualRows: SectionManualLoraEntryRow[] = [
    {
      id: "db-manual-early",
      projectSectionId: "section-1",
      sectionBindingId: null,
      stage: "lora1",
      path: "/manual-early.safetensors",
      weight: 0.3,
      enabled: true,
      detachedFromBindingKey: null,
      detachedFromPresetId: null,
      detachedFromVariantId: null,
      detachedFromPath: null,
      metadata: null,
      sortOrder: 5,
    },
    {
      id: "db-manual-detached",
      projectSectionId: "section-1",
      sectionBindingId: characterBinding.id,
      stage: "lora1",
      path: "/char-custom.safetensors",
      weight: 1.1,
      enabled: true,
      detachedFromBindingKey: "bind-character",
      detachedFromPresetId: "preset-character",
      detachedFromVariantId: "variant-character",
      detachedFromPath: "/char-base.safetensors",
      metadata: null,
      sortOrder: 20,
    },
  ];

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [characterBinding, styleBinding],
    manualLoraEntries: manualRows,
  }));

  assert.deepEqual(
    resolved.loraConfig.lora1.map((entry) => entry.path),
    [
      "/manual-early.safetensors",
      "/char-extra.safetensors",
      "/char-custom.safetensors",
      "/style.safetensors",
    ],
  );
  assert.equal(resolved.loraConfig.lora1[2].source, "manual");
  assert.equal(resolved.loraConfig.lora1[2].detachedBindingId, "bind-character");
  assert.equal(resolved.loraConfig.lora1[2].detachedPresetPath, "/char-base.safetensors");
  assert.equal(resolved.loraConfig.lora1.some((entry) => entry.path === "/char-base.safetensors"), false);
});

test("duplicate preset LoRA paths remain independent across different binding keys", () => {
  const character = category({ id: "cat-character", name: "Character", lora1Order: 10 });
  const style = category({ id: "cat-style", name: "Style", lora1Order: 20 });
  const characterPreset = preset({
    id: "preset-character",
    categoryId: character.id,
    name: "Character",
    variants: [
      { id: "variant-character", name: "Default", prompt: "character", lora1: [{ path: "/shared.safetensors", weight: 1, enabled: true }] },
    ],
  });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [
      { id: "variant-style", name: "Default", prompt: "style", lora1: [{ path: "/shared.safetensors", weight: 0.5, enabled: true }] },
    ],
  });

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [
      binding({ id: "db-binding-character", bindingKey: "bind-character", category: character, preset: characterPreset }),
      binding({ id: "db-binding-style", bindingKey: "bind-style", category: style, preset: stylePreset }),
    ],
  }));

  assert.deepEqual(
    resolved.loraConfig.lora1.map((entry) => [entry.bindingId, entry.path, entry.weight]),
    [
      ["bind-character", "/shared.safetensors", 1],
      ["bind-style", "/shared.safetensors", 0.5],
    ],
  );
});

test("detached LoRA suppression is scoped to the originating binding key", () => {
  const character = category({ id: "cat-character", name: "Character", lora1Order: 10 });
  const style = category({ id: "cat-style", name: "Style", lora1Order: 20 });
  const characterPreset = preset({
    id: "preset-character",
    categoryId: character.id,
    name: "Character",
    variants: [
      { id: "variant-character", name: "Default", prompt: "character", lora1: [{ path: "/shared.safetensors", weight: 1, enabled: true }] },
    ],
  });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [
      { id: "variant-style", name: "Default", prompt: "style", lora1: [{ path: "/shared.safetensors", weight: 0.5, enabled: true }] },
    ],
  });
  const characterBinding = binding({ id: "db-binding-character", bindingKey: "bind-character", category: character, preset: characterPreset });
  const styleBinding = binding({ id: "db-binding-style", bindingKey: "bind-style", category: style, preset: stylePreset });

  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [characterBinding, styleBinding],
    manualLoraEntries: [
      {
        id: "db-detached-character",
        projectSectionId: "section-1",
        sectionBindingId: characterBinding.id,
        stage: "lora1",
        path: "/character-custom.safetensors",
        weight: 1.2,
        enabled: true,
        detachedFromBindingKey: "bind-character",
        detachedFromPresetId: "preset-character",
        detachedFromVariantId: "variant-character",
        detachedFromPath: "/shared.safetensors",
        metadata: null,
        sortOrder: 15,
      },
      {
        id: "db-detached-without-binding-key",
        projectSectionId: "section-1",
        sectionBindingId: null,
        stage: "lora1",
        path: "/unscoped-custom.safetensors",
        weight: 0.7,
        enabled: true,
        detachedFromBindingKey: null,
        detachedFromPresetId: "preset-unknown",
        detachedFromVariantId: "variant-unknown",
        detachedFromPath: "/shared.safetensors",
        metadata: null,
        sortOrder: 25,
      },
    ],
  }));

  const sharedEntries = resolved.loraConfig.lora1.filter((entry) => entry.path === "/shared.safetensors");
  assert.equal(sharedEntries.length, 1);
  assert.equal(sharedEntries[0].bindingId, "bind-style");
  assert.equal(sharedEntries[0].sourceName, "Style");
});

test("sections without new rows fall back to legacy prompt blocks, loraConfig, and section-level prompts", () => {
  const legacyWithBlocks = resolveSectionConfigFromRows(input({
    section: {
      id: "section-1",
      positivePrompt: "section fallback positive",
      negativePrompt: "section fallback negative",
      loraConfig: {
        lora1: [{ id: "legacy-lora", path: "/legacy.safetensors", weight: 0.9, enabled: true, source: "manual" }],
        lora2: [],
      },
    },
    legacyPromptBlocks: [
      {
        type: "custom",
        sourceId: null,
        variantId: null,
        categoryId: null,
        bindingId: null,
        groupBindingId: null,
        label: "Legacy Block",
        positive: "legacy block positive",
        negative: null,
        sortOrder: 0,
      },
    ],
  }));
  const legacySectionPrompt = resolveSectionConfigFromRows(input({
    section: {
      id: "section-2",
      positivePrompt: "section fallback positive",
      negativePrompt: "section fallback negative",
      loraConfig: null,
    },
  }));

  assert.equal(legacyWithBlocks.promptBlocks[0].positive, "legacy block positive");
  assert.equal(legacyWithBlocks.loraConfig.lora1[0].path, "/legacy.safetensors");
  assert.equal(legacySectionPrompt.promptBlocks[0].positive, "section fallback positive");
  assert.equal(legacySectionPrompt.promptBlocks[0].negative, "section fallback negative");
});

test("resolved section config preserves params shape and diff avoids params false positives", () => {
  const projectDefaultResolved = resolveSectionConfigFromRows(input({
    section: {
      id: "section-project-defaults",
      positivePrompt: null,
      negativePrompt: null,
      loraConfig: null,
      project: {
        checkpointName: "project.ckpt",
        projectLevelOverrides: {
          defaultAspectRatio: "4:5",
          defaultShortSidePx: 640,
          defaultBatchSize: 6,
          defaultUpscaleFactor: 1.5,
          defaultSeedPolicy1: "fixed",
          defaultSeedPolicy2: "increment",
          defaultKsampler1: { steps: 20 },
          defaultKsampler2: { steps: 10 },
        },
      },
    },
  }));
  const emptyResolved = resolveSectionConfigFromRows(input({
    section: {
      id: "section-empty-params",
      positivePrompt: null,
      negativePrompt: null,
      loraConfig: null,
    },
  }));
  const emptySnapshot = {
    parameters: {
      aspectRatio: null,
      shortSidePx: null,
      batchSize: null,
      seedPolicy: null,
      seedPolicy1: null,
      seedPolicy2: null,
      upscaleFactor: null,
      checkpointName: null,
    },
    ksampler1: null,
    ksampler2: null,
    extraParams: null,
  };
  const sectionWithParams = {
    id: "section-params",
    positivePrompt: null,
    negativePrompt: null,
    loraConfig: null,
    aspectRatio: "2:3",
    shortSidePx: 1024,
    batchSize: 4,
    seedPolicy1: "fixed",
    seedPolicy2: "random",
    upscaleFactor: 2,
    checkpointName: "dream.ckpt",
    ksampler1: { steps: 24, cfg: 4 },
    ksampler2: { steps: 12, cfg: 7 },
    extraParams: { tiled: true },
  };
  const resolved = resolveSectionConfigFromRows(input({
    section: sectionWithParams,
  }));
  const matchingSnapshot = {
    parameters: {
      aspectRatio: "2:3",
      shortSidePx: 1024,
      batchSize: 4,
      seedPolicy: "fixed",
      seedPolicy1: "fixed",
      seedPolicy2: "random",
      upscaleFactor: 2,
      checkpointName: "dream.ckpt",
    },
    ksampler1: { steps: 24, cfg: 4 },
    ksampler2: { steps: 12, cfg: 7 },
    extraParams: { tiled: true },
  };

  assert.deepEqual(projectDefaultResolved.parameters, {
    aspectRatio: "4:5",
    shortSidePx: 640,
    batchSize: 6,
    seedPolicy: "fixed",
    seedPolicy1: "fixed",
    seedPolicy2: "increment",
    upscaleFactor: 1.5,
    checkpointName: "project.ckpt",
  });
  assert.deepEqual(projectDefaultResolved.ksampler1, { steps: 20 });
  assert.deepEqual(projectDefaultResolved.ksampler2, { steps: 10 });
  assert.deepEqual(emptyResolved.parameters, emptySnapshot.parameters);
  assert.equal(
    diffResolvedSectionConfig(emptySnapshot, emptyResolved).some((diff) => diff.category === "params"),
    false,
  );
  assert.deepEqual(resolved.parameters, matchingSnapshot.parameters);
  assert.deepEqual(resolved.ksampler1, matchingSnapshot.ksampler1);
  assert.deepEqual(resolved.ksampler2, matchingSnapshot.ksampler2);
  assert.deepEqual(resolved.extraParams, matchingSnapshot.extraParams);
  assert.equal(
    diffResolvedSectionConfig(matchingSnapshot, resolved).some((diff) => diff.category === "params"),
    false,
  );
  assert.equal(
    diffResolvedSectionConfig({ ...matchingSnapshot, parameters: { batchSize: 1 } }, resolved)
      .some((diff) => diff.category === "params"),
    true,
  );
});

test("resolved section config exposes aggregate prompt, presets, and warnings", () => {
  const style = category({ id: "cat-style", name: "Style" });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [{ id: "variant-style", name: "Default", prompt: "style positive", negativePrompt: "style negative" }],
  });
  const resolved = resolveSectionConfigFromRows(input({
    presetBindings: [
      binding({ id: "db-binding-style", bindingKey: "bind-style", category: style, preset: stylePreset }),
    ],
    promptBlockRows: [
      {
        id: "db-custom",
        projectSectionId: "section-1",
        sectionBindingId: null,
        type: "custom",
        customLabel: "Custom",
        customPositive: "custom positive",
        customNegative: "custom negative",
        sortOrder: 1,
      },
    ],
  }));

  assert.deepEqual(resolved.prompt, {
    positive: "custom positive BREAK style positive",
    negative: "custom negative BREAK style negative",
  });
  assert.deepEqual(resolved.presets, [
    {
      categoryId: "cat-style",
      presetId: "preset-style",
      variantId: "variant-style",
      bindingId: "bind-style",
      label: "Style",
    },
  ]);
  assert.deepEqual(resolved.warnings, []);
});

test("DB wrapper returns legacy-only sections without loading preset variants or links", async () => {
  const client = {
    projectSection: {
      async findUnique() {
        return {
          id: "section-legacy",
          positivePrompt: "legacy positive",
          negativePrompt: null,
          loraConfig: null,
          ksampler1: null,
          ksampler2: null,
          extraParams: null,
          presetBindingRows: [],
          sectionPromptBlocks: [],
          manualLoraEntries: [],
          promptBlocks: [],
        };
      },
    },
    presetVariant: {
      async findMany() {
        throw new Error("legacy-only sections should not load preset variants");
      },
      async findUnique() {
        throw new Error("legacy-only sections should not load preset variants");
      },
      async findFirst() {
        throw new Error("legacy-only sections should not load preset variants");
      },
    },
    presetVariantLink: {
      async findMany() {
        throw new Error("legacy-only sections should not load preset variant links");
      },
    },
  };

  const resolved = await resolveSectionConfig("section-legacy", client);

  assert.equal(resolved?.promptBlocks[0].positive, "legacy positive");
});

test("DB wrapper resolves new binding rows lazily while preserving multi-variant labels", async () => {
  const character = category({ id: "cat-character", name: "Character" });
  const multiPreset = preset({
    id: "preset-multi",
    categoryId: character.id,
    name: "Multi",
    variants: [
      { id: "variant-default", name: "Default", prompt: "default prompt" },
      { id: "variant-alt", name: "Alt", prompt: "alt prompt" },
    ],
  });
  const variantFindUniqueIds: string[] = [];
  const variantFindManyCalls: unknown[] = [];
  const linkFindManySources: string[] = [];
  const variantsById = new Map(multiPreset.variants.map((variant) => [variant.id, variant]));
  const client = {
    projectSection: {
      async findUnique(args: {
        select: {
          presetBindingRows: {
            select: {
              preset: {
                select: {
                  variants: {
                    select: Record<string, true>;
                  };
                };
              };
            };
          };
        };
      }) {
        const variantSelect = args.select.presetBindingRows.select.preset.select.variants.select;
        assert.deepEqual(Object.keys(variantSelect).sort(), ["id", "isActive", "name", "presetId", "sortOrder"]);

        return {
          id: "section-new",
          positivePrompt: null,
          negativePrompt: null,
          loraConfig: null,
          aspectRatio: null,
          shortSidePx: null,
          batchSize: null,
          seedPolicy1: null,
          seedPolicy2: null,
          upscaleFactor: null,
          checkpointName: null,
          ksampler1: null,
          ksampler2: null,
          extraParams: null,
          presetBindingRows: [
            binding({
              id: "db-binding-multi",
              bindingKey: "bind-multi",
              category: character,
              preset: multiPreset,
              variantId: "variant-alt",
            }),
          ],
          sectionPromptBlocks: [],
          manualLoraEntries: [],
          promptBlocks: [],
        };
      },
    },
    presetVariant: {
      async findMany(args: unknown) {
        variantFindManyCalls.push(args);
        throw new Error("new-row sections should not load all preset variants");
      },
      async findUnique(args: { where: { id: string } }) {
        variantFindUniqueIds.push(args.where.id);
        return variantsById.get(args.where.id) ?? null;
      },
      async findFirst() {
        throw new Error("selected variants should not need default variant lookup");
      },
    },
    presetVariantLink: {
      async findMany(args: { where: { sourceVariantId: string } }) {
        linkFindManySources.push(args.where.sourceVariantId);
        return [];
      },
    },
  };

  const resolved = await resolveSectionConfig("section-new", client);

  assert.equal(resolved?.promptBlocks[0].label, "Multi / Alt");
  assert.equal(resolved?.promptBlocks[0].positive, "alt prompt");
  assert.deepEqual(variantFindUniqueIds, ["variant-alt"]);
  assert.deepEqual(linkFindManySources, ["variant-alt"]);
  assert.equal(variantFindManyCalls.length, 0);
});

test("diffResolvedSectionConfig classifies prompt, lora, missing reference, and legacy-only mismatches", () => {
  const diffs = diffResolvedSectionConfig(
    {
      promptBlocks: [{ type: "custom", label: "Old", positive: "old prompt", negative: null }],
      loraConfig: { lora1: [{ path: "/old.safetensors", weight: 1, enabled: true, source: "manual" }], lora2: [] },
      parameters: {
        aspectRatio: null,
        shortSidePx: null,
        batchSize: null,
        seedPolicy: null,
        seedPolicy1: null,
        seedPolicy2: null,
        upscaleFactor: null,
        checkpointName: null,
      },
      ksampler1: null,
      ksampler2: null,
      extraParams: null,
      positivePrompt: "legacy composed prompt",
    },
    {
      promptBlocks: [
        {
          type: "custom",
          sourceId: null,
          variantId: null,
          categoryId: null,
          bindingId: null,
          groupBindingId: null,
          label: "New",
          positive: "new prompt",
          negative: null,
          sortOrder: 0,
        },
      ],
      prompt: {
        positive: "new prompt",
        negative: null,
      },
      presets: [],
      loraConfig: {
        lora1: [
          {
            id: "new-lora",
            path: "/new.safetensors",
            weight: 1,
            enabled: true,
            source: "manual",
          },
        ],
        lora2: [],
      },
      parameters: {
        aspectRatio: null,
        shortSidePx: null,
        batchSize: null,
        seedPolicy: null,
        seedPolicy1: null,
        seedPolicy2: null,
        upscaleFactor: null,
        checkpointName: null,
      },
      ksampler1: null,
      ksampler2: null,
      extraParams: null,
      warnings: ["presetVariant:bind-missing:missing-variant"],
      missingReferences: [{ kind: "presetVariant", id: "missing-variant", ownerId: "bind-missing" }],
    },
  );

  assert.deepEqual(
    [...new Set(diffs.map((diff) => diff.category))].sort(),
    ["legacyOnly", "lora", "missingReference", "prompt"],
  );
});
