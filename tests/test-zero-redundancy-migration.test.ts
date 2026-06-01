import { test } from "node:test";
import { strict as assert } from "node:assert";

import * as migrationModule from "../scripts/db/migrate-zero-redundancy";
import {
  buildZeroRedundancyMigrationPlan,
  formatZeroRedundancyMigrationSummary,
  migrationPlanExitCode,
  parseZeroRedundancyMigrationArgs,
  type ZeroRedundancyMigrationPlan,
  type ZeroRedundancyMigrationRows,
} from "../scripts/db/migrate-zero-redundancy";
import {
  collectZeroRedundancyVerification,
  formatZeroRedundancyVerification,
  parseZeroRedundancyVerifyArgs,
} from "../scripts/db/verify-zero-redundancy";

function rows(): ZeroRedundancyMigrationRows {
  return {
    projects: [
      {
        id: "project-1",
        presetBindings: [
          { categoryId: "cat-character", presetId: "preset-hero", variantId: "variant-hero" },
        ],
      },
    ],
    projectTemplates: [
      {
        id: "template-1",
        presetBindings: [
          { categoryId: "cat-style", presetId: "preset-style", variantId: "variant-style" },
        ],
      },
    ],
    presetCategories: [
      {
        id: "cat-character",
        name: "Character",
        color: "200 70% 50%",
        positivePromptOrder: 10,
        negativePromptOrder: 10,
        lora1Order: 10,
        lora2Order: 10,
        slotTemplate: null,
      },
      {
        id: "cat-style",
        name: "Style",
        color: null,
        positivePromptOrder: 20,
        negativePromptOrder: 20,
        lora1Order: 20,
        lora2Order: 20,
        slotTemplate: null,
      },
      {
        id: "cat-group",
        name: "Group",
        color: null,
        positivePromptOrder: 0,
        negativePromptOrder: 0,
        lora1Order: 0,
        lora2Order: 0,
        slotTemplate: [
          { slotKey: "character", categoryId: "cat-character" },
          { label: "Style slot", categoryId: "cat-style" },
        ],
      },
    ],
    presets: [
      { id: "preset-hero", categoryId: "cat-character", name: "Hero" },
      { id: "preset-style", categoryId: "cat-style", name: "Cinematic" },
    ],
    presetVariants: [
      {
        id: "variant-hero",
        presetId: "preset-hero",
        name: "Default",
        prompt: "hero prompt",
        negativePrompt: "hero negative",
        lora1: [{ path: "/hero.safetensors", weight: 0.8, enabled: true }],
        lora2: [],
        linkedVariants: [{ presetId: "preset-style", variantId: "variant-style" }],
        sortOrder: 0,
        isActive: true,
      },
      {
        id: "variant-style",
        presetId: "preset-style",
        name: "Default",
        prompt: "cinematic prompt",
        negativePrompt: "style negative",
        lora1: [{ path: "/style.safetensors", weight: 0.4, enabled: true }],
        lora2: [],
        linkedVariants: null,
        sortOrder: 0,
        isActive: true,
      },
    ],
    projectSections: [
      {
        id: "section-1",
        projectId: "project-1",
        positivePrompt: "orphan section positive",
        negativePrompt: null,
        loraConfig: {
          lora1: [
            {
              id: "legacy-linked-preset-clean",
              path: "/style.safetensors",
              weight: 0.4,
              enabled: true,
              source: "preset",
              bindingId: "bind-hero",
              sourceName: "Hero",
            },
            {
              id: "legacy-preset-clean",
              path: "/style.safetensors",
              weight: 0.4,
              enabled: true,
              source: "preset",
              bindingId: "bind-style",
              sourceName: "Cinematic",
            },
            {
              id: "legacy-detached",
              path: "/hero-local.safetensors",
              weight: 0.55,
              enabled: true,
              source: "manual",
              detachedBindingId: "bind-hero",
              detachedPresetPath: "/hero.safetensors",
              sourceName: "Hero",
            },
            {
              id: "legacy-manual",
              path: "/manual.safetensors",
              weight: 1.1,
              enabled: true,
              source: "manual",
            },
          ],
          lora2: [],
        },
      },
    ],
    promptBlocks: [
      {
        id: "legacy-clean-block",
        projectSectionId: "section-1",
        type: "preset",
        sourceId: "preset-hero",
        variantId: "variant-hero",
        categoryId: "cat-character",
        bindingId: "bind-hero",
        groupBindingId: null,
        label: "Hero",
        positive: "hero prompt, cinematic prompt",
        negative: "hero negative, style negative",
        sortOrder: 0,
      },
      {
        id: "legacy-edited-block",
        projectSectionId: "section-1",
        type: "preset",
        sourceId: "preset-style",
        variantId: "variant-style",
        categoryId: "cat-style",
        bindingId: "bind-style",
        groupBindingId: null,
        label: "Local Cinematic",
        positive: "local cinematic prompt",
        negative: "local negative",
        sortOrder: 1,
      },
    ],
    projectTemplateSections: [
      {
        id: "template-section-1",
        projectTemplateId: "template-1",
        promptBlocks: [
          {
            type: "preset",
            sourceId: "preset-style",
            variantId: "variant-style",
            categoryId: "cat-style",
            bindingId: "template-bind-style",
            groupBindingId: null,
            label: "Cinematic",
            positive: "cinematic prompt",
            negative: "style negative",
            sortOrder: 0,
          },
        ],
        loraConfig: {
          lora1: [
            {
              id: "template-preset-clean",
              path: "/style.safetensors",
              weight: 0.4,
              enabled: true,
              source: "preset",
              bindingId: "template-bind-style",
              sourceName: "Cinematic",
            },
            {
              id: "template-manual",
              path: "/template-manual.safetensors",
              weight: 0.7,
              enabled: true,
              source: "manual",
            },
          ],
          lora2: [],
        },
      },
    ],
  };
}

