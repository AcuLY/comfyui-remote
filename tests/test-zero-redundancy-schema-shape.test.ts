import test from "node:test";
import assert from "node:assert/strict";
import {
  PRISMA_SCHEMA_PATHS,
  prismaSchemaDeclaresModel,
  readPrismaModelBlock,
} from "./fixtures/prisma-schema-source";

const schemaFiles = PRISMA_SCHEMA_PATHS;

const expectedModels = [
  "ProjectPresetBinding",
  "ProjectTemplatePresetBinding",
  "SectionPresetBinding",
  "SectionPromptBlock",
  "SectionManualLoraEntry",
  "TemplateSectionPresetBinding",
  "TemplateSectionPromptBlock",
  "TemplateSectionManualLoraEntry",
  "PresetVariantLink",
  "PresetCategorySlot",
] as const;

const parityModels = [
  "PresetCategory",
  "Preset",
  "PresetVariant",
  "ProjectTemplate",
  "ProjectTemplateSection",
  "Project",
  "ProjectSection",
  ...expectedModels,
] as const;

const removedLegacyEditableFields = {
  PresetCategory: ["slotTemplate"],
  PresetVariant: ["linkedVariants"],
  Project: ["presetBindings"],
  ProjectTemplate: ["presetBindings"],
  ProjectSection: ["positivePrompt", "negativePrompt", "loraConfig", "promptBlocks"],
  ProjectTemplateSection: ["promptBlocks", "loraConfig"],
} as const;

const forbiddenPromptBlockFields = [
  "label",
  "positive",
  "negative",
  "sourceId",
  "variantId",
  "categoryId",
  "bindingId",
  "groupBindingId",
] as const;

async function readSchemaModel(schemaFile: string, modelName: string) {
  return readPrismaModelBlock(schemaFile, modelName);
}

function assertModelDoesNotDeclareFields(modelSource: string, fieldNames: readonly string[]) {
  for (const fieldName of fieldNames) {
    assert.equal(
      new RegExp(`^\\s*${fieldName}\\s+`, "m").test(modelSource),
      false,
      `${fieldName} is not declared`,
    );
  }
}

