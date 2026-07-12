import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const POSTGRES_SCHEMA = "prisma/schema.prisma";
const SQLITE_SCHEMA = "prisma/schema.sqlite.prisma";
const OUTPUT_PATH = "docs/prisma-schema-compatibility.md";

type FieldReference = {
  model: string;
  field: string;
  type: string;
  attributes: string;
};

const RELATION_SCOPE_MODELS = [
  { model: "PresetVariantLink", parentScope: "sourceVariantId", role: "linked preset variant edge" },
  { model: "ProjectPresetBinding", parentScope: "projectId", role: "project-level preset binding" },
  {
    model: "ProjectTemplatePresetBinding",
    parentScope: "projectTemplateId",
    role: "template-level preset binding",
  },
  { model: "SectionPresetBinding", parentScope: "projectSectionId", role: "section preset binding" },
  {
    model: "TemplateSectionPresetBinding",
    parentScope: "projectTemplateSectionId",
    role: "template-section preset binding",
  },
  { model: "SectionManualLoraEntry", parentScope: "projectSectionId", role: "section manual LoRA entry" },
  {
    model: "TemplateSectionManualLoraEntry",
    parentScope: "projectTemplateSectionId",
    role: "template-section manual LoRA entry",
  },
] as const;
const LEGACY_COMPATIBILITY_SURFACES = [
  {
    surface: "linked variant JSON",
    ownerFields: "`PresetVariant.linkedVariants`",
    replacement: "`PresetVariantLink` relation rows",
    decision: "removed schema storage",
    guard: "`tests/test-zero-redundancy-preset-resolver.test.ts` ignores legacy JSON in favor of relation rows",
  },
  {
    surface: "legacy project section prompt fields",
    ownerFields:
      "`ProjectSection.positivePrompt`, `ProjectSection.negativePrompt`, `ProjectSection.promptBlocks`, `ProjectSection.loraConfig`",
    replacement: "`SectionPromptBlock`, `SectionPresetBinding`, `SectionManualLoraEntry`, and immutable run snapshots",
    decision: "removed schema storage",
    guard: "`tests/test-zero-redundancy-no-legacy-fields.test.ts` blocks schema and runtime source reintroduction",
  },
  {
    surface: "legacy template section prompt fields",
    ownerFields: "`ProjectTemplateSection.promptBlocks`, `ProjectTemplateSection.loraConfig`",
    replacement: "`TemplateSectionPromptBlock`, `TemplateSectionPresetBinding`, and `TemplateSectionManualLoraEntry`",
    decision: "removed schema storage",
    guard: "`tests/test-zero-redundancy-template-resolver.test.ts` keeps template saves relation-backed",
  },
  {
    surface: "deprecated seed policy payload",
    ownerFields: "`seedPolicy` singular in resolver/snapshot compatibility payloads",
    replacement: "`seedPolicy1`, `seedPolicy2`",
    decision: "read-only compatibility input",
    guard: "`tests/test-zero-redundancy-section-resolver.test.ts` preserves two-stage seed policy output",
  },
  {
    surface: "legacy character LoRA prompt values",
    ownerFields:
      "`TrainingCharacterProfile.loraUsagePrompt`, `TrainingCharacterProfile.characterDetailPrompt`, `TrainingGenerationTaskOutput.loraUsagePromptSnapshot`",
    replacement: "`loraUsagePromptGenerationTaskId`, `characterDetailPromptGenerationTaskId`, and task output snapshots",
    decision: "retained active training data",
    guard: "training schema fields stay provider-compatible until the training data model is split in a later batch",
  },
] as const;

function modelNames(schemaPath: string): string[] {
  return [...readFileSync(schemaPath, "utf8").matchAll(/^model\s+(\w+)\s*\{/gm)]
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));
}

function enumDefinitions(schemaPath: string): Map<string, string[]> {
  const source = readFileSync(schemaPath, "utf8");
  const enums = new Map<string, string[]>();

  for (const match of source.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^}/gm)) {
    const values = match[2]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
    enums.set(match[1], values);
  }

  return enums;
}