test("migration plan normalizes JSON refs, section prompt blocks, section LoRA, and template rows", () => {
  const plan = buildZeroRedundancyMigrationPlan(rows());

  assert.deepEqual(plan.projectPresetBindings, [
    {
      id: "projectPresetBinding:project-1:cat-character",
      projectId: "project-1",
      categoryId: "cat-character",
      presetId: "preset-hero",
      variantId: "variant-hero",
      sortOrder: 0,
    },
  ]);
  assert.deepEqual(plan.projectTemplatePresetBindings, [
    {
      id: "projectTemplatePresetBinding:template-1:cat-style",
      projectTemplateId: "template-1",
      categoryId: "cat-style",
      presetId: "preset-style",
      variantId: "variant-style",
      sortOrder: 0,
    },
  ]);
  assert.deepEqual(plan.presetVariantLinks, [
    {
      id: "presetVariantLink:variant-hero:variant-style",
      sourceVariantId: "variant-hero",
      linkedVariantId: "variant-style",
      sortOrder: 0,
    },
  ]);
  assert.deepEqual(plan.presetCategorySlots, [
    {
      id: "presetCategorySlot:cat-group:character",
      categoryId: "cat-group",
      slotKey: "character",
      slotCategoryId: "cat-character",
      label: null,
      sortOrder: 0,
    },
    {
      id: "presetCategorySlot:cat-group:Style slot",
      categoryId: "cat-group",
      slotKey: "Style slot",
      slotCategoryId: "cat-style",
      label: "Style slot",
      sortOrder: 1,
    },
  ]);

  assert.deepEqual(plan.sectionPresetBindings.map((binding) => binding.bindingKey), [
    "bind-hero",
    "bind-style",
  ]);
  assert.deepEqual(plan.sectionPromptBlocks, [
    {
      id: "sectionPromptBlock:section-1:bind-hero",
      projectSectionId: "section-1",
      sectionBindingId: "sectionPresetBinding:section-1:bind-hero",
      type: "preset",
      customLabel: null,
      customPositive: null,
      customNegative: null,
      sortOrder: 0,
    },
    {
      id: "sectionPromptBlock:section-1:bind-style",
      projectSectionId: "section-1",
      sectionBindingId: "sectionPresetBinding:section-1:bind-style",
      type: "preset",
      customLabel: "Local Cinematic",
      customPositive: "local cinematic prompt",
      customNegative: "local negative",
      sortOrder: 1,
    },
    {
      id: "sectionPromptBlock:section-1:legacy-section-prompt",
      projectSectionId: "section-1",
      sectionBindingId: null,
      type: "custom",
      customLabel: "Legacy section prompt",
      customPositive: "orphan section positive",
      customNegative: null,
      sortOrder: 2,
    },
  ]);
  assert.equal(
    plan.sectionManualLoraEntries.some((entry) => entry.path === "/style.safetensors"),
    false,
    "clean preset LoRA must remain derived from binding refs",
  );
  assert.deepEqual(
    plan.sectionManualLoraEntries.map((entry) => ({
      path: entry.path,
      sectionBindingId: entry.sectionBindingId,
      detachedFromBindingKey: entry.detachedFromBindingKey,
      detachedFromPresetId: entry.detachedFromPresetId,
      detachedFromVariantId: entry.detachedFromVariantId,
      detachedFromPath: entry.detachedFromPath,
    })),
    [
      {
        path: "/hero-local.safetensors",
        sectionBindingId: "sectionPresetBinding:section-1:bind-hero",
        detachedFromBindingKey: "bind-hero",
        detachedFromPresetId: "preset-hero",
        detachedFromVariantId: "variant-hero",
        detachedFromPath: "/hero.safetensors",
      },
      {
        path: "/manual.safetensors",
        sectionBindingId: null,
        detachedFromBindingKey: null,
        detachedFromPresetId: null,
        detachedFromVariantId: null,
        detachedFromPath: null,
      },
    ],
  );
  assert.deepEqual(plan.templateSectionPresetBindings.map((binding) => binding.bindingKey), [
    "template-bind-style",
  ]);
  assert.deepEqual(plan.templateSectionPromptBlocks, [
    {
      id: "templateSectionPromptBlock:template-section-1:template-bind-style",
      projectTemplateSectionId: "template-section-1",
      templateSectionBindingId: "templateSectionPresetBinding:template-section-1:template-bind-style",
      type: "preset",
      customLabel: null,
      customPositive: null,
      customNegative: null,
      sortOrder: 0,
    },
  ]);
  assert.deepEqual(plan.templateSectionManualLoraEntries.map((entry) => entry.path), [
    "/template-manual.safetensors",
  ]);
  assert.deepEqual(plan.summary, {
    sectionCount: 1,
    promptBlockCount: 4,
    presetBlockCount: 3,
    manualDetachedLoraCount: 3,
    templateSectionCount: 1,
    invalidJsonRowCount: 0,
    invalidReferenceCount: 0,
    resolverMismatchCount: 0,
    unmigratedLegacyPromptCount: 1,
  });
});

