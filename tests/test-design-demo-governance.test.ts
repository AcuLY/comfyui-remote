import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const governanceDocPath = "docs/ui/design-demo-governance.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceFilesUnder(path: string): string[] {
  const absolutePath = join(repoRoot, path);
  if (!existsSync(absolutePath)) return [];

  return readdirSync(absolutePath).flatMap((entry) => {
    const childPath = join(path, entry);
    const childAbsolutePath = join(repoRoot, childPath);
    const stat = statSync(childAbsolutePath);
    if (stat.isDirectory()) return sourceFilesUnder(childPath);
    return /\.(tsx?|jsx?)$/.test(entry) ? [childPath] : [];
  });
}

test("design-demo governance doc classifies the app and source-of-truth boundaries", () => {
  assert.ok(existsSync(join(repoRoot, governanceDocPath)), `${governanceDocPath} should document design-demo ownership`);

  const doc = readSource(governanceDocPath);
  const docsIndex = readSource("docs/index.md");

  assert.match(doc, /Classification: active component lab and visual reference/);
  assert.match(doc, /src\/app\/design-demos\/routing\/routes\.ts[\s\S]*source of truth for design-demo navigation/);
  assert.match(doc, /src\/app\/design-demos\/routing\/header-specs\.ts[\s\S]*source of truth for route headers/);
  assert.match(doc, /src\/app\/design-demos\/data\/load-demo-data\.ts[\s\S]*owns design-demo data loading/);
  assert.match(doc, /src\/app\/design-demos\/data\/sqlite-source\.ts/);
  assert.match(doc, /src\/app\/design-demos\/data\/fallback-data\.ts/);
  assert.match(doc, /src\/app\/design-demos\/data\/local-image-files\.ts/);
  assert.match(doc, /src\/app\/design-demos\/data\/row-shaping\.ts/);
  assert.match(doc, /src\/app\/design-demos\/routing\/sfw\.ts/);
  assert.match(doc, /src\/app\/design-demos\/features\/lora-training/);
  assert.match(doc, /src\/features\/training/);
  assert.match(doc, /intentionally shared/);
  assert.match(doc, /Parity [Cc]hecklist/);
  assert.match(doc, /production route[\s\S]*design-demo route[\s\S]*owner[\s\S]*status[\s\S]*verification/);
  assert.match(doc, /Do not remove or archive duplicated demo components until parity is documented/);
  assert.match(docsIndex, /docs\/ui\/design-demo-governance\.md/, "documentation index should point agents to design-demo governance");
});

test("design-demo source files still expose the documented governance entrypoints", () => {
  const routesSource = readSource("src/app/design-demos/routing/routes.ts");
  const headerSpecsSource = readSource("src/app/design-demos/routing/header-specs.ts");
  const dataLoaderSource = readSource("src/app/design-demos/data/load-demo-data.ts");

  assert.match(routesSource, /export const ROUTES: RouteDef\[\]/, "route registry should remain explicit and importable");
  assert.match(routesSource, /export function buildWorkModeNavLinks/, "navigation should flow through the route registry");
  assert.match(headerSpecsSource, /import[\s\S]*ROUTES[\s\S]*from "\.\/"/, "header specs should consume the route registry");
  assert.match(headerSpecsSource, /export function buildHeaderSpecs/, "route headers should remain generated from header specs");
  assert.match(dataLoaderSource, /resolveSqlitePath\(\)/, "data loader should make the SQLite source explicit");
  assert.match(dataLoaderSource, /fallbackData\(/, "data loader should keep static fallback data explicit");
  assert.match(dataLoaderSource, /fallbackImages\(/, "data loader should keep local image fallback explicit");
  assert.match(dataLoaderSource, /sourceSummary\(/, "data loader should report source labels to the shell");
});

test("design-demo parity doc lists production pages that have demo counterparts", () => {
  const parityDoc = readSource("docs/design-demos-frontend-parity.md");
  const requiredTrainingRoutes = [
    "/training/runs",
    "/training/runs/generation/:taskId",
    "/training/runs/training/:trainingRunId",
    "/training/projects",
    "/training/projects/new",
    "/training/projects/:trainingProjectId",
    "/training/projects/:trainingProjectId/profile",
    "/training/projects/:trainingProjectId/sections",
    "/training/projects/:trainingProjectId/sections/:sectionId",
    "/training/projects/:trainingProjectId/sections/:sectionId/generation-tasks/new",
    "/training/projects/:trainingProjectId/results",
    "/training/projects/:trainingProjectId/dataset",
    "/training/projects/:trainingProjectId/dataset/revisions/:revisionId",
    "/training/projects/:trainingProjectId/training-runs",
    "/training/projects/:trainingProjectId/generation-tasks",
    "/training/presets",
    "/training/presets/new",
    "/training/presets/:presetId",
    "/training/presets/sort-rules",
    "/training/templates",
    "/training/templates/new",
    "/training/templates/:templateId/edit",
    "/training/templates/:templateId/sections/:sectionIndex",
  ];

  assert.match(
    parityDoc,
    /\| production route \| design-demo route \| owner \| status \| verification \|/,
    "parity doc should keep explicit checklist columns",
  );

  for (const route of requiredTrainingRoutes) {
    const demoRoute = `/design-demos${route}`;
    assert.match(
      parityDoc,
      new RegExp(`\\| \`${escapeRegExp(route)}\` \\| \`${escapeRegExp(demoRoute)}\``),
      `${route} should have a design-demo parity row`,
    );
  }
});

test("design-demo lora-training compatibility files keep shared production UI intentional", () => {
  const trainingDemoFiles = [
    ...sourceFilesUnder("src/app/design-demos/features/lora-training"),
    "src/app/design-demos/data/lora-training.ts",
  ];
  const productionTrainingImports = trainingDemoFiles.filter((path) => readSource(path).includes("@/features/training"));

  assert.ok(productionTrainingImports.length > 0, "design-demo training pages should document intentional shared production UI");
  for (const path of productionTrainingImports) {
    assert.match(
      readSource(path),
      /export \{[\s\S]*\} from "@\/features\/training\//,
      `${path} should keep production training reuse as a narrow re-export compatibility boundary`,
    );
  }
});
