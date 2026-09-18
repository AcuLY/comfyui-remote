import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  listPrismaEnumDefinitions,
  listPrismaEnumFieldReferences,
  listPrismaModelDirectives,
  listPrismaModelNames,
} from "./fixtures/prisma-schema-source";

const POSTGRES_SCHEMA = "prisma/schema.prisma";
const SQLITE_SCHEMA = "prisma/schema.sqlite.prisma";
const COMPATIBILITY_DOC = "docs/prisma-schema-compatibility.md";
const RELATION_SCOPE_MODELS = [
  { model: "PresetVariantLink", parentScope: "sourceVariantId" },
  { model: "ProjectPresetBinding", parentScope: "projectId" },
  { model: "ProjectTemplatePresetBinding", parentScope: "projectTemplateId" },
  { model: "SectionPresetBinding", parentScope: "projectSectionId" },
  { model: "TemplateSectionPresetBinding", parentScope: "projectTemplateSectionId" },
  { model: "SectionManualLoraEntry", parentScope: "projectSectionId" },
  { model: "TemplateSectionManualLoraEntry", parentScope: "projectTemplateSectionId" },
] as const;
const LEGACY_COMPATIBILITY_SURFACES = [
  {
    surface: "关联变体 JSON",
    owner: "PresetVariant.linkedVariants",
    replacement: "PresetVariantLink",
    decision: "已移除 schema 存储",
  },
  {
    surface: "旧版项目分区提示词字段",
    owner: "ProjectSection.positivePrompt",
    replacement: "SectionPromptBlock",
    decision: "已移除 schema 存储",
  },
  {
    surface: "旧版模板分区提示词字段",
    owner: "ProjectTemplateSection.promptBlocks",
    replacement: "TemplateSectionPromptBlock",
    decision: "已移除 schema 存储",
  },
  {
    surface: "已弃用的种子策略载荷",
    owner: "seedPolicy",
    replacement: "seedPolicy1",
    decision: "只读兼容输入",
  },
  {
    surface: "旧版角色 LoRA 提示词值",
    owner: "TrainingCharacterProfile.loraUsagePrompt",
    replacement: "loraUsagePromptGenerationTaskId",
    decision: "保留的活动训练数据",
  },
] as const;

function parseChecklistRows() {
  const doc = readFileSync(COMPATIBILITY_DOC, "utf8");
  const sharedModelsSection = doc.split("## 共享模型")[1]?.split("\n## ")[0] ?? "";
  const rows = new Map<string, string[]>();

  for (const line of sharedModelsSection.split("\n")) {
    if (!line.startsWith("| `")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const model = cells[0]?.replace(/^`|`$/g, "");
    if (model) {
      rows.set(model, cells);
    }
  }

  return { doc, rows };
}

test("Prisma schema compatibility checklist covers every shared model", () => {
  const postgresModels = listPrismaModelNames(POSTGRES_SCHEMA);
  const sqliteModels = listPrismaModelNames(SQLITE_SCHEMA);
  const sharedModels = postgresModels.filter((model) => sqliteModels.includes(model)).sort();
  const { doc, rows } = parseChecklistRows();

  assert.match(
    doc,
    /\| 模型 \| 责任领域 \| PostgreSQL schema \| SQLite schema \| 兼容状态 \| 操作 \|/,
  );
  assert.equal(sharedModels.length, 54);
  assert.deepEqual(
    sharedModels.filter((model) => !rows.has(model)),
    [],
    "compatibility checklist must include every model shared by both Prisma schemas",
  );

  for (const model of sharedModels) {
    const row = rows.get(model);
    assert.ok(row, `${model} missing from compatibility checklist`);
    assert.equal(row[2], "`prisma/schema.prisma`", `${model} must point to PostgreSQL schema`);
    assert.equal(row[3], "`prisma/schema.sqlite.prisma`", `${model} must point to SQLite schema`);
    assert.match(row[4], /共享/, `${model} must be marked as shared`);
    assert.match(row[5], /保持兼容/, `${model} must have a keep-compatible action`);
  }
});

test("Prisma schema compatibility checklist is generated and indexed", () => {
  const checklist = readFileSync(COMPATIBILITY_DOC, "utf8");
  const index = readFileSync("docs/README.md", "utf8");

  assert.match(checklist, /本文件由 `scripts\/docs\/generate-prisma-schema-compatibility\.ts` 生成/);
  assert.match(index, /\[Prisma schema 兼容性\]\(prisma-schema-compatibility\.md\)/);
});

test("Prisma schema compatibility checklist documents PostgreSQL enum to SQLite string mappings", () => {
  const doc = readFileSync(COMPATIBILITY_DOC, "utf8");
  const postgresEnums = listPrismaEnumDefinitions(POSTGRES_SCHEMA);
  const enumReferences = listPrismaEnumFieldReferences(POSTGRES_SCHEMA, postgresEnums.keys());

  assert.match(doc, /## 数据库提供方枚举映射/);
  assert.equal(postgresEnums.size, 5);

  for (const [enumName, values] of postgresEnums) {
    assert.match(doc, new RegExp(`\\| \`${enumName}\` \\|`), `${enumName} missing from provider enum mapping`);

    for (const value of values) {
      assert.match(doc, new RegExp(`\`${value}\``), `${enumName} value ${value} missing from provider enum mapping`);
    }

    for (const fieldReference of enumReferences.get(enumName) ?? []) {
      assert.match(doc, new RegExp(`\`${fieldReference}\``), `${fieldReference} missing from provider enum mapping`);
      assert.match(
        doc,
        new RegExp(`\`${fieldReference}: String`),
        `${fieldReference} must document its SQLite String storage mapping`,
      );
    }
  }
});

test("Prisma schema compatibility checklist documents relation parent scopes and uniqueness", () => {
  const doc = readFileSync(COMPATIBILITY_DOC, "utf8");

  assert.match(doc, /## 关系范围与唯一性/);

  for (const { model, parentScope } of RELATION_SCOPE_MODELS) {
    assert.match(doc, new RegExp(`\\| \`${model}\` \\|`), `${model} missing from relation scope table`);
    assert.match(doc, new RegExp(`\`${parentScope}\``), `${model} must document parent scope ${parentScope}`);

    for (const schemaPath of [POSTGRES_SCHEMA, SQLITE_SCHEMA]) {
      for (const directive of listPrismaModelDirectives(schemaPath, model)) {
        assert.match(doc, new RegExp(`\`${directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``));
      }
    }
  }
});

test("Prisma schema compatibility checklist documents legacy field audit decisions", () => {
  const doc = readFileSync(COMPATIBILITY_DOC, "utf8");

  assert.match(doc, /## 旧版兼容字段审计/);

  for (const { surface, owner, replacement, decision } of LEGACY_COMPATIBILITY_SURFACES) {
    assert.match(doc, new RegExp(`\\| ${surface} \\|`), `${surface} missing from legacy compatibility audit`);
    assert.match(doc, new RegExp(owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${owner} missing from audit`);
    assert.match(doc, new RegExp(replacement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${replacement} missing from audit`);
    assert.match(doc, new RegExp(decision, "i"), `${surface} must document decision ${decision}`);
  }
});