test("missing preset, category, or variant legacy preset blocks are preserved as custom rows without FK-bound bindings", () => {
  const fixture = rows();
  fixture.promptBlocks = [
    ...(fixture.promptBlocks ?? []),
    {
      id: "missing-preset",
      projectSectionId: "section-1",
      type: "preset",
      sourceId: "preset-missing",
      variantId: "variant-missing",
      categoryId: null,
      bindingId: "bind-missing-preset",
      groupBindingId: null,
      label: "Missing Preset",
      positive: "missing preset positive",
      negative: "missing preset negative",
      sortOrder: 2,
    },
    {
      id: "missing-category",
      projectSectionId: "section-1",
      type: "preset",
      sourceId: "preset-hero",
      variantId: "variant-hero",
      categoryId: "cat-missing",
      bindingId: "bind-missing-category",
      groupBindingId: null,
      label: "Missing Category",
      positive: "missing category positive",
      negative: "missing category negative",
      sortOrder: 3,
    },
    {
      id: "missing-variant",
      projectSectionId: "section-1",
      type: "preset",
      sourceId: "preset-hero",
      variantId: "variant-missing",
      categoryId: "cat-character",
      bindingId: "bind-missing-variant",
      groupBindingId: null,
      label: "Missing Variant",
      positive: "missing variant positive",
      negative: "missing variant negative",
      sortOrder: 4,
    },
  ];
  fixture.projectTemplateSections = fixture.projectTemplateSections?.map((section) => section.id === "template-section-1"
    ? {
        ...section,
        promptBlocks: [
          ...(Array.isArray(section.promptBlocks) ? section.promptBlocks : []),
          {
            id: "template-missing-preset",
            type: "preset",
            sourceId: "preset-missing",
            variantId: "variant-missing",
            categoryId: null,
            bindingId: "template-bind-missing-preset",
            groupBindingId: null,
            label: "Template Missing Preset",
            positive: "template missing positive",
            negative: "template missing negative",
            sortOrder: 1,
          },
        ],
      }
    : section);

  const plan = buildZeroRedundancyMigrationPlan(fixture);

  assert.equal(
    plan.sectionPresetBindings.some((binding) => binding.bindingKey.startsWith("bind-missing")),
    false,
  );
  assert.equal(
    plan.templateSectionPresetBindings.some((binding) => binding.bindingKey === "template-bind-missing-preset"),
    false,
  );
  assert.deepEqual(
    plan.sectionPromptBlocks
      .filter((block) => block.customLabel?.startsWith("Missing "))
      .map((block) => ({
        sectionBindingId: block.sectionBindingId,
        type: block.type,
        customLabel: block.customLabel,
        customPositive: block.customPositive,
        customNegative: block.customNegative,
      })),
    [
      {
        sectionBindingId: null,
        type: "custom",
        customLabel: "Missing Preset",
        customPositive: "missing preset positive",
        customNegative: "missing preset negative",
      },
      {
        sectionBindingId: null,
        type: "custom",
        customLabel: "Missing Category",
        customPositive: "missing category positive",
        customNegative: "missing category negative",
      },
      {
        sectionBindingId: null,
        type: "custom",
        customLabel: "Missing Variant",
        customPositive: "missing variant positive",
        customNegative: "missing variant negative",
      },
    ],
  );
  assert.deepEqual(
    plan.templateSectionPromptBlocks
      .filter((block) => block.customLabel === "Template Missing Preset")
      .map((block) => ({
        templateSectionBindingId: block.templateSectionBindingId,
        type: block.type,
        customLabel: block.customLabel,
        customPositive: block.customPositive,
        customNegative: block.customNegative,
      })),
    [
      {
        templateSectionBindingId: null,
        type: "custom",
        customLabel: "Template Missing Preset",
        customPositive: "template missing positive",
        customNegative: "template missing negative",
      },
    ],
  );
  assert.equal(plan.summary.unmigratedLegacyPromptCount, 5);
  assert.equal(plan.summary.resolverMismatchCount, 0);
});