function normalizeDeclaration(source: string) {
  return source
    .replace(/\s*\/\/[^\r\n]*$/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function collectModelDeclarations(modelSource: string) {
  return new Set(
    modelSource
      .split(/\r?\n/)
      .map((line) => normalizeDeclaration(line))
      .filter(Boolean),
  );
}

function assertModelDeclaresFields(modelSource: string, fields: readonly string[]) {
  const declarations = collectModelDeclarations(modelSource);

  for (const field of fields) {
    const normalizedField = normalizeDeclaration(field);
    assert.equal(declarations.has(normalizedField), true, `${field} is declared`);
  }
}

async function readSchemaModels(schemaFile: string, modelNames: readonly string[]) {
  const models = new Map<string, string>();

  for (const modelName of modelNames) {
    models.set(modelName, await readSchemaModel(schemaFile, modelName));
  }

  return models;
}

function normalizeSchemaProviderDifferences(modelSource: string) {
  return modelSource
    .replace(/\r\n/g, "\n")
    .replace(/\s*\/\/.*$/gm, "")
    .replace(/@db\.Text/g, "")
    .replace(/\bPromptBlockType\b/g, "String")
    .replace(/\bJobStatus\b/g, "String")
    .replace(/@default\(custom\)/g, '@default("custom")')
    .replace(/@default\(draft\)/g, '@default("draft")')
    .replace(/[ \t]+/g, " ")
    .replace(/ +$/gm, "")
    .trim();
}

for (const schemaFile of schemaFiles) {
  const isPostgres = schemaFile.endsWith("schema.prisma");

  test(`${schemaFile} declares zero-redundancy relation models`, async () => {
    for (const modelName of expectedModels) {
      await readSchemaModel(schemaFile, modelName);
    }
  });

  test(`${schemaFile} removes editable legacy redundancy storage`, async () => {
    assert.equal(prismaSchemaDeclaresModel(schemaFile, "PromptBlock"), false, "PromptBlock model is removed");

    for (const [modelName, fieldNames] of Object.entries(removedLegacyEditableFields)) {
      const modelSource = await readSchemaModel(schemaFile, modelName);
      assertModelDoesNotDeclareFields(modelSource, fieldNames);
    }
  });

  test(`${schemaFile} keeps source prompts and immutable run snapshots`, async () => {
    const presetVariant = await readSchemaModel(schemaFile, "PresetVariant");
    const run = await readSchemaModel(schemaFile, "Run");

    assertModelDeclaresFields(presetVariant, [
      isPostgres ? "prompt String @db.Text" : "prompt String",
      isPostgres ? "negativePrompt String? @db.Text" : "negativePrompt String?",
      "lora1 Json?",
      "lora2 Json?",
    ]);
    assertModelDeclaresFields(run, [
      "resolvedConfigSnapshot Json",
      "submittedPrompt Json?",
    ]);
  });

  test(`${schemaFile} stores the section-level two-stage KSampler switch by default`, async () => {
    const section = await readSchemaModel(schemaFile, "ProjectSection");
    const templateSection = await readSchemaModel(schemaFile, "ProjectTemplateSection");

    assertModelDeclaresFields(section, [
      "useTwoStageKSampler Boolean @default(true)",
    ]);
    assertModelDeclaresFields(templateSection, [
      "useTwoStageKSampler Boolean @default(true)",
    ]);
  });

  test(`${schemaFile} keeps new prompt blocks resolver-backed instead of copying legacy payloads`, async () => {
    const sectionPromptBlock = await readSchemaModel(schemaFile, "SectionPromptBlock");
    const templateSectionPromptBlock = await readSchemaModel(schemaFile, "TemplateSectionPromptBlock");

    assertModelDoesNotDeclareFields(sectionPromptBlock, forbiddenPromptBlockFields);
    assertModelDoesNotDeclareFields(templateSectionPromptBlock, forbiddenPromptBlockFields);

    assertModelDeclaresFields(sectionPromptBlock, [
      "sectionBindingId String? @unique",
      "customLabel String?",
      isPostgres ? "customPositive String? @db.Text" : "customPositive String?",
      isPostgres ? "customNegative String? @db.Text" : "customNegative String?",
      "sectionBinding SectionPresetBinding? @relation(fields: [projectSectionId, sectionBindingId], references: [projectSectionId, id], onDelete: Cascade)",
      "@@unique([projectSectionId, sectionBindingId])",
    ]);
    assertModelDeclaresFields(templateSectionPromptBlock, [
      "templateSectionBindingId String? @unique",
      "customLabel String?",
      isPostgres ? "customPositive String? @db.Text" : "customPositive String?",
      isPostgres ? "customNegative String? @db.Text" : "customNegative String?",
      "templateSectionBinding TemplateSectionPresetBinding? @relation(fields: [projectTemplateSectionId, templateSectionBindingId], references: [projectTemplateSectionId, id], onDelete: Cascade)",
      "@@unique([projectTemplateSectionId, templateSectionBindingId])",
    ]);
  });

  test(`${schemaFile} constrains binding preset and variant references with composite relations`, async () => {
    const preset = await readSchemaModel(schemaFile, "Preset");
    const presetVariant = await readSchemaModel(schemaFile, "PresetVariant");
    const projectBindingModels = await readSchemaModels(schemaFile, [
      "ProjectPresetBinding",
      "ProjectTemplatePresetBinding",
    ]);
    const sectionBindingModels = await readSchemaModels(schemaFile, [
      "SectionPresetBinding",
      "TemplateSectionPresetBinding",
    ]);

    assertModelDeclaresFields(preset, ["@@unique([categoryId, id])"]);
    assertModelDeclaresFields(presetVariant, ["@@unique([presetId, id])"]);

    for (const [modelName, modelSource] of projectBindingModels) {
      assertModelDeclaresFields(modelSource, [
        "presetId String",
        "variantId String?",
        "preset Preset @relation(fields: [categoryId, presetId], references: [categoryId, id], onDelete: Restrict)",
        "variant PresetVariant? @relation(fields: [presetId, variantId], references: [presetId, id], onDelete: Restrict)",
      ]);
      assert.equal(
        /@relation\(fields:\s*\[presetId\],\s*references:\s*\[id\]/.test(modelSource),
        false,
        `${modelName} does not relate preset by presetId alone`,
      );
      assert.equal(
        /@relation\(fields:\s*\[variantId\],\s*references:\s*\[id\]/.test(modelSource),
        false,
        `${modelName} does not relate variant by variantId alone`,
      );
    }

    for (const [modelName, modelSource] of sectionBindingModels) {
      assertModelDeclaresFields(modelSource, [
        "presetId String?",
        "variantId String?",
        "presetGroupId String?",
        "preset Preset? @relation(fields: [categoryId, presetId], references: [categoryId, id], onDelete: Restrict)",
        "variant PresetVariant? @relation(fields: [presetId, variantId], references: [presetId, id], onDelete: Restrict)",
        "presetGroup PresetGroup? @relation(fields: [presetGroupId], references: [id], onDelete: Restrict)",
      ]);
      assert.equal(
        /@relation\(fields:\s*\[presetId\],\s*references:\s*\[id\]/.test(modelSource),
        false,
        `${modelName} does not relate preset by presetId alone`,
      );
      assert.equal(
        /@relation\(fields:\s*\[variantId\],\s*references:\s*\[id\]/.test(modelSource),
        false,
        `${modelName} does not relate variant by variantId alone`,
      );
    }
  });

  test(`${schemaFile} constrains section children to same-parent bindings`, async () => {
    const sectionBinding = await readSchemaModel(schemaFile, "SectionPresetBinding");
    const templateBinding = await readSchemaModel(schemaFile, "TemplateSectionPresetBinding");
    const sectionPromptBlock = await readSchemaModel(schemaFile, "SectionPromptBlock");
    const templateSectionPromptBlock = await readSchemaModel(schemaFile, "TemplateSectionPromptBlock");
    const sectionLora = await readSchemaModel(schemaFile, "SectionManualLoraEntry");
    const templateLora = await readSchemaModel(schemaFile, "TemplateSectionManualLoraEntry");

    assertModelDeclaresFields(sectionBinding, ["@@unique([projectSectionId, id])"]);
    assertModelDeclaresFields(templateBinding, ["@@unique([projectTemplateSectionId, id])"]);
    assertModelDeclaresFields(sectionPromptBlock, [
      "sectionBinding SectionPresetBinding? @relation(fields: [projectSectionId, sectionBindingId], references: [projectSectionId, id], onDelete: Cascade)",
    ]);
    assertModelDeclaresFields(templateSectionPromptBlock, [
      "templateSectionBinding TemplateSectionPresetBinding? @relation(fields: [projectTemplateSectionId, templateSectionBindingId], references: [projectTemplateSectionId, id], onDelete: Cascade)",
    ]);
    assertModelDeclaresFields(sectionLora, [
      "sectionBinding SectionPresetBinding? @relation(fields: [projectSectionId, sectionBindingId], references: [projectSectionId, id], onDelete: Restrict)",
    ]);
    assertModelDeclaresFields(templateLora, [
      "templateSectionBinding TemplateSectionPresetBinding? @relation(fields: [projectTemplateSectionId, templateSectionBindingId], references: [projectTemplateSectionId, id], onDelete: Restrict)",
    ]);
  });

  test(`${schemaFile} gives section bindings stable keys and parent-scoped uniqueness`, async () => {
    const sectionBinding = await readSchemaModel(schemaFile, "SectionPresetBinding");
    const templateBinding = await readSchemaModel(schemaFile, "TemplateSectionPresetBinding");

    assertModelDeclaresFields(sectionBinding, [
      "bindingKey String",
      "groupBindingKey String?",
      "@@unique([projectSectionId, bindingKey])",
      "@@unique([projectSectionId, id])",
    ]);
    assertModelDeclaresFields(templateBinding, [
      "bindingKey String",
      "groupBindingKey String?",
      "@@unique([projectTemplateSectionId, bindingKey])",
      "@@unique([projectTemplateSectionId, id])",
    ]);
  });

  test(`${schemaFile} prevents duplicate category and project-level bindings`, async () => {
    const presetCategorySlot = await readSchemaModel(schemaFile, "PresetCategorySlot");
    const projectBinding = await readSchemaModel(schemaFile, "ProjectPresetBinding");
    const projectTemplateBinding = await readSchemaModel(schemaFile, "ProjectTemplatePresetBinding");

    assertModelDeclaresFields(presetCategorySlot, [
      "slotKey String",
      "@@unique([categoryId, slotKey])",
      "@@index([categoryId, sortOrder])",
      "@@index([slotCategoryId])",
    ]);
    assertModelDeclaresFields(projectBinding, [
      "@@unique([projectId, categoryId])",
      "@@index([projectId, sortOrder])",
    ]);
    assertModelDeclaresFields(projectTemplateBinding, [
      "@@unique([projectTemplateId, categoryId])",
      "@@index([projectTemplateId, sortOrder])",
    ]);
  });

  test(`${schemaFile} keeps linked variant relations non-redundant`, async () => {
    const presetVariantLink = await readSchemaModel(schemaFile, "PresetVariantLink");

    assertModelDoesNotDeclareFields(presetVariantLink, ["linkedPresetId"]);
    assertModelDeclaresFields(presetVariantLink, [
      "sourceVariantId String",
      "linkedVariantId String",
      "@@unique([sourceVariantId, linkedVariantId])",
    ]);
  });

  test(`${schemaFile} stores manual LoRA entries as paths with detach provenance`, async () => {
    const sectionLora = await readSchemaModel(schemaFile, "SectionManualLoraEntry");
    const templateLora = await readSchemaModel(schemaFile, "TemplateSectionManualLoraEntry");
    const expectedSectionFields = [
      "path String",
      "weight Float @default(1)",
      "enabled Boolean @default(true)",
      "detachedFromBindingKey String?",
      "detachedFromPresetId   String?",
      "detachedFromVariantId  String?",
      "detachedFromPath       String?",
      "metadata Json?",
    ];
    const expectedTemplateFields = [
      "path String",
      "weight Float @default(1)",
      "enabled Boolean @default(true)",
      "detachedFromBindingKey   String?",
      "detachedFromPresetId     String?",
      "detachedFromVariantId    String?",
      "detachedFromPath         String?",
      "metadata Json?",
    ];

    assertModelDeclaresFields(sectionLora, expectedSectionFields);
    assertModelDeclaresFields(templateLora, expectedTemplateFields);
  });
}

test("sqlite and postgres zero-redundancy models stay shape-compatible", async () => {
  const postgresModels = await readSchemaModels("prisma/schema.prisma", parityModels);
  const sqliteModels = await readSchemaModels("prisma/schema.sqlite.prisma", parityModels);

  for (const modelName of parityModels) {
    assert.equal(
      normalizeSchemaProviderDifferences(postgresModels.get(modelName)!),
      normalizeSchemaProviderDifferences(sqliteModels.get(modelName)!),
      `${modelName} stays in parity across postgres and sqlite schemas`,
    );
  }
});