function modelFields(schemaPath: string): FieldReference[] {
  const source = readFileSync(schemaPath, "utf8");
  const fields: FieldReference[] = [];

  for (const modelMatch of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^}/gm)) {
    const model = modelMatch[1];
    for (const line of modelMatch[2].split("\n")) {
      const fieldMatch = line.trim().match(/^(\w+)\s+(\w+\??)\b(.*)$/);
      if (!fieldMatch) {
        continue;
      }
      fields.push({
        model,
        field: fieldMatch[1],
        type: fieldMatch[2],
        attributes: fieldMatch[3].trim(),
      });
    }
  }

  return fields;
}

function modelBlock(schemaPath: string, model: string): string {
  const source = readFileSync(schemaPath, "utf8");
  const match = source.match(new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^}`, "m"));
  if (!match) {
    throw new Error(`${schemaPath} missing model ${model}`);
  }
  return match[1];
}

function modelDirectives(schemaPath: string, model: string): string[] {
  return modelBlock(schemaPath, model)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("@@unique") || line.startsWith("@@index"));
}

function ownerDomain(model: string): string {
  if (model.startsWith("Training")) return "training";
  if (model.startsWith("Preset")) return "preset-library";
  if (model.startsWith("ProjectTemplate") || model.startsWith("Template")) return "template-library";
  if (model.startsWith("Project") || model.startsWith("Section") || model === "Run") return "generation-projects";
  if (model === "ImageResult" || model === "TrashRecord" || model === "CensoringTask") return "review-images";
  if (model === "LoraAsset") return "asset-library";
  if (model === "AuditLog" || model === "GpuTaskLock") return "operations";
  return "data-model";
}

function row(model: string): string {
  return [
    `\`${model}\``,
    ownerDomain(model),
    `\`${POSTGRES_SCHEMA}\``,
    `\`${SQLITE_SCHEMA}\``,
    "shared in PostgreSQL and SQLite",
    "keep-compatible; update both schemas or document provider-specific difference",
  ].join(" | ");
}

function enumMappingRow(
  enumName: string,
  values: string[],
  postgresFields: FieldReference[],
  sqliteFields: Map<string, FieldReference>,
): string {
  const postgresFieldNames = postgresFields.map((field) => `\`${field.model}.${field.field}\``).join(", ");
  const sqliteFieldNames = postgresFields
    .map((field) => {
      const sqliteField = sqliteFields.get(`${field.model}.${field.field}`);
      if (!sqliteField) {
        return `\`${field.model}.${field.field}: missing\``;
      }
      const defaultMatch = sqliteField.attributes.match(/@default\(([^)]+)\)/);
      const defaultText = defaultMatch ? ` @default(${defaultMatch[1]})` : "";
      return `\`${field.model}.${field.field}: ${sqliteField.type}${defaultText}\``;
    })
    .join(", ");

  return [
    `\`${enumName}\``,
    values.map((value) => `\`${value}\``).join(", "),
    postgresFieldNames,
    sqliteFieldNames,
    "PostgreSQL uses Prisma enum columns; SQLite stores equivalent strings and must keep values/defaults synchronized.",
  ].join(" | ");
}

function relationScopeRow(entry: (typeof RELATION_SCOPE_MODELS)[number]): string {
  const postgresDirectives = modelDirectives(POSTGRES_SCHEMA, entry.model);
  const sqliteDirectives = modelDirectives(SQLITE_SCHEMA, entry.model);
  const formatDirectives = (directives: string[]) =>
    directives.length === 0 ? "row id only" : directives.map((directive) => `\`${directive}\``).join(", ");

  return [
    `\`${entry.model}\``,
    entry.role,
    `\`${entry.parentScope}\``,
    formatDirectives(postgresDirectives),
    formatDirectives(sqliteDirectives),
    "Keep parent-scoped uniqueness and lookup indexes synchronized across providers.",
  ].join(" | ");
}

