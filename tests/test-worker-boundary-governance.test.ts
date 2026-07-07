import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const workerBoundaryDocPath = "docs/worker-boundaries.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("worker boundary doc records generation payload and repository ownership", () => {
  assert.ok(existsSync(join(repoRoot, workerBoundaryDocPath)), `${workerBoundaryDocPath} should document worker ownership`);

  const doc = readSource(workerBoundaryDocPath);
  const docsIndex = readSource("docs/index.md");

  assert.match(doc, /src\/server\/worker\/payload-builder\.ts[\s\S]*owns generation prompt draft normalization/);
  assert.match(doc, /src\/server\/worker\/repository\.ts[\s\S]*owns generation run persistence/);
  assert.match(doc, /src\/server\/worker\/fallback-prompt-builder\.ts[\s\S]*last resort only/);
  assert.match(doc, /docs\/workflow\.api\.json[\s\S]*default standard workflow/);
  assert.match(doc, /Do not let repositories import payload builders/);
  assert.match(doc, /Do not call the fallback prompt builder from run-executor/);
  assert.match(docsIndex, /docs\/worker-boundaries\.md/, "documentation index should point agents to worker boundaries");
});

test("generation worker payload building stays separate from run persistence", () => {
  const payloadBuilder = readSource("src/server/worker/payload-builder.ts");
  const repository = readSource("src/server/worker/repository.ts");
  const runExecutor = readSource("src/server/services/run-executor.ts");

  for (const blockedImport of [
    "@/lib/db",
    "@/server/worker/repository",
    "@/server/worker/fallback-prompt-builder",
    "@/server/services/comfyui-service",
  ]) {
    assert.doesNotMatch(payloadBuilder, new RegExp(blockedImport.replaceAll("/", "\\/")), `payload builder should not import ${blockedImport}`);
  }

  for (const blockedImport of [
    "@/server/worker/payload-builder",
    "@/server/worker/fallback-prompt-builder",
    "@/server/services/comfyui-service",
  ]) {
    assert.doesNotMatch(repository, new RegExp(blockedImport.replaceAll("/", "\\/")), `repository should not import ${blockedImport}`);
  }

  assert.match(runExecutor, /import \{ buildComfyPromptDraft \} from "@\/server\/worker\/payload-builder"/);
  assert.match(runExecutor, /from "@\/server\/worker\/repository"/);
  assert.doesNotMatch(runExecutor, /fallback-prompt-builder/, "run-executor should not call fallback prompt construction directly");
});

test("fallback prompt builder remains a ComfyUI validation last resort", () => {
  const fallbackBuilder = readSource("src/server/worker/fallback-prompt-builder.ts");
  const comfyService = readSource("src/server/services/comfyui-service.ts");

  assert.match(fallbackBuilder, /export function buildFallbackPromptNodes/);
  assert.doesNotMatch(fallbackBuilder, /@\/lib\/db|@\/server\/worker\/repository/);
  assert.match(comfyService, /1\) explicit comfyPrompt in extraParams/);
  assert.match(comfyService, /2\) standard workflow\.api\.json/);
  assert.match(comfyService, /3\) built-in SDXL txt2img fallback/);
  assert.match(comfyService, /function shouldUseStandardWorkflow\(\)[\s\S]*return true;/);
  assert.match(comfyService, /const standardPrompt = await resolveStandardWorkflowPrompt\(promptDraft\);[\s\S]*apiPrompt = standardPrompt \?\? buildFallbackPromptNodes\(promptDraft\);/);
});
