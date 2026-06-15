import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  WORK_MODE_RESOURCE_TARGETS,
  buildWorkModeResourceTargets,
} from "../src/lib/work-mode-resources";
import { inferWorkModeFromPathname, resolveWorkModeForPathname } from "../src/lib/work-mode";

const repoRoot = process.cwd();
const bottomNavSource = readFileSync(resolve(repoRoot, "src/components/persistent-bottom-nav.tsx"), "utf8");
const appShellSource = readFileSync(resolve(repoRoot, "src/components/app-shell.tsx"), "utf8");
const demoRoutesSource = readFileSync(resolve(repoRoot, "src/app/design-demos/routing/routes.ts"), "utf8");
const settingsPageSource = readFileSync(resolve(repoRoot, "src/app/design-demos/features/settings/settings-page.tsx"), "utf8");
const trainingShellSource = readFileSync(resolve(repoRoot, "src/features/training/shell.tsx"), "utf8");
const trainingRoutesSource = readFileSync(resolve(repoRoot, "src/features/training/routes.ts"), "utf8");
const trainingNotFoundSource = readFileSync(resolve(repoRoot, "src/features/training/not-found-page.tsx"), "utf8");
const trainingManifestSource = readFileSync(resolve(repoRoot, "src/app/api/training/route.ts"), "utf8");

const MODULE_OWNED_RESOURCE_KEYS = ["runs", "projects", "presets", "templates"] as const;
const SHARED_RESOURCE_KEYS = ["models", "settings"] as const;

function listSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function findMatchingSources(paths: string[], pattern: RegExp) {
  return paths
    .map((path) => ({ path, source: readFileSync(path, "utf8") }))
    .filter(({ source }) => pattern.test(source))
    .map(({ path }) => path.replace(`${repoRoot}/`, ""));
}

function sourceFilesFromRoots(...roots: string[]) {
  return roots.flatMap((root) => listSourceFiles(resolve(repoRoot, root)));
}

function renderLinesContaining(source: string, pattern: string) {
  return source
    .split("\n")
    .filter((line) => line.includes(pattern))
    .map((line) => line.trim());
}

test("work mode resource targets isolate generation and training-owned resources", () => {
  const generationTargets = buildWorkModeResourceTargets("generation");
  const trainingTargets = buildWorkModeResourceTargets("lora_training");

  for (const key of MODULE_OWNED_RESOURCE_KEYS) {
    assert.equal(
      generationTargets[key].owner,
      "generation",
      `${key} should be generation-owned in generation mode.`,
    );
    assert.equal(
      trainingTargets[key].owner,
      "lora_training",
      `${key} should be training-owned in LoRA training mode.`,
    );
    assert.equal(
      generationTargets[key].href.startsWith("/training/"),
      false,
      `${key} should not send generation users into training-owned routes.`,
    );
    assert.equal(
      ["/queue", "/projects", "/assets/presets", "/assets/templates"].some(
        (href) => trainingTargets[key].href === href || trainingTargets[key].href.startsWith(`${href}/`),
      ),
      false,
      `${key} should not send training users into generation-owned routes.`,
    );
  }

  for (const key of SHARED_RESOURCE_KEYS) {
    assert.equal(generationTargets[key].owner, "shared", `${key} should remain shared.`);
    assert.equal(trainingTargets[key].owner, "shared", `${key} should remain shared.`);
    assert.equal(
      generationTargets[key].href,
      trainingTargets[key].href,
      `${key} should use the same route from both work modes.`,
    );
  }
});

test("work mode inference treats the production training root as LoRA training-owned", () => {
  assert.equal(inferWorkModeFromPathname("/training"), "lora_training");
  assert.equal(
    resolveWorkModeForPathname("/training", "generation"),
    "lora_training",
    "the /training root must not fall back to a stored generation mode and expose generation-owned resources",
  );
});

test("work mode inference keeps generation preset group detail pages generation-owned", () => {
  assert.equal(inferWorkModeFromPathname("/assets/preset-groups/group-1"), "generation");
  assert.equal(
    resolveWorkModeForPathname("/assets/preset-groups/group-1", "lora_training"),
    "generation",
    "generation preset group detail pages must not inherit a stored training mode and expose training resources",
  );
  assert.deepEqual(
    buildWorkModeResourceTargets("generation").presets.activePrefix,
    ["/assets/presets", "/assets/preset-groups"],
    "generation preset navigation should own both preset and preset-group routes",
  );
});