test("migration plan is idempotent when generated rows already exist", () => {
  const first = buildZeroRedundancyMigrationPlan(rows());
  const second = buildZeroRedundancyMigrationPlan({
    ...rows(),
    existing: {
      projectPresetBindings: first.projectPresetBindings,
      projectTemplatePresetBindings: first.projectTemplatePresetBindings,
      presetVariantLinks: first.presetVariantLinks,
      presetCategorySlots: first.presetCategorySlots,
      sectionPresetBindings: first.sectionPresetBindings,
      sectionPromptBlocks: first.sectionPromptBlocks,
      sectionManualLoraEntries: first.sectionManualLoraEntries,
      templateSectionPresetBindings: first.templateSectionPresetBindings,
      templateSectionPromptBlocks: first.templateSectionPromptBlocks,
      templateSectionManualLoraEntries: first.templateSectionManualLoraEntries,
    },
  });

  assert.equal(second.projectPresetBindings.length, 0);
  assert.equal(second.projectTemplatePresetBindings.length, 0);
  assert.equal(second.presetVariantLinks.length, 0);
  assert.equal(second.presetCategorySlots.length, 0);
  assert.equal(second.sectionPresetBindings.length, 0);
  assert.equal(second.sectionPromptBlocks.length, 0);
  assert.equal(second.sectionManualLoraEntries.length, 0);
  assert.equal(second.templateSectionPresetBindings.length, 0);
  assert.equal(second.templateSectionPromptBlocks.length, 0);
  assert.equal(second.templateSectionManualLoraEntries.length, 0);
});

test("existing rows with the same key are still planned when writable fields drift", () => {
  const first = buildZeroRedundancyMigrationPlan(rows());
  const staleSectionBinding = {
    ...first.sectionPresetBindings[0],
    presetId: "preset-style",
    variantId: "variant-style",
  };
  const stalePromptBlock = {
    ...first.sectionPromptBlocks[1],
    customPositive: "stale prompt",
  };
  const second = buildZeroRedundancyMigrationPlan({
    ...rows(),
    existing: {
      projectPresetBindings: first.projectPresetBindings,
      projectTemplatePresetBindings: first.projectTemplatePresetBindings,
      presetVariantLinks: first.presetVariantLinks,
      presetCategorySlots: first.presetCategorySlots,
      sectionPresetBindings: [staleSectionBinding, ...first.sectionPresetBindings.slice(1)],
      sectionPromptBlocks: [first.sectionPromptBlocks[0], stalePromptBlock, ...first.sectionPromptBlocks.slice(2)],
      sectionManualLoraEntries: first.sectionManualLoraEntries,
      templateSectionPresetBindings: first.templateSectionPresetBindings,
      templateSectionPromptBlocks: first.templateSectionPromptBlocks,
      templateSectionManualLoraEntries: first.templateSectionManualLoraEntries,
    },
  });

  assert.deepEqual(second.sectionPresetBindings, [first.sectionPresetBindings[0]]);
  assert.deepEqual(second.sectionPromptBlocks, [first.sectionPromptBlocks[1]]);

  const sectionPair = second.verificationPairs.find((pair) => pair.kind === "section" && pair.id === "section-1");
  assert.ok(sectionPair);
  assert.deepEqual(
    sectionPair.resolved.promptBlocks
      .filter((block) => block.bindingId === "bind-style")
      .map((block) => block.positive),
    ["local cinematic prompt"],
  );
  assert.equal(second.summary.resolverMismatchCount, 0);
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof second) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;
  assert.doesNotThrow(() => assertCanWrite?.(second));
});

test("existing section binding ids are reused by planned child rows and verification rows", () => {
  const first = buildZeroRedundancyMigrationPlan(rows());
  const existingHeroBinding = {
    ...first.sectionPresetBindings.find((binding) => binding.bindingKey === "bind-hero")!,
    id: "old-section-binding-hero",
    presetId: "preset-style",
    variantId: "variant-style",
  };
  const existingStyleBinding = {
    ...first.sectionPresetBindings.find((binding) => binding.bindingKey === "bind-style")!,
    id: "old-section-binding-style",
    sortOrder: 99,
  };
  const plan = buildZeroRedundancyMigrationPlan({
    ...rows(),
    existing: {
      sectionPresetBindings: [existingHeroBinding, existingStyleBinding],
    },
  });
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof plan) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;

  assert.deepEqual(
    plan.sectionPresetBindings.map((binding) => ({ id: binding.id, bindingKey: binding.bindingKey })),
    [
      { id: "old-section-binding-hero", bindingKey: "bind-hero" },
      { id: "old-section-binding-style", bindingKey: "bind-style" },
    ],
  );
  assert.deepEqual(
    plan.sectionPromptBlocks
      .filter((block) => block.sectionBindingId)
      .map((block) => ({ id: block.id, sectionBindingId: block.sectionBindingId })),
    [
      {
        id: "sectionPromptBlock:section-1:bind-hero",
        sectionBindingId: "old-section-binding-hero",
      },
      {
        id: "sectionPromptBlock:section-1:bind-style",
        sectionBindingId: "old-section-binding-style",
      },
    ],
  );
  assert.deepEqual(
    plan.sectionManualLoraEntries
      .filter((entry) => entry.detachedFromBindingKey === "bind-hero")
      .map((entry) => entry.sectionBindingId),
    ["old-section-binding-hero"],
  );
  assert.equal(plan.summary.resolverMismatchCount, 0);
  assert.doesNotThrow(() => assertCanWrite?.(plan));
});

