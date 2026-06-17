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
const oldScriptPrefix = ["character", "lora"].join("-") + ":";
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

type SourcePattern = {
  label: string;
  pattern: RegExp;
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

function findPatternHits(paths: string[], patterns: SourcePattern[]): ScanHit[] {
  const hits: ScanHit[] = [];

  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const lines = source.split(/\r?\n/);

    for (const { label, pattern } of patterns) {
      for (const [index, line] of lines.entries()) {
        if (pattern.test(line)) {
          hits.push({ path: relativePath(path), line: index + 1, token: label });
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

function sourceFilesFromRoots(...roots: string[]) {
  return roots.flatMap((root) => listTextFiles(join(repoRoot, root)));
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
  // Historical migration SQL and product docs are the explicit allowlist for removal notes.
  // Runtime code, schema, scripts, package scripts, API routes, and tests remain clean.
  return [...new Set([
    join(repoRoot, "package.json"),
    ...listTextFiles(join(repoRoot, "src")),
    ...listTextFiles(join(repoRoot, "scripts")),
    ...listTextFiles(join(repoRoot, "tests")),
    ...listTextFiles(join(repoRoot, "src", "generated")),
    ...listFiles(join(repoRoot, "prisma"), (path) => (
      ["schema.prisma", "schema.sqlite.prisma"].includes(relative(join(repoRoot, "prisma"), path))
    )),
  ])];
}

function trainingApiHandlerAndWorkerFiles() {
  return [
    ...listTextFiles(join(repoRoot, "src", "app", "api", "training"))
      .filter((path) => relativePath(path).endsWith("/route.ts")),
    ...listTextFiles(join(repoRoot, "src", "server", "worker", "training")),
  ];
}

test("Training v2 runtime, package manifest, tests, schemas, and generated clients do not contain retired training identifiers", () => {
  const hits = findTokenHits(contractScopeFiles(), oldTokens);

  assert.deepEqual(
    compactHits(hits),
    { total: 0, firstHits: [] },
    "Retired Training v1 identifiers may only remain in historical migration SQL or Training v2 documentation/plans, not runtime, package scripts, tests, schemas, or generated clients.",
  );
});

test("Training v2 does not keep the retired API route tree or npm scripts", () => {
  const oldApiRouteRoot = join(repoRoot, "src", "app", "api", oldApiSlug);
  const oldApiRouteFiles = listTextFiles(join(repoRoot, "src", "app", "api"))
    .filter((path) => relativePath(path).split(/[\\/]/).includes(oldApiSlug))
    .map(relativePath);
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const oldScriptNames = Object.keys(packageJson.scripts ?? {})
    .filter((scriptName) => scriptName.startsWith(oldScriptPrefix))
    .sort();

  assert.equal(
    existsSync(oldApiRouteRoot),
    false,
    "The retired /api/... route tree must be fully removed from the Next app router.",
  );
  assert.deepEqual(
    oldApiRouteFiles,
    [],
    "No handler file may remain under the retired /api/... route tree.",
  );
  assert.deepEqual(
    oldScriptNames,
    [],
    "package.json must not expose retired npm script entrypoints.",
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

test("Training API handlers and worker runtime do not import legacy adapters or managed fallback entrypoints", () => {
  const forbiddenImports: SourcePattern[] = [
    {
      label: "former bridge adapter",
      pattern: new RegExp(`@/server/services/training/${escapeRegExp(oldAdapterBasename)}\\b`),
    },
    {
      label: "managed project fallback service",
      pattern: /@\/server\/services\/training\/project-service\b/,
    },
    {
      label: "design-demo training data fallback",
      pattern: /@\/app\/design-demos\/data\/lora-training\b/,
    },
  ];

  assert.deepEqual(
    compactHits(findPatternHits(trainingApiHandlerAndWorkerFiles(), forbiddenImports)),
    { total: 0, firstHits: [] },
    "Training API handlers and worker runtime must use Training-owned Prisma services directly instead of legacy adapters or managed JSON fallback entrypoints.",
  );
});

test("Training runtime services do not import the managed project-service fallback", () => {
  assert.deepEqual(
    compactHits(findPatternHits(trainingRuntimeFiles(), [
      {
        label: "managed project fallback service",
        pattern: /@\/server\/services\/training\/project-service\b/,
      },
    ])),
    { total: 0, firstHits: [] },
    "Training API routes, services, workers, repositories, and scripts must use Training-owned runtime modules instead of importing the managed project-service fallback.",
  );
});

test("Training runtime services do not persist primary resource state in data JSON files", () => {
  const forbiddenFileState: SourcePattern[] = [
    {
      label: "training JSON runtime state path",
      pattern: /data["'`]\s*,\s*["'`]training-[^"'`]+\.json["'`]/,
    },
    {
      label: "training JSON runtime read/write",
      pattern: /\b(?:readFile|writeFile|rename|mkdir)\b/,
    },
  ];
  const allowedFileRuntime = new Set([
    "src/server/services/training/project-actions-service.ts",
    "src/server/services/training/generation-output-service.ts",
    "src/server/worker/training/task-api.ts",
  ]);
  const runtimeFiles = trainingRuntimeFiles()
    .filter((path) => relativePath(path).startsWith("src/server/services/training/"))
    .filter((path) => !allowedFileRuntime.has(relativePath(path)));

  assert.deepEqual(
    compactHits(findPatternHits(runtimeFiles, forbiddenFileState)),
    { total: 0, firstHits: [] },
    "Training runtime resource state must live in Training-owned Prisma paths; JSON files may remain only for artifacts/uploads, not project/template/run ordering or visibility.",
  );
});

test("generation and training API route trees keep module-owned resource imports isolated", () => {
  const generationApiFiles = sourceFilesFromRoots(
    "src/app/api/agent/projects",
    "src/app/api/agent/runs",
    "src/app/api/preset-library",
    "src/app/api/presets",
    "src/app/api/projects",
    "src/app/api/queue",
    "src/app/api/queue-data",
    "src/app/api/runs",
    "src/app/api/templates",
  );
  const trainingApiFiles = listTextFiles(join(repoRoot, "src", "app", "api", "training"));

  assert.deepEqual(
    compactHits(findPatternHits(generationApiFiles, [
      { label: "training service import", pattern: /@\/server\/services\/training\b/ },
      { label: "training repository import", pattern: /@\/server\/repositories\/training\b/ },
      { label: "training feature import", pattern: /@\/features\/training\b/ },
      { label: "training route source", pattern: /\/api\/training\b/ },
      { label: "training scene preset model", pattern: /\bTrainingSceneDescriptionPreset\b|trainingSceneDescriptionPreset\b/ },
    ])),
    { total: 0, firstHits: [] },
    "Generation-owned presets/projects/runs/templates/queue APIs must not import or route through training-owned resources.",
  );

  assert.deepEqual(
    compactHits(findPatternHits(trainingApiFiles, [
      { label: "generation project service import", pattern: /@\/server\/services\/project-service\b/ },
      { label: "generation template service import", pattern: /@\/server\/services\/template-service\b/ },
      { label: "generation preset query import", pattern: /@\/server\/services\/preset-query-service\b/ },
      { label: "generation project view repository import", pattern: /@\/server\/repositories\/project-view-repository\b/ },
      { label: "generation prompt-config import", pattern: /@\/server\/prompt-config\b/ },
      { label: "generation server-data import", pattern: /@\/lib\/server-data\b/ },
      { label: "generation action import", pattern: /@\/lib\/actions\/(?:project|template|preset)(?:-|\/|\b)/ },
    ])),
    { total: 0, firstHits: [] },
    "Training scene presets/templates/projects/runs APIs must not import generation-owned resources; shared models/settings remain outside this forbidden set.",
  );
});

test("generation page-data entrypoints keep Training-owned resources out of generation reads", () => {
  const generationPageDataFiles = [
    ...sourceFilesFromRoots(
      "src/app/assets/presets",
      "src/app/assets/templates",
      "src/app/projects",
      "src/app/queue",
      "src/app/api/agent/projects",
      "src/app/api/preset-library",
      "src/app/api/presets",
      "src/app/api/projects",
      "src/app/api/queue",
      "src/app/api/queue-data",
      "src/app/api/templates",
      "src/server/repositories/project-view-repository",
      "src/server/services",
    ),
    ...[
      "src/server/repositories/preset-view-repository.ts",
      "src/server/repositories/template-view-repository.ts",
      "src/server/repositories/queue-data-repository.ts",
      "src/server/repositories/project-repository.ts",
      "src/lib/server-data.ts",
    ]
      .map((path) => join(repoRoot, path))
      .filter(existsSync),
  ].filter((path) => !relativePath(path).startsWith("src/server/services/training/"));

  assert.deepEqual(
    compactHits(findPatternHits(generationPageDataFiles, [
      { label: "training service import", pattern: /@\/server\/services\/training\b/ },
      { label: "training repository import", pattern: /@\/server\/repositories\/training\b/ },
      { label: "training feature import", pattern: /@\/features\/training\b/ },
      { label: "training API route reference", pattern: /\/api\/training\b/ },
      { label: "training prisma model read", pattern: /\bprisma\.training[A-Z]|\bdb\.training[A-Z]|\btx\.training[A-Z]/ },
      { label: "training scene preset model", pattern: /\bTrainingSceneDescriptionPreset\b|trainingSceneDescriptionPreset\b/ },
    ])),
    { total: 0, firstHits: [] },
    "Generation page/API data for presets, projects, runs, and templates must not import Training-owned resources or query Training-owned Prisma models.",
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