const postgresModels = modelNames(POSTGRES_SCHEMA);
const sqliteModels = modelNames(SQLITE_SCHEMA);
const sharedModels = postgresModels.filter((model) => sqliteModels.includes(model));
const postgresOnlyModels = postgresModels.filter((model) => !sqliteModels.includes(model));
const sqliteOnlyModels = sqliteModels.filter((model) => !postgresModels.includes(model));
const postgresEnums = enumDefinitions(POSTGRES_SCHEMA);
const postgresFields = modelFields(POSTGRES_SCHEMA);
const sqliteFields = new Map(modelFields(SQLITE_SCHEMA).map((field) => [`${field.model}.${field.field}`, field]));
const enumRows = [...postgresEnums.entries()].map(([enumName, values]) =>
  enumMappingRow(
    enumName,
    values,
    postgresFields.filter((field) => field.type === enumName),
    sqliteFields,
  ),
);
const relationScopeRows = RELATION_SCOPE_MODELS.map((entry) => relationScopeRow(entry));
const legacyCompatibilityRows = LEGACY_COMPATIBILITY_SURFACES.map((entry) =>
  [
    entry.surface,
    entry.ownerFields,
    entry.replacement,
    entry.decision,
    entry.guard,
  ].join(" | "),
);

const output = [
  "---",
  "schemaVersion: 1",
  "document:",
  "  type: architecture",
  "  status: current",
  "  owner: data-architecture",
  "  authority:",
  "    subject: prisma-schema-compatibility",
  "    kind: reference",
  "  readWhen:",
  "    - changing Prisma models or provider compatibility",
  "  sources:",
  "    - prisma/schema.prisma",
  "    - prisma/schema.sqlite.prisma",
  "    - scripts/docs/generate-prisma-schema-compatibility.ts",
  "  verifiedBy:",
  "    - npx tsx scripts/docs/generate-prisma-schema-compatibility.ts --check",
  "  generator: scripts/docs/generate-prisma-schema-compatibility.ts",
  "  inputs:",
  "    - prisma/schema.prisma",
  "    - prisma/schema.sqlite.prisma",
  "  regenerate: npx tsx scripts/docs/generate-prisma-schema-compatibility.ts",
  "  check: npx tsx scripts/docs/generate-prisma-schema-compatibility.ts --check",
  "---",
  "",
  "# Prisma Schema Compatibility Checklist",
  "",
  "Generated by `scripts/docs/generate-prisma-schema-compatibility.ts`. Re-run after adding, removing, or renaming Prisma models.",
  "",
  "## Shared Models",
  "",
  "| model | owner domain | PostgreSQL schema | SQLite schema | compatibility status | action |",
  "| --- | --- | --- | --- | --- | --- |",
  ...sharedModels.map((model) => `| ${row(model)} |`),
  "",
  "## Provider Enum Mapping",
  "",
  "| enum | PostgreSQL values | PostgreSQL fields | SQLite fields | compatibility action |",
  "| --- | --- | --- | --- | --- |",
  ...enumRows.map((row) => `| ${row} |`),
  "",
  "## Relation Scope And Uniqueness",
  "",
  "| relation model | role | parent scope | PostgreSQL constraints | SQLite constraints | compatibility action |",
  "| --- | --- | --- | --- | --- | --- |",
  ...relationScopeRows.map((row) => `| ${row} |`),
  "",
  "## Legacy Compatibility Field Audit",
  "",
  "| surface | owner fields | replacement or current owner | decision | guard |",
  "| --- | --- | --- | --- | --- |",
  ...legacyCompatibilityRows.map((row) => `| ${row} |`),
  "",
  "## Provider-Only Models",
  "",
  postgresOnlyModels.length === 0 ? "- PostgreSQL-only models: none" : `- PostgreSQL-only models: ${postgresOnlyModels.join(", ")}`,
  sqliteOnlyModels.length === 0 ? "- SQLite-only models: none" : `- SQLite-only models: ${sqliteOnlyModels.join(", ")}`,
  "",
  "## Checklist Rule",
  "",
  "- Shared model changes must update both `prisma/schema.prisma` and `prisma/schema.sqlite.prisma` in the same batch.",
  "- Provider-specific differences must be documented in `docs/prisma-provider-matrix.md` or in the batch notes before merging.",
  "- Regenerate both clients with `npm run prisma:generate:all` after schema changes.",
  "",
].join("\n");

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== "--check");
if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}

if (args.includes("--check")) {
  const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf8").replaceAll("\r\n", "\n") : null;
  if (current !== output) {
    console.error(`${OUTPUT_PATH} is stale; run npx tsx scripts/docs/generate-prisma-schema-compatibility.ts to regenerate it.`);
    process.exitCode = 1;
  }
} else {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, output);
}