test("existing template section binding ids are reused by planned child rows and verification rows", () => {
  const fixture = rows();
  fixture.projectTemplateSections = fixture.projectTemplateSections?.map((section) => section.id === "template-section-1"
    ? {
        ...section,
        loraConfig: {
          lora1: [
            ...(isRecordForTest(section.loraConfig) && Array.isArray(section.loraConfig.lora1)
              ? section.loraConfig.lora1
              : []),
            {
              id: "template-detached",
              path: "/template-style-local.safetensors",
              weight: 0.65,
              enabled: true,
              source: "manual",
              bindingId: "template-bind-style",
              detachedBindingId: "template-bind-style",
            },
          ],
          lora2: [],
        },
      }
    : section);
  const first = buildZeroRedundancyMigrationPlan(fixture);
  const existingTemplateBinding = {
    ...first.templateSectionPresetBindings.find((binding) => binding.bindingKey === "template-bind-style")!,
    id: "old-template-section-binding-style",
    sortOrder: 42,
  };
  const plan = buildZeroRedundancyMigrationPlan({
    ...fixture,
    existing: {
      templateSectionPresetBindings: [existingTemplateBinding],
    },
  });
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof plan) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;

  assert.deepEqual(
    plan.templateSectionPresetBindings.map((binding) => ({ id: binding.id, bindingKey: binding.bindingKey })),
    [{ id: "old-template-section-binding-style", bindingKey: "template-bind-style" }],
  );
  assert.deepEqual(
    plan.templateSectionPromptBlocks
      .filter((block) => block.templateSectionBindingId)
      .map((block) => ({ id: block.id, templateSectionBindingId: block.templateSectionBindingId })),
    [
      {
        id: "templateSectionPromptBlock:template-section-1:template-bind-style",
        templateSectionBindingId: "old-template-section-binding-style",
      },
    ],
  );
  assert.deepEqual(
    plan.templateSectionManualLoraEntries
      .filter((entry) => entry.path === "/template-style-local.safetensors")
      .map((entry) => entry.templateSectionBindingId),
    ["old-template-section-binding-style"],
  );
  assert.equal(plan.summary.resolverMismatchCount, 0);
  assert.doesNotThrow(() => assertCanWrite?.(plan));
});

test("template rows contribute to summary counts and malformed template prompt JSON is counted once", () => {
  const fixture = rows();
  fixture.projectTemplateSections = [
    ...(fixture.projectTemplateSections ?? []),
    {
      id: "template-section-bad-json",
      projectTemplateId: "template-1",
      promptBlocks: "[{\"type\":\"custom\"",
      loraConfig: null,
    },
  ];

  const plan = buildZeroRedundancyMigrationPlan(fixture);

  assert.equal(plan.summary.promptBlockCount, 4);
  assert.equal(plan.summary.presetBlockCount, 3);
  assert.equal(plan.summary.invalidJsonRowCount, 1);
});

test("migration dry-run and verifier fail on invalid JSON even without resolver comparisons", () => {
  const plan = buildZeroRedundancyMigrationPlan({
    projectTemplateSections: [
      {
        id: "template-section-bad-json-only",
        projectTemplateId: "template-1",
        promptBlocks: "[{\"type\":\"custom\"",
        loraConfig: null,
      },
    ],
  });

  assert.equal(plan.summary.invalidJsonRowCount, 1);
  assert.equal(plan.summary.invalidReferenceCount, 0);
  assert.equal(plan.summary.resolverMismatchCount, 0);
  assert.equal(plan.verificationPairs.length, 0);
  assert.equal(migrationPlanExitCode(plan), 1);

  const report = collectZeroRedundancyVerification(plan.verificationPairs, {
    invalidJsonRowCount: plan.summary.invalidJsonRowCount,
    invalidReferenceCount: plan.summary.invalidReferenceCount,
  });

  assert.equal(report.summary.invalidJsonRowCount, 1);
  assert.equal(report.summary.invalidReferenceCount, 0);
  assert.equal(report.exitCode, 1);
  assert.match(formatZeroRedundancyVerification(report, "summary"), /invalid JSON rows: 1/);
});

