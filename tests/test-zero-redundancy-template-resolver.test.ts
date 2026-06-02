import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
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
