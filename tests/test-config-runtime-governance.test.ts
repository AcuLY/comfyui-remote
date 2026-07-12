import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function normalizeRepositoryPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function read(path: string): string {
  const normalized = normalizeRepositoryPath(path);
  assert.ok(existsSync(normalized), `${normalized} must exist`);
  return readFileSync(normalized, "utf8");
}

function outputLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => normalizeRepositoryPath(line.trim()))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function gitLsFiles(paths: readonly string[]): string[] {
  return outputLines(execFileSync("git", ["ls-files", "--", ...paths], { encoding: "utf8" }));
}

function listTreeFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTreeFiles(path));
    } else if (entry.isFile()) {
      files.push(normalizeRepositoryPath(path));
    }
  }

  return files;
}

function filesContaining(pattern: RegExp, roots: readonly string[]): string[] {
  const scannableExtensions = new Set([
    ".cjs",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".sh",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
  ]);
  const files = roots.flatMap(listTreeFiles).filter((path) => {
    const extension = /(?:\.[^./]+)$/.exec(path)?.[0].toLowerCase();
    return extension ? scannableExtensions.has(extension) : false;
  });

  return files
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .sort((left, right) => left.localeCompare(right));
}

function gitCheckIgnore(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", path]);
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("tracked runtime configuration claims have real source readers", () => {
  const targetExample = read("config/comfy-targets.example.json");
  const targetReader = read("src/server/services/comfy-target.ts");

  assert.doesNotThrow(() => JSON.parse(targetExample));
  assert.match(targetReader, /path\.resolve\(process\.cwd\(\), rawPath\)/);
  assert.match(targetReader, /readFileSync\(resolvedPath, "utf8"\)/);
  assert.match(targetReader, /process\.env\.COMFY_TARGET_CONFIG_PATH/);
});

test("configuration-owned workflow is read by current runtime source", () => {
  const workflowPath = "config/workflows/standard-workflow.api.json";
  const workflow = read(workflowPath);
  const runtimeReader = read("src/server/services/comfyui-service.ts");
  const builder = read("src/server/services/workflow-prompt-builder.ts");
  const apiDocs = read("docs/api/README.md");

  assert.doesNotThrow(() => JSON.parse(workflow));
  assert.match(runtimeReader, /"config",\s*"workflows",\s*"standard-workflow\.api\.json"/);
  assert.match(runtimeReader, /fs\.readFile\(filePath, "utf-8"\)/);
  assert.match(builder, /config\/workflows\/standard-workflow\.api\.json/);
  assert.match(apiDocs, new RegExp(escapeRegExp(workflowPath)));
  assert.doesNotMatch(runtimeReader, /docs[\\/]workflow\.api\.json/);

  // The legacy docs copy may remain during a safe production cutover. This contract
  // intentionally proves the current reader and does not require that copy to exist or not.
});

test("Hook manifest and recorder agree on namespaced local outputs", () => {
  const hooks = JSON.parse(read(".codex/hooks.json")) as {
    hooks: { PreToolUse: Array<{ hooks: Array<{ command: string; commandWindows: string }> }> };
  };
  const recorder = read("scripts/observability/agent_file_access_hook.py");
  const handler = hooks.hooks.PreToolUse[0]?.hooks[0];

  assert.ok(handler, "PreToolUse handler must exist");
  assert.match(handler.command, /scripts\/observability\/agent_file_access_hook\.py/);
  assert.match(handler.commandWindows, /scripts\/observability\/agent_file_access_hook\.py/);

  for (const path of [
    "logs/harness/agent-file-access.ndjson",
    "metrics/harness/agent-file-access.json",
  ]) {
    assert.match(recorder, new RegExp(escapeRegExp(path)));
    assert.equal(gitCheckIgnore(path), true, `${path} must stay ignored`);
  }
});

test("runtime-only paths are ignored and untracked with portable path comparisons", () => {
  assert.equal(normalizeRepositoryPath("metrics\\harness\\event.json"), "metrics/harness/event.json");
  assert.deepEqual(gitLsFiles(["data", "prisma/data", "logs", "metrics", ".tmp", ".deploy.lock"]), []);

  for (const ignoredPath of [
    ".deploy.lock/owner.json",
    ".next/cache/file",
    "data/comfyui.db",
    "prisma/data/comfyui.db",
    "logs/app.log",
    "logs/harness/agent-file-access.ndjson",
    "metrics/harness/agent-file-access.json",
    ".tmp/runtime.json",
    "server-dev-3000.log",
    "server-prod-3001.err.log",
    "build-prod-20260707.log",
  ]) {
    assert.equal(gitCheckIgnore(ignoredPath), true, `${ignoredPath} must be ignored`);
  }
});

test("tests do not use local runtime databases as fixtures", () => {
  const allowedContractReferences = new Set([
    "tests/README.md",
    "tests/test-collapse-preset-group-bindings.test.ts",
    "tests/test-config-runtime-governance.test.ts",
    "tests/test-prisma-provider-matrix-doc.test.ts",
    "tests/test-zero-redundancy-migration.test.ts",
  ]);
  const references = filesContaining(
    /(?:^|["'`\s])(?:prisma[\\/]+)?data[\\/]+comfyui\.db\b/,
    ["tests"],
  ).filter(
    (path) => !allowedContractReferences.has(path),
  );

  assert.deepEqual(references, []);
});