test("write safety blocks malformed JSON before persistence", () => {
  const plan = buildZeroRedundancyMigrationPlan({
    ...rows(),
    projects: [
      ...(rows().projects ?? []),
      { id: "project-bad-json", presetBindings: "[{\"categoryId\":\"broken\"" },
    ],
  });
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof plan) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;

  assert.equal(plan.summary.invalidJsonRowCount, 1);
  assert.equal(plan.summary.resolverMismatchCount, 0);
  assert.throws(() => assertCanWrite?.(plan), /invalid JSON/i);
});

test("invalid refs are excluded from planned relation rows and block write", () => {
  const fixture = rows();
  fixture.projects = [
    { id: "project-invalid-category", presetBindings: [{ categoryId: "cat-missing", presetId: "preset-hero", variantId: "variant-hero" }] },
    { id: "project-invalid-preset", presetBindings: [{ categoryId: "cat-character", presetId: "preset-missing", variantId: null }] },
    { id: "project-invalid-variant", presetBindings: [{ categoryId: "cat-character", presetId: "preset-hero", variantId: "variant-style" }] },
    { id: "project-inactive-variant", presetBindings: [{ categoryId: "cat-character", presetId: "preset-hero", variantId: "variant-inactive" }] },
  ];
  fixture.projectTemplates = [
    { id: "template-invalid-category", presetBindings: [{ categoryId: "cat-missing", presetId: "preset-style", variantId: "variant-style" }] },
    { id: "template-invalid-preset", presetBindings: [{ categoryId: "cat-style", presetId: "preset-missing", variantId: null }] },
    { id: "template-invalid-variant", presetBindings: [{ categoryId: "cat-style", presetId: "preset-style", variantId: "variant-hero" }] },
  ];
  fixture.presetVariants = [
    {
      ...fixture.presetVariants![0],
      linkedVariants: [
        { variantId: "variant-missing" },
        { variantId: "variant-inactive" },
      ],
    },
    fixture.presetVariants![1],
    {
      id: "variant-inactive",
      presetId: "preset-style",
      name: "Inactive",
      prompt: "inactive prompt",
      negativePrompt: null,
      lora1: [],
      lora2: [],
      linkedVariants: null,
      sortOrder: 1,
      isActive: false,
    },
  ];
  fixture.presetCategories = [
    ...(fixture.presetCategories ?? []),
    {
      id: "cat-invalid-slot",
      name: "Invalid Slot",
      slotTemplate: [{ slotKey: "missing", categoryId: "cat-missing" }],
    },
  ];

  const plan = buildZeroRedundancyMigrationPlan(fixture);
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof plan) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;

  assert.equal(plan.projectPresetBindings.length, 0);
  assert.equal(plan.projectTemplatePresetBindings.length, 0);
  assert.equal(
    plan.presetVariantLinks.some((link) => ["variant-missing", "variant-inactive"].includes(link.linkedVariantId)),
    false,
  );
  assert.equal(plan.presetCategorySlots.some((slot) => slot.slotCategoryId === "cat-missing"), false);
  assert.equal((plan.summary as { invalidReferenceCount?: number }).invalidReferenceCount! >= 8, true);
  assert.throws(() => assertCanWrite?.(plan), /invalid reference/i);
});

test("clean preset LoRA without a reliable binding is not copied into manual rows", () => {
  const fixture = {
    ...rows(),
    projectSections: [
      {
        id: "section-lora-only",
        projectId: "project-1",
        loraConfig: {
          lora1: [
            {
              id: "orphan-preset-lora",
              path: "/hero.safetensors",
              weight: 0.8,
              enabled: true,
              source: "preset",
              bindingId: "orphan-binding",
              sourceName: "Hero",
            },
          ],
          lora2: [],
        },
      },
    ],
    promptBlocks: [],
    projectTemplateSections: [
      {
        id: "template-lora-only",
        projectTemplateId: "template-1",
        promptBlocks: [],
        loraConfig: {
          lora1: [
            {
              id: "template-orphan-preset-lora",
              path: "/style.safetensors",
              weight: 0.4,
              enabled: true,
              source: "preset",
              bindingId: "template-orphan-binding",
              sourceName: "Cinematic",
            },
          ],
          lora2: [],
        },
      },
    ],
  } satisfies ZeroRedundancyMigrationRows;

  const plan = buildZeroRedundancyMigrationPlan(fixture);
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof plan) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;

  assert.equal(plan.sectionManualLoraEntries.some((entry) => entry.path === "/hero.safetensors"), false);
  assert.equal(plan.templateSectionManualLoraEntries.some((entry) => entry.path === "/style.safetensors"), false);
  assert.equal((plan.summary as { invalidReferenceCount?: number }).invalidReferenceCount, 2);
  assert.throws(() => assertCanWrite?.(plan), /invalid reference/i);
});