test("module-owned frontend pages do not fetch the other module's resource APIs", () => {
  const generationPageFiles = sourceFilesFromRoots(
    "src/app/projects",
    "src/app/assets/presets",
    "src/app/assets/templates",
    "src/app/queue",
  );
  const trainingPageFiles = sourceFilesFromRoots("src/app/training", "src/features/training/ui");

  assert.deepEqual(
    findMatchingSources(generationPageFiles, /fetch\((?:`|")\/api\/training\b/),
    [],
    "Generation-owned pages must not fetch training-owned APIs.",
  );
  assert.deepEqual(
    findMatchingSources(trainingPageFiles, /fetch\((?:`|")\/api\/(?:projects|presets|templates|project-folders|preset-library|queue|runs)\b/),
    [],
    "Training-owned pages must not fetch generation-owned resource APIs; /api/models remains the shared exception.",
  );
});

test("module-owned frontend pages do not import or link to the other module's resources", () => {
  const generationPageFiles = sourceFilesFromRoots(
    "src/app/projects",
    "src/app/assets/presets",
    "src/app/assets/templates",
    "src/app/queue",
  );
  const trainingPageFiles = sourceFilesFromRoots("src/app/training", "src/features/training/ui");

  assert.deepEqual(
    findMatchingSources(
      generationPageFiles,
      /@\/features\/training|@\/server\/services\/training|@\/server\/repositories\/training|href=\{?["`]\/training\b|router\.push\(["`]\/training\b/,
    ),
    [],
    "Generation-owned pages must not import or link to training-owned resources.",
  );
  assert.deepEqual(
    findMatchingSources(
      trainingPageFiles,
      /@\/lib\/actions\/(?:project|template|template-crud|template-import|template-save)\b|@\/server\/services\/(?:project|template|preset-query-service|preset-section-replacement-service)\b|href=\{?["`]\/(?:projects|queue|assets\/presets|assets\/templates)\b|router\.push\(["`]\/(?:projects|queue|assets\/presets|assets\/templates)\b/,
    ),
    [],
    "Training-owned pages must not import or link to generation-owned projects, runs, presets, or templates.",
  );
});

test("module-owned API routes do not import the other module's resource services", () => {
  const generationApiFiles = sourceFilesFromRoots(
    "src/app/api/projects",
    "src/app/api/presets",
    "src/app/api/templates",
    "src/app/api/preset-library",
  );
  const trainingApiFiles = sourceFilesFromRoots("src/app/api/training");

  assert.deepEqual(
    findMatchingSources(generationApiFiles, /@\/server\/services\/training|@\/server\/repositories\/training|@\/features\/training/),
    [],
    "Generation-owned API routes must not import training-owned services.",
  );
  assert.deepEqual(
    findMatchingSources(trainingApiFiles, /@\/lib\/actions\/(?:project|template|template-crud|template-import|template-save)\b|@\/server\/services\/(?:project|template|preset-query-service|preset-section-replacement-service)\b/),
    [],
    "Training-owned API routes must not import generation-owned projects, templates, or preset services.",
  );
});

test("persistent production navigation consumes the shared work mode resource contract", () => {
  assert.match(
    bottomNavSource,
    /@\/lib\/work-mode-resources/,
    "Persistent navigation should not duplicate the work-mode resource boundary map locally.",
  );
  assert.doesNotMatch(
    bottomNavSource,
    /const modeAwareNavItems/,
    "Module-owned navigation targets should live in the shared resource contract.",
  );
  assert.doesNotMatch(
    bottomNavSource,
    /const sharedNavItems/,
    "Shared navigation targets should live in the shared resource contract.",
  );
});

test("production shell keeps generation task-panel resources out of training mode", () => {
  assert.match(
    appShellSource,
    /resolveWorkModeForPathname/,
    "The production shell should derive the active work mode from the current route.",
  );
  assert.match(
    appShellSource,
    /workMode === "generation" \? <TaskPanelContainer \/> : null/,
    "The legacy generation task panel should only render in generation mode.",
  );
  assert.deepEqual(
    renderLinesContaining(appShellSource, "<TaskPanelContainer"),
    ['{workMode === "generation" ? <TaskPanelContainer /> : null}'],
    "The task panel must not be mounted unconditionally, because it still owns generation/legacy task resources.",
  );
});

test("production training shell and routes expose only training-owned resources plus shared navigation", () => {
  assert.match(
    trainingShellSource,
    /buildWorkModeResourceTargetList\("lora_training"\)/,
    "Training navigation should be generated from the LoRA training resource contract.",
  );
  assert.doesNotMatch(
    trainingShellSource,
    /"generation"|["`]\/(?:assets\/presets|assets\/templates|queue|projects)\b/,
    "Training shell should not hard-code generation-owned resources.",
  );
  assert.doesNotMatch(
    trainingRoutesSource,
    /pattern:\s*["`]\/(?:assets\/presets|assets\/templates|queue|projects)\b/,
    "Training route matcher should not mount generation-owned resource routes.",
  );
  assert.match(trainingRoutesSource, /\/training\/runs/);
  assert.match(trainingRoutesSource, /\/training\/projects/);
  assert.match(trainingRoutesSource, /\/training\/presets/);
  assert.match(trainingRoutesSource, /\/training\/templates/);
});

test("design-demo shell navigation consumes the shared work mode resource contract", async () => {
  assert.match(
    demoRoutesSource,
    /@\/lib\/work-mode-resources/,
    "Design-demo shell navigation should not hand-maintain a second resource ownership map.",
  );

  const { buildWorkModeNavLinks, normalizeProductRoute } = await import("../src/app/design-demos/routing/routes");
  const generationLinks = buildWorkModeNavLinks("generation");
  const trainingLinks = buildWorkModeNavLinks("lora_training");

  for (const key of MODULE_OWNED_RESOURCE_KEYS) {
    const generationTarget = WORK_MODE_RESOURCE_TARGETS.generation[key];
    const trainingTarget = WORK_MODE_RESOURCE_TARGETS.lora_training[key];
    const generationLink = generationLinks.find((link) => link.label === generationTarget.label);
    const trainingLink = trainingLinks.find((link) => link.label === trainingTarget.label);

    assert.equal(
      generationLink?.href,
      normalizeProductRoute(generationTarget.href),
      `${generationTarget.label} should point to the generation-owned route in generation mode.`,
    );
    assert.equal(
      trainingLink?.href,
      trainingTarget.href,
      `${trainingTarget.label} should point to the training-owned route in LoRA training mode.`,
    );
  }

  for (const key of SHARED_RESOURCE_KEYS) {
    const generationTarget = WORK_MODE_RESOURCE_TARGETS.generation[key];
    const trainingTarget = WORK_MODE_RESOURCE_TARGETS.lora_training[key];
    const generationLink = generationLinks.find((link) => link.label === generationTarget.label);
    const trainingLink = trainingLinks.find((link) => link.label === trainingTarget.label);

    assert.equal(generationLink?.href, generationTarget.href);
    assert.equal(trainingLink?.href, trainingTarget.href);
  }
});

test("settings work-mode resource preview consumes the shared resource contract", () => {
  assert.match(
    settingsPageSource,
    /@\/lib\/work-mode-resources/,
    "Settings should preview resource destinations from the shared work-mode resource contract.",
  );
  assert.doesNotMatch(
    settingsPageSource,
    /MODE_ROUTE_ROWS/,
    "Settings should not maintain a second hand-written work-mode route table.",
  );
  assert.doesNotMatch(
    settingsPageSource,
    /route:\s*"\/(?:training|presets|projects|templates|runs)/,
    "Settings should not hard-code module-owned resource routes outside the shared contract.",
  );
});

test("training fallback navigation consumes the shared work mode resource contract", () => {
  assert.match(
    trainingNotFoundSource,
    /@\/lib\/work-mode-resources/,
    "Training fallback navigation should not hand-maintain module-owned resource routes.",
  );
  assert.doesNotMatch(
    trainingNotFoundSource,
    /const\s+TRAINING_ENTRY_ROUTES/,
    "Training fallback navigation should derive entries from the shared resource contract.",
  );
});

test("training manifest advertises only training-owned APIs plus shared resources", () => {
  for (const forbiddenPath of ["/api/projects", "/api/presets", "/api/templates", "/api/queue", "/api/runs"]) {
    assert.doesNotMatch(
      trainingManifestSource,
      new RegExp(forbiddenPath.replaceAll("/", "\\/")),
      `Training manifest should not advertise generation-owned ${forbiddenPath}.`,
    );
  }

  assert.match(trainingManifestSource, /\/api\/training\/projects/);
  assert.match(trainingManifestSource, /\/api\/training\/presets/);
  assert.match(trainingManifestSource, /\/api\/training\/templates/);
  assert.match(trainingManifestSource, /\/api\/training\/runs/);
  assert.match(trainingManifestSource, /\/api\/models\?kind=checkpoint/);
  assert.match(trainingManifestSource, /\/api\/models\?kind=lora/);
});

test("resource target contract documents every production resource owner", () => {
  assert.deepEqual(
    Object.keys(WORK_MODE_RESOURCE_TARGETS.generation),
    ["runs", "projects", "presets", "templates", "models", "settings"],
  );
  assert.deepEqual(
    Object.keys(WORK_MODE_RESOURCE_TARGETS.lora_training),
    ["runs", "projects", "presets", "templates", "models", "settings"],
  );
});
