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
  { model: "PresetVariantLink", parentScope: "sourceVariantId", role: "关联预设变体边" },
  { model: "ProjectPresetBinding", parentScope: "projectId", role: "项目级预设绑定" },
  {
    model: "ProjectTemplatePresetBinding",
    parentScope: "projectTemplateId",
    role: "模板级预设绑定",
  },
  { model: "SectionPresetBinding", parentScope: "projectSectionId", role: "分区预设绑定" },
  {
    model: "TemplateSectionPresetBinding",
    parentScope: "projectTemplateSectionId",
    role: "模板分区预设绑定",
  },
  { model: "SectionManualLoraEntry", parentScope: "projectSectionId", role: "分区手动 LoRA 条目" },
  {
    model: "TemplateSectionManualLoraEntry",
    parentScope: "projectTemplateSectionId",
    role: "模板分区手动 LoRA 条目",
  },
] as const;
const LEGACY_COMPATIBILITY_SURFACES = [
  {
    surface: "关联变体 JSON",
    ownerFields: "`PresetVariant.linkedVariants`",
    replacement: "`PresetVariantLink` 关系记录",
    decision: "已移除 schema 存储",
    guard: "`tests/test-zero-redundancy-preset-resolver.test.ts` 忽略旧版 JSON，并以关系记录为准",
  },
  {
    surface: "旧版项目分区提示词字段",
    ownerFields:
      "`ProjectSection.positivePrompt`, `ProjectSection.negativePrompt`, `ProjectSection.promptBlocks`, `ProjectSection.loraConfig`",
    replacement: "`SectionPromptBlock`、`SectionPresetBinding`、`SectionManualLoraEntry` 与不可变运行快照",
    decision: "已移除 schema 存储",
    guard: "`tests/test-zero-redundancy-no-legacy-fields.test.ts` 阻止在 schema 与运行时源码中重新引入这些字段",
  },
  {
    surface: "旧版模板分区提示词字段",
    ownerFields: "`ProjectTemplateSection.promptBlocks`, `ProjectTemplateSection.loraConfig`",
    replacement: "`TemplateSectionPromptBlock`、`TemplateSectionPresetBinding` 与 `TemplateSectionManualLoraEntry`",
    decision: "已移除 schema 存储",
    guard: "`tests/test-zero-redundancy-template-resolver.test.ts` 确保模板保存由关系记录支撑",
  },
  {
    surface: "已弃用的种子策略载荷",
    ownerFields: "解析器/快照兼容载荷中的单数 `seedPolicy`",
    replacement: "`seedPolicy1`, `seedPolicy2`",
    decision: "只读兼容输入",
    guard: "`tests/test-zero-redundancy-section-resolver.test.ts` 保留两阶段种子策略输出",
  },
  {
    surface: "旧版角色 LoRA 提示词值",
    ownerFields:
      "`TrainingCharacterProfile.loraUsagePrompt`, `TrainingCharacterProfile.characterDetailPrompt`, `TrainingGenerationTaskOutput.loraUsagePromptSnapshot`",
    replacement: "`loraUsagePromptGenerationTaskId`、`characterDetailPromptGenerationTaskId` 与任务输出快照",
    decision: "保留的活动训练数据",
    guard: "在后续批次拆分训练数据模型前，Training schema 字段保持跨提供方兼容",
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
    `\`${ownerDomain(model)}\``,
    `\`${POSTGRES_SCHEMA}\``,
    `\`${SQLITE_SCHEMA}\``,
    "PostgreSQL 与 SQLite 共享",
    "保持兼容；同时更新两个 schema，或记录提供方专属差异",
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
        return `\`${field.model}.${field.field}: 缺失\``;
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
    "PostgreSQL 使用 Prisma 枚举列；SQLite 存储等价字符串，并且必须同步值与默认值。",
  ].join(" | ");
}

function relationScopeRow(entry: (typeof RELATION_SCOPE_MODELS)[number]): string {
  const postgresDirectives = modelDirectives(POSTGRES_SCHEMA, entry.model);
  const sqliteDirectives = modelDirectives(SQLITE_SCHEMA, entry.model);
  const formatDirectives = (directives: string[]) =>
    directives.length === 0 ? "仅有记录 ID" : directives.map((directive) => `\`${directive}\``).join(", ");

  return [
    `\`${entry.model}\``,
    entry.role,
    `\`${entry.parentScope}\``,
    formatDirectives(postgresDirectives),
    formatDirectives(sqliteDirectives),
    "在各数据库提供方之间同步父级范围唯一性与查询索引。",
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
  "    - 变更 Prisma 模型或数据库提供方兼容性时",
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
  "# Prisma Schema 兼容性检查表",
  "",
  "本文件由 `scripts/docs/generate-prisma-schema-compatibility.ts` 生成。新增、删除或重命名 Prisma 模型后，请重新运行该脚本。",
  "",
  "## 共享模型",
  "",
  "| 模型 | 责任领域 | PostgreSQL schema | SQLite schema | 兼容状态 | 操作 |",
  "| --- | --- | --- | --- | --- | --- |",
  ...sharedModels.map((model) => `| ${row(model)} |`),
  "",
  "## 数据库提供方枚举映射",
  "",
  "| 枚举 | PostgreSQL 值 | PostgreSQL 字段 | SQLite 字段 | 兼容操作 |",
  "| --- | --- | --- | --- | --- |",
  ...enumRows.map((row) => `| ${row} |`),
  "",
  "## 关系范围与唯一性",
  "",
  "| 关系模型 | 作用 | 父级范围 | PostgreSQL 约束 | SQLite 约束 | 兼容操作 |",
  "| --- | --- | --- | --- | --- | --- |",
  ...relationScopeRows.map((row) => `| ${row} |`),
  "",
  "## 旧版兼容字段审计",
  "",
  "| 表面 | 原有字段 | 替代项或当前责任方 | 决策 | 防回退测试 |",
  "| --- | --- | --- | --- | --- |",
  ...legacyCompatibilityRows.map((row) => `| ${row} |`),
  "",
  "## 数据库提供方专属模型",
  "",
  postgresOnlyModels.length === 0 ? "- PostgreSQL 专属模型：无" : `- PostgreSQL 专属模型：${postgresOnlyModels.join(", ")}`,
  sqliteOnlyModels.length === 0 ? "- SQLite 专属模型：无" : `- SQLite 专属模型：${sqliteOnlyModels.join(", ")}`,
  "",
  "## 检查规则",
  "",
  "- 变更共享模型时，必须在同一批次更新 `prisma/schema.prisma` 与 `prisma/schema.sqlite.prisma`。",
  "- 合并前，必须确认本文件的“数据库提供方专属模型”章节已由生成器更新，并在对应 OpenSpec 变更或批次说明中记录无法由 schema 自动表达的差异。",
  "- schema 变更后，使用 `npm run prisma:generate:all` 重新生成两个客户端。",
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
