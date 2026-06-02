import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const schemaFiles = ["prisma/schema.prisma", "prisma/schema.sqlite.prisma"] as const;

const legacySchemaFields = {
  PresetCategory: ["slotTemplate"],
  PresetVariant: ["linkedVariants"],
  Project: ["presetBindings"],
  ProjectTemplate: ["presetBindings"],
  ProjectSection: ["positivePrompt", "negativePrompt", "loraConfig", "promptBlocks"],
  ProjectTemplateSection: ["promptBlocks", "loraConfig"],
} as const;

const sourceRoots = ["src/app", "src/lib", "src/server", "src/scripts"] as const;
const sourceExtensions = new Set([".ts", ".tsx", ".mts"]);

const forbiddenSourcePatterns = [
  /\bPromptBlock\b/,
  /\bproject\.presetBindings\b/,
  /\btemplate\.presetBindings\b/,
  /\bprojectTemplate\.presetBindings\b/,
  /\bsection\.positivePrompt\b/,
  /\bsection\.negativePrompt\b/,
  /\bsection\.loraConfig\b/,
  /\bprojectSection\.positivePrompt\b/,
  /\bprojectSection\.negativePrompt\b/,
  /\bprojectSection\.loraConfig\b/,
  /\btemplateSection\.promptBlocks\b/,
  /\btemplateSection\.loraConfig\b/,
  /\bpresetBindings\s*:\s*true\b/,
  /\blinkedVariants\s*:\s*true\b/,
  /\bslotTemplate\s*:\s*true\b/,
  /\bpromptBlocks\s*:\s*\{\s*create\b/,
  /\bparseLegacy[A-Z]\w+\b/,
  /\breadLegacy[A-Z]\w+\b/,
  /\blegacyPromptBlocks\b/,
  /\blegacyLoraStageEntries\b/,
] as const;

test("Prisma schemas do not declare editable legacy redundancy storage", async () => {
  for (const schemaFile of schemaFiles) {
    const schema = await readFile(schemaFile, "utf8");
    assert.equal(/model PromptBlock\s+\{/.test(schema), false, `${schemaFile} removes PromptBlock`);

    for (const [modelName, fieldNames] of Object.entries(legacySchemaFields)) {
      const modelSource = readModelSource(schema, modelName, schemaFile);
      for (const fieldName of fieldNames) {
        assert.equal(
          new RegExp(`^\\s*${fieldName}\\s+`, "m").test(modelSource),
          false,
          `${schemaFile} ${modelName}.${fieldName} is removed`,
        );
      }
    }
  }
});

test("runtime source no longer reads or writes editable legacy redundancy fields", async () => {
  const violations: string[] = [];
  for (const file of await collectSourceFiles(sourceRoots)) {
    const source = await readFile(file, "utf8");
    for (const pattern of forbiddenSourcePatterns) {
      if (pattern.test(source)) {
        violations.push(`${file}: ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

function readModelSource(schema: string, modelName: string, schemaFile: string) {
  const match = schema.match(new RegExp(`model ${modelName} \\{\\n([\\s\\S]*?)\\n\\}`));
  assert.notEqual(match, null, `${modelName} exists in ${schemaFile}`);
  return match![1];
}

async function collectSourceFiles(roots: readonly string[]) {
  const files: string[] = [];
  for (const root of roots) {
    await collectFiles(root, files);
  }
  return files.sort();
}

async function collectFiles(dir: string, files: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}
