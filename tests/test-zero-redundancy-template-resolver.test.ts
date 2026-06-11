import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  buildTemplateSectionRowsFromSectionData,
  buildProjectSectionDataForTemplateImport,
  buildProjectSectionRowsForTemplateImport,
  buildTemplateSectionRowsForProjectSectionSave,
  resolveTemplateSectionConfigFromRows,
} from "../src/server/prompt-config/template-resolver";
import type {
  ResolveTemplateSectionConfigInput,
  SectionPresetBindingRow,
  TemplateSectionPresetBindingRow,
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
  variants: Array<{
    id: string;
    name: string;
    prompt: string;
    negativePrompt?: string | null;
    lora1?: unknown;
    lora2?: unknown;
  }>;
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

function templateBinding(input: {
  id: string;
  bindingKey: string;
  category: ReturnType<typeof category>;
  preset: ReturnType<typeof preset>;
  variantId?: string | null;
  sortOrder?: number;
}): TemplateSectionPresetBindingRow {
  return {
    id: input.id,
    projectTemplateSectionId: "template-section-1",
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

function sectionBinding(input: {
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

function resolverInput(
  overrides: Partial<ResolveTemplateSectionConfigInput>,
): ResolveTemplateSectionConfigInput {
  return {
    templateSection: {
      id: "template-section-1",
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
    },
    presetBindings: [],
    promptBlockRows: [],
    manualLoraEntries: [],
    variantLinks: [],
    ...overrides,
  };
}

test("template section bindings resolve preset prompt and lora lazily from current preset rows", () => {
  const style = category({ id: "cat-style", name: "Style", positivePromptOrder: 10, lora1Order: 10 });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Fresh Style",
    variants: [
      {
        id: "variant-style",
        name: "Default",
        prompt: "fresh style prompt",
        negativePrompt: "fresh style negative",
        lora1: [{ path: "/fresh-style.safetensors", weight: 0.75, enabled: true }],
      },
    ],
  });
  const binding = templateBinding({
    id: "template-binding-style",
    bindingKey: "bind-style",
    category: style,
    preset: stylePreset,
  });

  const resolved = resolveTemplateSectionConfigFromRows(resolverInput({
    presetBindings: [binding],
    promptBlockRows: [
      {
        id: "template-block-style",
        projectTemplateSectionId: "template-section-1",
        templateSectionBindingId: binding.id,
        type: "preset",
        customLabel: null,
        customPositive: null,
        customNegative: null,
        sortOrder: 0,
      },
    ],
    templateSection: {
      id: "template-section-1",
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
    },
  }));

  assert.equal(resolved.promptBlocks[0].positive, "fresh style prompt");
  assert.equal(resolved.promptBlocks[0].negative, "fresh style negative");
  assert.equal(resolved.promptBlocks[0].bindingId, "bind-style");
  assert.deepEqual(
    resolved.loraConfig.lora1.map((entry) => [entry.bindingId, entry.path, entry.weight]),
    [["bind-style", "/fresh-style.safetensors", 0.75]],
  );
});

test("saving a template section writes relation rows without copying clean preset prompt or lora expansions", () => {
  const style = category({ id: "cat-style", name: "Style" });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [
      {
        id: "variant-style",
        name: "Default",
        prompt: "preset prompt that must not be copied",
        lora1: [{ path: "/preset-style.safetensors", weight: 0.5, enabled: true }],
      },
    ],
  });
  const binding = sectionBinding({
    id: "section-binding-style",
    bindingKey: "bind-style",
    category: style,
    preset: stylePreset,
  });

  const rows = buildTemplateSectionRowsForProjectSectionSave({
    projectTemplateSectionId: "template-section-1",
    projectSection: {
      id: "section-1",
    },
    presetBindings: [binding],
    promptBlockRows: [
      {
        id: "section-block-style",
        projectSectionId: "section-1",
        sectionBindingId: binding.id,
        type: "preset",
        customLabel: null,
        customPositive: null,
        customNegative: null,
        sortOrder: 0,
      },
    ],
    manualLoraEntries: [],
    projectLevelBindings: [],
  });

  assert.deepEqual(rows.presetBindings.map((row) => ({
    bindingKey: row.bindingKey,
    presetId: row.presetId,
    variantId: row.variantId,
  })), [
    { bindingKey: "bind-style", presetId: "preset-style", variantId: "variant-style" },
  ]);
  assert.equal(rows.promptBlocks.length, 1);
  assert.equal(rows.promptBlocks[0].type, "preset");
  assert.equal(rows.promptBlocks[0].customPositive, null);
  assert.equal("positive" in rows.promptBlocks[0], false);
  assert.equal(rows.manualLoraEntries.some((entry) => entry.path === "/preset-style.safetensors"), false);
});

test("saving template editor section data preserves preset bindings instead of resolved prompt snapshots", () => {
  const rows = buildTemplateSectionRowsFromSectionData({
    projectTemplateSectionId: "template-section-1",
    section: {
      promptBlocks: [
        {
          label: "Style",
          positive: "resolved prompt that must not be copied",
          negative: "resolved negative that must not be copied",
          sortOrder: 3,
          type: "preset",
          sourceId: "preset-style",
          variantId: "variant-style",
          categoryId: "cat-style",
          bindingId: "bind-style",
          groupBindingId: "group-1",
        },
      ],
      loraConfig: {
        lora1: [
          {
            id: "lora-clean",
            path: "/preset-style.safetensors",
            weight: 0.5,
            enabled: true,
            source: "preset",
            bindingId: "bind-style",
            groupBindingId: "group-1",
          },
        ],
        lora2: [],
      },
    },
  });

  assert.deepEqual(rows.presetBindings.map((row) => ({
    bindingKey: row.bindingKey,
    categoryId: row.categoryId,
    presetId: row.presetId,
    variantId: row.variantId,
    groupBindingKey: row.groupBindingKey,
    sortOrder: row.sortOrder,
  })), [
    {
      bindingKey: "bind-style",
      categoryId: "cat-style",
      presetId: "preset-style",
      variantId: "variant-style",
      groupBindingKey: "group-1",
      sortOrder: 3,
    },
  ]);
  assert.deepEqual(rows.promptBlocks.map((row) => ({
    type: row.type,
    templateSectionBindingId: row.templateSectionBindingId,
    customLabel: row.customLabel,
    customPositive: row.customPositive,
    customNegative: row.customNegative,
    sortOrder: row.sortOrder,
  })), [
    {
      type: "preset",
      templateSectionBindingId: "templateSectionPresetBinding:template-section-1:bind-style",
      customLabel: null,
      customPositive: null,
      customNegative: null,
      sortOrder: 3,
    },
  ]);
  assert.equal("positive" in rows.promptBlocks[0], false);
  assert.equal(rows.manualLoraEntries.length, 0);
});

test("saving template editor section data keeps custom blocks and detached lora rows", () => {
  const rows = buildTemplateSectionRowsFromSectionData({
    projectTemplateSectionId: "template-section-1",
    section: {
      promptBlocks: [
        {
          label: "Style",
          positive: "preset prompt",
          negative: null,
          sortOrder: 0,
          type: "preset",
          sourceId: "preset-style",
          variantId: "variant-style",
          categoryId: "cat-style",
          bindingId: "bind-style",
        },
        {
          label: "Edited",
          positive: "local edited prompt",
          negative: "local edited negative",
          sortOrder: 1,
          type: "custom",
        },
      ],
      loraConfig: {
        lora1: [
          {
            id: "lora-detached",
            path: "/preset-style.safetensors",
            weight: 0.75,
            enabled: true,
            source: "manual",
            detachedBindingId: "bind-style",
            detachedPresetPath: "/preset-style.safetensors",
            suppressed: true,
          },
        ],
        lora2: [
          {
            id: "lora-manual",
            path: "/manual.safetensors",
            weight: 1.25,
            enabled: true,
            source: "manual",
          },
        ],
      },
    },
  });

  assert.deepEqual(rows.promptBlocks.map((row) => ({
    type: row.type,
    templateSectionBindingId: row.templateSectionBindingId,
    customLabel: row.customLabel,
    customPositive: row.customPositive,
    customNegative: row.customNegative,
  })), [
    {
      type: "preset",
      templateSectionBindingId: "templateSectionPresetBinding:template-section-1:bind-style",
      customLabel: null,
      customPositive: null,
      customNegative: null,
    },
    {
      type: "custom",
      templateSectionBindingId: null,
      customLabel: "Edited",
      customPositive: "local edited prompt",
      customNegative: "local edited negative",
    },
  ]);
  assert.deepEqual(rows.manualLoraEntries.map((row) => ({
    templateSectionBindingId: row.templateSectionBindingId,
    stage: row.stage,
    path: row.path,
    weight: row.weight,
    enabled: row.enabled,
    detachedFromBindingKey: row.detachedFromBindingKey,
    detachedFromPresetId: row.detachedFromPresetId,
    detachedFromVariantId: row.detachedFromVariantId,
    detachedFromPath: row.detachedFromPath,
    metadata: row.metadata,
  })), [
    {
      templateSectionBindingId: null,
      stage: "lora1",
      path: "/preset-style.safetensors",
      weight: 0.75,
      enabled: false,
      detachedFromBindingKey: "bind-style",
      detachedFromPresetId: "preset-style",
      detachedFromVariantId: "variant-style",
      detachedFromPath: "/preset-style.safetensors",
      metadata: { suppressed: true },
    },
    {
      templateSectionBindingId: null,
      stage: "lora2",
      path: "/manual.safetensors",
      weight: 1.25,
      enabled: true,
      detachedFromBindingKey: null,
      detachedFromPresetId: null,
      detachedFromVariantId: null,
      detachedFromPath: null,
      metadata: null,
    },
  ]);
});

test("importing a template section plans section relation rows without legacy expanded section caches", () => {
  const style = category({ id: "cat-style", name: "Style" });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [{ id: "variant-style", name: "Default", prompt: "current preset prompt" }],
  });
  const binding = templateBinding({
    id: "template-binding-style",
    bindingKey: "bind-style",
    category: style,
    preset: stylePreset,
  });

  const sectionData = buildProjectSectionDataForTemplateImport({
    projectId: "project-1",
    sortOrder: 1,
    templateSection: {
      id: "template-section-1",
      name: "Imported",
      aspectRatio: "2:3",
      aspectRatios: ["2:3", "3:2"],
      shortSidePx: 768,
      batchSize: 4,
      seedPolicy1: "fixed",
      seedPolicy2: "random",
      ksampler1: { steps: 20 },
      ksampler2: null,
      upscaleFactor: 1.5,
      checkpointName: "model.safetensors",
      extraParams: { tiled: true },
    },
  });
  const rows = buildProjectSectionRowsForTemplateImport({
    projectSectionId: "section-imported",
    templateProjectPresetBindings: [],
    templatePresetBindings: [binding],
    templatePromptBlocks: [
      {
        id: "template-block-style",
        projectTemplateSectionId: "template-section-1",
        templateSectionBindingId: binding.id,
        type: "preset",
        customLabel: null,
        customPositive: null,
        customNegative: null,
        sortOrder: 0,
      },
    ],
    templateManualLoraEntries: [],
  });

  assert.equal("positivePrompt" in sectionData, false);
  assert.equal("negativePrompt" in sectionData, false);
  assert.equal("loraConfig" in sectionData, false);
  assert.deepEqual(sectionData.aspectRatios, ["2:3", "3:2"]);
  assert.deepEqual(rows.presetBindings.map((row) => row.bindingKey), ["bind-style"]);
  assert.deepEqual(rows.promptBlocks.map((row) => ({
    type: row.type,
    sectionBindingId: row.sectionBindingId,
    customPositive: row.customPositive,
  })), [
    {
      type: "preset",
      sectionBindingId: "sectionPresetBinding:section-imported:bind-style",
      customPositive: null,
    },
  ]);
  assert.equal("positive" in rows.promptBlocks[0], false);
  assert.equal(rows.manualLoraEntries.length, 0);
});

