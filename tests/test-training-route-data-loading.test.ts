import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

const nextConfigSource = readFileSync(resolve(repoRoot, "next.config.ts"), "utf8");
const trainingPageSource = readFileSync(resolve(repoRoot, "src/app/training/[[...route]]/page.tsx"), "utf8");
const trainingRouteLoaderSource = readFileSync(resolve(repoRoot, "src/features/training/load-route-data.ts"), "utf8");
const trainingSnapshotServiceSource = readFileSync(resolve(repoRoot, "src/server/services/training/snapshot-service.ts"), "utf8");
const trainingFeatureDataSource = readFileSync(resolve(repoRoot, "src/features/training/data.ts"), "utf8");
const trainingHeaderSpecsSource = readFileSync(resolve(repoRoot, "src/features/training/header-specs.ts"), "utf8");

function extractFunctionBody(source: string, name: string) {
  const declaration = source.indexOf(`function ${name}`);
  const exportedDeclaration = source.indexOf(`function ${name}`, source.indexOf(`export async function ${name}`));
  const start = declaration >= 0 ? declaration : exportedDeclaration;
  assert.notEqual(start, -1, `${name} should exist`);

  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1, `${name} should have a body`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(openBrace + 1, index);
    }
  }
  throw new Error(`${name} body was not closed`);
}

function extractTypeBlock(source: string, name: string) {
  const start = source.indexOf(`export type ${name} = {`);
  assert.notEqual(start, -1, `${name} should exist`);
  const openBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(openBrace + 1, index);
    }
  }
  throw new Error(`${name} type block was not closed`);
}

test("default dev config keeps Turbopack rooted at the project", () => {
  assert.match(
    nextConfigSource,
    /const projectRoot = dirname\(fileURLToPath\(import\.meta\.url\)\);/,
    "next.config.ts should derive the project root from its own file location.",
  );
  assert.match(
    nextConfigSource,
    /outputFileTracingRoot:\s*projectRoot/,
    "Next should not let an inferred tracing root override Turbopack's project root.",
  );
  assert.match(
    nextConfigSource,
    /turbopack:\s*\{[\s\S]*?root:\s*projectRoot/,
    "Turbopack dev should use the project root so npm run dev can stay on the default Turbopack path.",
  );
  assert.doesNotMatch(
    nextConfigSource,
    /root:\s*path\.join\(__dirname,\s*["']\.\.["']\)/,
    "Turbopack root should not be widened above the project directory.",
  );
});

test("training route page resolves the route before loading data", () => {
  assert.match(
    trainingPageSource,
    /const resolvedRoute = route \?\? \[\];/,
    "the route entry should normalize the optional catch-all route before data loading.",
  );
  assert.match(
    trainingPageSource,
    /loadTrainingRouteData\(resolvedRoute\)/,
    "the route entry should pass the normalized route to the training loader.",
  );
  assert.doesNotMatch(
    trainingPageSource,
    /loadTrainingRouteData\(\)/,
    "the route entry should not ask for an unscoped training snapshot.",
  );
});

test("training route loader selects route-aware data builders", () => {
  assert.match(
    trainingRouteLoaderSource,
    /export async function loadTrainingRouteData\(route: readonly string\[\] = \[\]\)/,
    "training route loader should accept the current route segments.",
  );
  assert.match(
    trainingRouteLoaderSource,
    /loadTrainingProjectsRouteData/,
    "project list routes should have a dedicated lightweight data builder.",
  );
  assert.match(
    trainingRouteLoaderSource,
    /loadTrainingProjectRouteData/,
    "project detail routes should load only the active project payload.",
  );
  assert.match(
    trainingRouteLoaderSource,
    /loadTrainingRunsRouteData/,
    "run list routes should use a dedicated runs payload.",
  );
  assert.doesNotMatch(
    trainingRouteLoaderSource,
    /loadTrainingSnapshot/,
    "route data loading should not fall back to the full snapshot service.",
  );
});

test("training project list data builder does not read full project detail collections", () => {
  const body = extractFunctionBody(trainingSnapshotServiceSource, "loadTrainingProjectsRouteData");

  for (const detailRead of [
    "listTrainingProjectSections",
    "listTrainingCandidateImages",
    "listTrainingDatasetRevisions",
    "listTrainingRuns",
  ]) {
    assert.doesNotMatch(
      body,
      new RegExp(`\\b${detailRead}\\b`),
      `/training/projects should not call ${detailRead} for every listed project.`,
    );
  }
});

test("training shell data no longer carries the full loraTraining payload", () => {
  const shellType = extractTypeBlock(trainingFeatureDataSource, "TrainingShellData");

  assert.doesNotMatch(
    shellType,
    /\bloraTraining\b/,
    "TrainingShellData should not expose the full loraTraining object to the shared shell.",
  );
  assert.doesNotMatch(
    trainingFeatureDataSource,
    /loraTraining,\s*\n\s*\};/,
    "buildTrainingShellData should not copy the full loraTraining object into shellData.",
  );
  assert.doesNotMatch(
    trainingHeaderSpecsSource,
    /data\.loraTraining/,
    "training header specs should read lightweight shell metadata instead of the full route payload.",
  );
});
