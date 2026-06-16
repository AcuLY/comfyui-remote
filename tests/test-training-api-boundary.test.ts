import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const textFileExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".prisma",
  ".sql",
  ".ts",
  ".tsx",
]);

const oldApiSlug = ["character", "lora", "training"].join("-");
const oldPascalPrefix = ["Character", "Lora"].join("");
const oldCamelPrefix = ["character", "Lora"].join("");
const oldProviderPrefix = ["Legacy", "Training"].join("");
const oldAdapterBasename = ["legacy", "compat", "service"].join("-");
const oldAdapterFilename = `${oldAdapterBasename}.ts`;
const oldTokens = [
  oldApiSlug,
  oldPascalPrefix,
  oldCamelPrefix,
  oldProviderPrefix,
];

type ScanHit = {
  line: number;
  path: string;
  token: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listFiles(root: string, includeFile: (path: string) => boolean): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listFiles(path, includeFile);
    return entry.isFile() && includeFile(path) ? [path] : [];
  });
}

function listTextFiles(root: string) {
  return listFiles(root, (path) => textFileExtensions.has(extname(path)));
}

function relativePath(path: string) {
  return relative(repoRoot, path);
}

function sourceContainsToken(source: string, token: string) {
  return source.includes(token);
}

function findTokenHits(paths: string[], tokens: string[]): ScanHit[] {
  const hits: ScanHit[] = [];

  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const lines = source.split(/\r?\n/);

    for (const token of tokens) {
      for (const [index, line] of lines.entries()) {
        if (sourceContainsToken(line, token)) {
          hits.push({ path: relativePath(path), line: index + 1, token });
        }
      }
    }
  }

  return hits.sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.line - right.line
    || left.token.localeCompare(right.token),
  );
}

function compactHits(hits: ScanHit[]) {
  return {
    total: hits.length,
    firstHits: hits.slice(0, 80),
  };
}

function trainingRuntimeFiles() {
  return [
    ...listTextFiles(join(repoRoot, "src", "app", "api", "training")),
    ...listTextFiles(join(repoRoot, "src", "server", "services", "training")),
    ...listTextFiles(join(repoRoot, "src", "server", "repositories", "training")),
    ...listTextFiles(join(repoRoot, "src", "server", "worker", "training")),
    ...listTextFiles(join(repoRoot, "scripts", "training")),
  ];
}

function contractScopeFiles() {
  return [...new Set([
    ...listTextFiles(join(repoRoot, "src")),
    ...listTextFiles(join(repoRoot, "scripts")),
    ...listTextFiles(join(repoRoot, "tests")),
    ...listTextFiles(join(repoRoot, "src", "generated")),
    ...listFiles(join(repoRoot, "prisma"), (path) => (
      ["schema.prisma", "schema.sqlite.prisma"].includes(relative(join(repoRoot, "prisma"), path))
    )),
  ])];
}

test("Training v2 runtime, tests, schemas, and generated clients do not contain retired training identifiers", () => {
  const hits = findTokenHits(contractScopeFiles(), oldTokens);

  assert.deepEqual(
    compactHits(hits),
    { total: 0, firstHits: [] },
    "Retired Training v1 identifiers may only remain in Training v2 documentation, not runtime, tests, schemas, or generated clients.",
  );
});

test("Training v2 no longer keeps the former bridge adapter", () => {
  const adapterPath = join(repoRoot, "src", "server", "services", "training", oldAdapterFilename);

  assert.equal(
    existsSync(adapterPath),
    false,
    "Training services should call Training-owned repositories and services directly; the former bridge adapter must be removed.",
  );
});

test("Training routes, services, repositories, workers, and scripts do not import former training modules", () => {
  const legacyImportPattern = new RegExp(
    [
      `from\\s+["'][^"']*(?:${escapeRegExp(oldApiSlug)}|${escapeRegExp(oldAdapterBasename)})`,
      `import\\([^)]*(?:${escapeRegExp(oldApiSlug)}|${escapeRegExp(oldAdapterBasename)})`,
      `@/server/(?:services|repositories)/[^"']*${escapeRegExp(oldApiSlug)}`,
      `@/server/services/training/${escapeRegExp(oldAdapterBasename)}`,
    ].join("|"),
  );

  const importHits = trainingRuntimeFiles()
    .map((path) => ({ path: relativePath(path), source: readFileSync(path, "utf8") }))
    .filter(({ source }) => legacyImportPattern.test(source))
    .map(({ path }) => path)
    .sort();

  assert.deepEqual(
    importHits,
    [],
    "Training runtime code and worker scripts must not import former modules or bridge adapters.",
  );
});

test("Training HTTP workflow keeps the agent-facing v2 operation spine", () => {
  const manifestSource = readFileSync(join(repoRoot, "src", "app", "api", "training", "route.ts"), "utf8");
  const requiredOperations = [
    "/api/training/projects",
    "/api/training/projects/:projectId/profile",
    "/api/training/projects/:projectId/sections",
    "/api/training/sections/:sectionId/blocks",
    "/api/training/sections/:sectionId/runs",
    "/api/training/worker/generation-tasks/:taskId/complete",
    "/api/training/image-results/:imageResultId/review",
    "/api/training/image-results/:imageResultId/caption",
    "/api/training/projects/:projectId/dataset-revisions",
    "/api/training/projects/:projectId/training-runs",
    "/api/training/worker/training-runs/:trainingRunId/progress",
    "/api/training/worker/training-runs/:trainingRunId/complete",
    "/api/training/training-runs/:trainingRunId/create-preset",
  ];

  for (const path of requiredOperations) {
    assert.match(
      manifestSource,
      new RegExp(escapeRegExp(path)),
      `GET /api/training should keep the agent workflow operation for ${path}.`,
    );
  }
});

test("Training schema code uses Training-owned model names for dedicated resources", () => {
  const schemaSources = listFiles(join(repoRoot, "prisma"), (path) => (
    ["schema.prisma", "schema.sqlite.prisma"].includes(relative(join(repoRoot, "prisma"), path))
  ))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const requiredModels = [
    "TrainingSceneDescriptionPresetCategory",
    "TrainingSceneDescriptionPresetFolder",
    "TrainingSceneDescriptionPreset",
    "TrainingTemplate",
    "TrainingTemplateSection",
    "TrainingTemplateSectionSceneDescriptionBlock",
  ];

  for (const model of requiredModels) {
    assert.match(schemaSources, new RegExp(`model\\s+${model}\\b`));
  }
});