test("inactive variant prompt blocks degrade to custom rows without resolver mismatches", () => {
  const fixture = rows();
  fixture.presetVariants = [
    ...(fixture.presetVariants ?? []),
    {
      id: "variant-inactive",
      presetId: "preset-hero",
      name: "Inactive",
      prompt: "inactive generated prompt",
      negativePrompt: "inactive generated negative",
      lora1: [],
      lora2: [],
      linkedVariants: null,
      sortOrder: 1,
      isActive: false,
    },
  ];
  fixture.projectSections = [{ id: "section-inactive", projectId: "project-1", loraConfig: null }];
  fixture.promptBlocks = [
    {
      projectSectionId: "section-inactive",
      type: "preset",
      sourceId: "preset-hero",
      variantId: "variant-inactive",
      categoryId: "cat-character",
      bindingId: "bind-inactive",
      label: "Inactive Hero",
      positive: "preserved inactive prompt",
      negative: "preserved inactive negative",
      sortOrder: 0,
    },
  ];
  fixture.projectTemplateSections = [];

  const plan = buildZeroRedundancyMigrationPlan(fixture);

  assert.equal(plan.sectionPresetBindings.some((binding) => binding.bindingKey === "bind-inactive"), false);
  assert.deepEqual(plan.sectionPromptBlocks.map((block) => ({
    sectionBindingId: block.sectionBindingId,
    type: block.type,
    customLabel: block.customLabel,
    customPositive: block.customPositive,
    customNegative: block.customNegative,
  })), [
    {
      sectionBindingId: null,
      type: "custom",
      customLabel: "Inactive Hero",
      customPositive: "preserved inactive prompt",
      customNegative: "preserved inactive negative",
    },
  ]);
  assert.equal(plan.summary.resolverMismatchCount, 0);
});

test("legacy custom prompt block ids stay unique when sortOrder collides", () => {
  const fixture = rows();
  fixture.projectSections = [{ id: "section-duplicate", projectId: "project-1", loraConfig: null }];
  fixture.promptBlocks = [
    { projectSectionId: "section-duplicate", type: "custom", positive: "first", sortOrder: 5 },
    { projectSectionId: "section-duplicate", type: "custom", positive: "second", sortOrder: 5 },
  ];
  fixture.projectTemplateSections = [
    {
      id: "template-duplicate",
      projectTemplateId: "template-1",
      promptBlocks: [
        { type: "custom", positive: "template first", sortOrder: 5 },
        { type: "custom", positive: "template second", sortOrder: 5 },
      ],
      loraConfig: null,
    },
  ];

  const plan = buildZeroRedundancyMigrationPlan(fixture);

  assert.deepEqual(plan.sectionPromptBlocks.map((block) => block.id), [
    "sectionPromptBlock:section-duplicate:legacy:5:0",
    "sectionPromptBlock:section-duplicate:legacy:5:1",
  ]);
  assert.deepEqual(plan.templateSectionPromptBlocks.map((block) => block.id), [
    "templateSectionPromptBlock:template-duplicate:legacy:5:0",
    "templateSectionPromptBlock:template-duplicate:legacy:5:1",
  ]);
});

test("write mode uses a transaction and fails fast for missing write models", async () => {
  const plan = buildZeroRedundancyMigrationPlan(rows());
  const writePlan = (migrationModule as {
    writeZeroRedundancyMigrationPlan?: (
      candidate: ZeroRedundancyMigrationPlan,
      options: { batchSize?: number; prisma: Record<string, unknown> },
    ) => Promise<void>;
  }).writeZeroRedundancyMigrationPlan;
  assert.equal(typeof writePlan, "function");

  const fake = createFakeWritePrisma();
  await writePlan!(plan, { batchSize: 2, prisma: fake });
  assert.equal(fake.transactionCalls, 1);
  assert.deepEqual(fake.transactionOptions, { maxWait: 30_000, timeout: 300_000 });
  assert.equal(fake.persisted.sectionPresetBinding.length > 0, true);
  assert.equal(fake.persisted.sectionPromptBlock.length > 0, true);

  const missingModelFake = createFakeWritePrisma({ missingModel: "sectionPromptBlock" });
  await assert.rejects(
    () => writePlan!(plan, { batchSize: 2, prisma: missingModelFake }),
    /sectionPromptBlock.*upsert/i,
  );
  assert.equal(missingModelFake.transactionCalls, 0);
  assert.deepEqual(missingModelFake.persisted, {});

  const failingFake = createFakeWritePrisma({ failOnModel: "sectionPromptBlock" });
  await assert.rejects(
    () => writePlan!(plan, { batchSize: 2, prisma: failingFake }),
    /forced sectionPromptBlock failure/i,
  );
  assert.equal(failingFake.transactionCalls, 1);
  assert.deepEqual(failingFake.persisted, {});
});