test("importing a template section reuses project-level binding rows for template project binding keys", () => {
  const style = category({ id: "cat-style", name: "Style" });
  const stylePreset = preset({
    id: "preset-style",
    categoryId: style.id,
    name: "Style",
    variants: [{ id: "variant-style", name: "Default", prompt: "current preset prompt" }],
  });
  const templateProjectBindingKey = `template-project:${style.id}`;
  const binding = templateBinding({
    id: "template-binding-project-style",
    bindingKey: templateProjectBindingKey,
    category: style,
    preset: stylePreset,
  });

  const rows = buildProjectSectionRowsForTemplateImport({
    projectSectionId: "section-imported",
    projectLevelBindings: [
      {
        categoryId: style.id,
        presetId: stylePreset.id,
        variantId: stylePreset.variants[0]?.id ?? null,
        sortOrder: 0,
      },
    ],
    templateProjectPresetBindings: [],
    templatePresetBindings: [binding],
    templatePromptBlocks: [
      {
        id: "template-block-style",
        projectTemplateSectionId: "template-section-1",
        templateSectionBindingId: binding.id,
        type: "preset",
        customLabel: null,
        customPositive: null,
        customNegative: null,
        sortOrder: 0,
      },
    ],
    templateManualLoraEntries: [],
  });

  assert.deepEqual(rows.presetBindings.map((row) => row.bindingKey), [templateProjectBindingKey]);
  assert.deepEqual(rows.promptBlocks.map((row) => row.sectionBindingId), [
    `sectionPresetBinding:section-imported:${templateProjectBindingKey}`,
  ]);
});
