import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const RUNTIME_ASSET_DOC = "docs/runbooks/config-runtime-assets.md";
const DEFAULT_PUBLIC_SVGS = [
  "public/file.svg",
  "public/globe.svg",
  "public/next.svg",
  "public/vercel.svg",
  "public/window.svg",
] as const;

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, "utf8");
}

function gitLsFiles(paths: readonly string[]): string[] {
  const output = execFileSync("git", ["ls-files", ...paths], { encoding: "utf8" }).trim();
  return output ? output.split("\n").sort((left, right) => left.localeCompare(right)) : [];
}

function rgFiles(pattern: string, paths: readonly string[]): string[] {
  try {
    const output = execFileSync("rg", ["-l", pattern, ...paths], { encoding: "utf8" }).trim();
    return output
      ? output.split("\n").map((filePath) => filePath.replace(/\\/g, "/")).sort((left, right) => left.localeCompare(right))
      : [];
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gitCheckIgnore(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", path]);
    return true;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return false;
    throw error;
  }
}

test("runtime config runbook documents path maps, Comfy targets, generated code, and local DB decisions", () => {
  const doc = read(RUNTIME_ASSET_DOC);

  for (const requiredText of [
    "Classification: runbook",
    "config/path-maps.json",
    "loraCategories",
    "runtime-config",
    "config/comfy-targets.example.json",
    "COMFY_API_URL",
    "MODEL_BASE_DIR",
    "COMFY_LAUNCH_CMD",
    "sshHost",
    "tunnelAutoStart",
    "src/generated/**",
    "regenerate",
    "data/comfyui.db",
    "prisma/data/comfyui.db",
    "metrics/agent-file-access.json",
    "runtime data, not fixtures",
    "do not track",
  ]) {
    assert.match(doc, new RegExp(escapeRegExp(requiredText)), `${RUNTIME_ASSET_DOC} must mention ${requiredText}`);
  }
});

test("unused default public SVG assets are removed after source references are checked", () => {
  assert.deepEqual(gitLsFiles(DEFAULT_PUBLIC_SVGS), []);
  assert.deepEqual(rgFiles("(?:file|globe|next|vercel|window)\\.svg", ["src"]), []);
});

test("runtime-only directories and local DB files are ignored and untracked", () => {
  assert.deepEqual(gitLsFiles(["data", "prisma/data", "logs", "metrics", ".tmp", ".deploy.lock"]), []);

  for (const ignoredPath of [
    ".deploy.lock/owner.json",
    ".next/cache/file",
    "data/comfyui.db",
    "logs/app.log",
    "metrics/agent-file-access.json",
    ".tmp/runtime.json",
    "server-dev-3000.log",
    "server-dev-3000.err.log",
    "server-prod-3001.log",
    "server-prod-3001.err.log",
    "build-prod-20260707.log",
  ]) {
    assert.equal(gitCheckIgnore(ignoredPath), true, `${ignoredPath} must be ignored`);
  }
});

test("tests do not use local runtime DB files as fixtures", () => {
  const dbReferences = rgFiles("data/comfyui\\.db|prisma/data/comfyui\\.db", ["tests"]).filter(
    (filePath) =>
      ![
        "tests/README.md",
        "tests/test-config-runtime-governance.test.ts",
        "tests/test-collapse-preset-group-bindings.test.ts",
        "tests/test-prisma-provider-matrix-doc.test.ts",
        "tests/test-zero-redundancy-migration.test.ts",
      ].includes(filePath),
  );

  assert.deepEqual(dbReferences, []);
});