test("write mode is blocked before persistence when resolver mismatches remain", () => {
  const plan = buildZeroRedundancyMigrationPlan({
    ...rows(),
    existing: {
      sectionPromptBlocks: [
        {
          id: "sectionPromptBlock:section-1:legacy-section-prompt",
          projectSectionId: "section-1",
          sectionBindingId: null,
          type: "custom",
          customLabel: "Legacy section prompt",
          customPositive: "wrong persisted prompt",
          customNegative: null,
          sortOrder: 2,
        },
      ],
    },
  }, { verificationSource: "existing" });
  const assertCanWrite = (migrationModule as {
    assertZeroRedundancyMigrationPlanCanWrite?: (candidate: typeof plan) => void;
  }).assertZeroRedundancyMigrationPlanCanWrite;

  assert.equal(plan.summary.resolverMismatchCount > 0, true);
  assert.equal(typeof assertCanWrite, "function");
  assert.throws(() => assertCanWrite?.(plan), /resolver mismatch/i);
});

test("verifier reports structured diffs and honors allow-mismatch semantics", () => {
  const plan = buildZeroRedundancyMigrationPlan(rows());
  const okReport = collectZeroRedundancyVerification(plan.verificationPairs);

  assert.equal(okReport.summary.totalComparisons, 2);
  assert.equal(okReport.summary.mismatchCount, 0);
  assert.equal(okReport.exitCode, 0);

  const tampered = collectZeroRedundancyVerification(
    [
      {
        ...plan.verificationPairs[0],
        resolved: {
          ...plan.verificationPairs[0].resolved,
          promptBlocks: [
            {
              ...plan.verificationPairs[0].resolved.promptBlocks[0],
              positive: "wrong prompt",
            },
          ],
        },
      },
    ],
    { allowMismatch: false },
  );
  const allowed = collectZeroRedundancyVerification(tampered.comparisons, { allowMismatch: true });

  assert.equal(tampered.summary.mismatchCount, 1);
  assert.equal(tampered.exitCode, 1);
  assert.equal(tampered.comparisons[0].diffs[0].category, "prompt");
  assert.equal(allowed.exitCode, 0);
  assert.match(formatZeroRedundancyVerification(tampered, "summary"), /mismatches: 1/);
});

test("migration and verifier CLIs parse safe write/read-only flags", () => {
  assert.deepEqual(parseZeroRedundancyMigrationArgs(["--dry-run"]), {
    dryRun: true,
    readOnly: false,
    write: false,
    batchSize: 500,
    format: "summary",
  });
  assert.deepEqual(parseZeroRedundancyMigrationArgs(["--write", "--batch-size", "25", "--format=json"]), {
    dryRun: false,
    readOnly: false,
    write: true,
    batchSize: 25,
    format: "json",
  });
  assert.throws(() => parseZeroRedundancyMigrationArgs(["--write", "--read-only"]), /cannot be combined/i);
  assert.deepEqual(parseZeroRedundancyVerifyArgs(["--read-only", "--format", "json", "--allow-mismatch"]), {
    readOnly: true,
    format: "json",
    allowMismatch: true,
  });
  assert.match(formatZeroRedundancyMigrationSummary(buildZeroRedundancyMigrationPlan(rows()), "summary"), /sections: 1/);
});

function createFakeWritePrisma(options: {
  missingModel?: string;
  failOnModel?: string;
} = {}) {
  const modelNames = [
    "projectPresetBinding",
    "projectTemplatePresetBinding",
    "presetVariantLink",
    "presetCategorySlot",
    "sectionPresetBinding",
    "sectionPromptBlock",
    "sectionManualLoraEntry",
    "templateSectionPresetBinding",
    "templateSectionPromptBlock",
    "templateSectionManualLoraEntry",
  ];
  const fake = {
    transactionCalls: 0,
    transactionOptions: undefined as unknown,
    persisted: {} as Record<string, unknown[]>,
  } as Record<string, unknown> & {
    transactionCalls: number;
    transactionOptions: unknown;
    persisted: Record<string, unknown[]>;
    $transaction(callback: (tx: Record<string, unknown>) => Promise<void>, options?: unknown): Promise<void>;
  };
  const makeDelegates = (target: Record<string, unknown[]>) => {
    const delegates: Record<string, unknown> = {};
    for (const modelName of modelNames) {
      if (modelName === options.missingModel) continue;
      delegates[modelName] = {
        upsert: async (args: unknown) => {
          if (modelName === options.failOnModel) {
            throw new Error(`forced ${modelName} failure`);
          }
          target[modelName] = [...(target[modelName] ?? []), args];
        },
      };
    }
    return delegates;
  };

  Object.assign(fake, makeDelegates(fake.persisted));
  fake.$transaction = async (callback, transactionOptions) => {
    fake.transactionCalls += 1;
    fake.transactionOptions = transactionOptions;
    const staged: Record<string, unknown[]> = {};
    const tx = makeDelegates(staged);
    await callback(tx);
    fake.persisted = staged;
  };

  return fake;
}

function isRecordForTest(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
