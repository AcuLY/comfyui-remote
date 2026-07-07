import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  WORK_MODE_RESOURCE_TARGETS,
  buildWorkModeResourceTargets,
} from "../src/lib/work-mode-resources";
import * as WorkModeResources from "../src/lib/work-mode-resources";
import { inferWorkModeFromPathname, resolveWorkModeForPathname } from "../src/lib/work-mode";

const repoRoot = process.cwd();
const bottomNavSource = readFileSync(resolve(repoRoot, "src/components/persistent-bottom-nav.tsx"), "utf8");
const appShellSource = readFileSync(resolve(repoRoot, "src/components/app-shell.tsx"), "utf8");
const demoRoutesSource = readFileSync(resolve(repoRoot, "src/app/design-demos/routing/routes.ts"), "utf8");
const designDemoDataSource = readFileSync(resolve(repoRoot, "src/app/design-demos/data/load-demo-data.ts"), "utf8");
const settingsPageSource = readFileSync(resolve(repoRoot, "src/app/design-demos/features/settings/settings-page.tsx"), "utf8");
const trainingShellSource = readFileSync(resolve(repoRoot, "src/features/training/shell.tsx"), "utf8");
const trainingRoutesSource = readFileSync(resolve(repoRoot, "src/features/training/routes.ts"), "utf8");
const trainingNotFoundSource = readFileSync(resolve(repoRoot, "src/features/training/not-found-page.tsx"), "utf8");
const trainingManifestSource = readFileSync(resolve(repoRoot, "src/app/api/training/route.ts"), "utf8");
const generationProjectDetailSource = readFileSync(resolve(repoRoot, "src/server/repositories/project-view-repository/detail-view.ts"), "utf8");
const generationQueuePageSource = readFileSync(resolve(repoRoot, "src/app/queue/page.tsx"), "utf8");
const generationQueueDataRouteSource = readFileSync(resolve(repoRoot, "src/app/api/queue-data/route.ts"), "utf8");
const generationProjectListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/projects/route.ts"), "utf8");
const generationPresetListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/presets/route.ts"), "utf8");
const generationPresetLibraryCategoryRouteSource = readFileSync(resolve(repoRoot, "src/app/api/preset-library/categories/route.ts"), "utf8");
const generationTemplateListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/templates/route.ts"), "utf8");
const trainingProjectListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/training/projects/route.ts"), "utf8");
const trainingRunListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/training/runs/route.ts"), "utf8");
const trainingPresetListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/training/presets/route.ts"), "utf8");
const trainingTemplateListRouteSource = readFileSync(resolve(repoRoot, "src/app/api/training/templates/route.ts"), "utf8");
const generationPresetQueryServiceSource = readFileSync(resolve(repoRoot, "src/server/services/preset-query-service.ts"), "utf8");
const generationPresetViewRepositorySource = readFileSync(resolve(repoRoot, "src/server/repositories/preset-view-repository.ts"), "utf8");
const generationRunWorkflowServiceSource = readFileSync(resolve(repoRoot, "src/server/services/run-workflow-service.ts"), "utf8");
const trainingPresetServiceSource = readFileSync(resolve(repoRoot, "src/server/services/training/preset-service.ts"), "utf8");
const trainingRunPresetServiceSource = readFileSync(resolve(repoRoot, "src/server/services/training/run-preset-service.ts"), "utf8");
const trainingSceneDescriptionPresetRepositorySource = readFileSync(
  resolve(repoRoot, "src/server/repositories/training/scene-description-presets.ts"),
  "utf8",
);
const generationRunLifecycleSource = readFileSync(resolve(repoRoot, "src/lib/actions/run-lifecycle.ts"), "utf8");
const generationRunWorkflowRouteSource = readFileSync(resolve(repoRoot, "src/app/api/runs/[runId]/workflow/route.ts"), "utf8");
const generationWorkerStatusRouteSource = readFileSync(resolve(repoRoot, "src/app/api/worker/status/route.ts"), "utf8");
const generationWorkerRepositorySource = readFileSync(resolve(repoRoot, "src/server/worker/repository.ts"), "utf8");
const generationRunExecutorSource = readFileSync(resolve(repoRoot, "src/server/services/run-executor.ts"), "utf8");
const generationProjectExportServiceSource = readFileSync(resolve(repoRoot, "src/server/services/project-export-service.ts"), "utf8");
const generationProjectArchiveServiceSource = readFileSync(resolve(repoRoot, "src/server/services/project-archive-service.ts"), "utf8");
const generationProjectFolderServiceSource = readFileSync(resolve(repoRoot, "src/server/services/project-folder-service.ts"), "utf8");
const generationProjectServiceSource = readFileSync(resolve(repoRoot, "src/server/services/project-service.ts"), "utf8");
const generationImageReviewActionSource = readFileSync(resolve(repoRoot, "src/lib/actions/image-review.ts"), "utf8");
const generationCensoringActionSource = readFileSync(resolve(repoRoot, "src/lib/actions/censoring.ts"), "utf8");
const generationCensoringExecutorSource = readFileSync(resolve(repoRoot, "src/server/services/censoring-executor.ts"), "utf8");
const generationCensoringServiceSource = readFileSync(resolve(repoRoot, "src/server/services/censoring-service.ts"), "utf8");
const generationSectionActionSource = readFileSync(resolve(repoRoot, "src/lib/actions/section.ts"), "utf8");
const generationProjectActionSource = readFileSync(resolve(repoRoot, "src/lib/actions/project.ts"), "utf8");
const generationTemplateSaveActionSource = readFileSync(resolve(repoRoot, "src/lib/actions/template-save.ts"), "utf8");
const generationTrashRepositorySource = readFileSync(resolve(repoRoot, "src/server/repositories/trash-repository.ts"), "utf8");
const generationReviewRepositorySource = readFileSync(resolve(repoRoot, "src/server/repositories/review-repository.ts"), "utf8");
const generationSectionWorkflowServiceSource = readFileSync(resolve(repoRoot, "src/server/services/section-workflow-service.ts"), "utf8");
const generationManualCensorRouteSource = readFileSync(resolve(repoRoot, "src/app/api/images/[imageId]/manual-censor/route.ts"), "utf8");
const generationImageCoverRouteSource = readFileSync(resolve(repoRoot, "src/app/api/images/[imageId]/cover/route.ts"), "utf8");
const generationImageFeaturedHelperSource = readFileSync(resolve(repoRoot, "src/app/api/images/[imageId]/featured-helper.ts"), "utf8");
const generationAgentPresetVariantFlowSource = readFileSync(resolve(repoRoot, "src/server/services/agent-preset-variant-flow-service.ts"), "utf8");
const generationAgentPresetVariantSyncSource = readFileSync(resolve(repoRoot, "src/server/services/agent-preset-variant-service.ts"), "utf8");
const generationTemplateCrudSource = readFileSync(resolve(repoRoot, "src/lib/actions/template-crud.ts"), "utf8");
const generationTemplateImportSource = readFileSync(resolve(repoRoot, "src/lib/actions/template-import.ts"), "utf8");
const generationPresetReplacementSource = readFileSync(resolve(repoRoot, "src/server/services/preset-section-replacement-service.ts"), "utf8");

const MODULE_OWNED_RESOURCE_KEYS = ["runs", "projects", "presets", "templates"] as const;
const SHARED_RESOURCE_KEYS = ["models", "settings"] as const;
const retiredTrainingApiRoot = `/api/${["character", "lora", "training"].join("-")}`;

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

test("work mode resource boundary manifest is symmetric for generation and training modules", () => {
  const buildBoundary = (WorkModeResources as Record<string, unknown>).buildWorkModeResourceBoundary;

  assert.equal(
    typeof buildBoundary,
    "function",
    "The shared work-mode resource contract should expose a boundary manifest for agent-facing APIs.",
  );

  const generationBoundary = (buildBoundary as (mode: "generation" | "lora_training") => {
    forbiddenTrainingEntrypoints: string[];
    moduleOwnedResources: Record<string, { apiEntrypoint: string; uiRoute: string }>;
    sharedResources: Record<string, { apiEntrypoints: string[]; uiRoute: string }>;
  })("generation");
  const trainingBoundary = (buildBoundary as (mode: "generation" | "lora_training") => {
    forbiddenGenerationEntrypoints: string[];
    moduleOwnedResources: Record<string, { apiEntrypoint: string; uiRoute: string }>;
    sharedResources: Record<string, { apiEntrypoints: string[]; uiRoute: string }>;
  })("lora_training");

  assert.deepEqual(Object.keys(generationBoundary.moduleOwnedResources), [
    "runs",
    "projects",
    "presets",
    "templates",
  ]);
  assert.deepEqual(Object.keys(trainingBoundary.moduleOwnedResources), [
    "runs",
    "projects",
    "presets",
    "templates",
  ]);
  assert.equal(generationBoundary.moduleOwnedResources.presets.uiRoute, "/assets/presets");
  assert.equal(generationBoundary.moduleOwnedResources.presets.apiEntrypoint, "/api/presets");
  assert.equal(trainingBoundary.moduleOwnedResources.presets.uiRoute, "/training/presets");
  assert.equal(trainingBoundary.moduleOwnedResources.presets.apiEntrypoint, "/api/training/presets");
  assert.deepEqual(Object.keys(generationBoundary.sharedResources), ["models", "settings"]);
  assert.deepEqual(Object.keys(trainingBoundary.sharedResources), ["models", "settings"]);
  assert.equal(generationBoundary.sharedResources.models.uiRoute, trainingBoundary.sharedResources.models.uiRoute);
  assert.deepEqual(
    generationBoundary.sharedResources.models.apiEntrypoints,
    trainingBoundary.sharedResources.models.apiEntrypoints,
  );
  assert.ok(
    generationBoundary.forbiddenTrainingEntrypoints.includes("/api/training/presets"),
    "Generation module agents must not use training preset APIs as fallbacks.",
  );
  assert.equal(
    generationBoundary.forbiddenTrainingEntrypoints.includes(retiredTrainingApiRoot),
    false,
    "Removed training APIs should not remain listed as active fallback routes.",
  );
  assert.ok(
    trainingBoundary.forbiddenGenerationEntrypoints.includes("/api/presets"),
    "Training module agents must not use generation preset APIs as fallbacks.",
  );
});

test("generation and training resource APIs stay disjoint except shared models and settings", () => {
  const buildBoundary = (WorkModeResources as Record<string, unknown>).buildWorkModeResourceBoundary as
    | ((mode: "generation" | "lora_training") => {
        forbiddenGenerationEntrypoints?: string[];
        forbiddenTrainingEntrypoints?: string[];
        moduleOwnedResources: Record<string, { apiEntrypoint: string; uiRoute: string }>;
        sharedResources: Record<string, { apiEntrypoints: string[]; uiRoute: string }>;
      })
    | undefined;

  assert.equal(typeof buildBoundary, "function");
  if (typeof buildBoundary !== "function") {
    throw new Error("buildWorkModeResourceBoundary export missing");
  }

  const generationBoundary = buildBoundary("generation");
  const trainingBoundary = buildBoundary("lora_training");
  const trainingOwnedApiRoots = [
    "/api/training/projects",
    "/api/training/runs",
    "/api/training/presets",
    "/api/training/scene-description/presets",
    "/api/training/templates",
  ];
  const generationOwnedApiRoots = [
    "/api/projects",
    "/api/runs",
    "/api/presets",
    "/api/preset-library",
    "/api/templates",
    "/api/queue",
  ];

  for (const apiRoot of trainingOwnedApiRoots) {
    assert.ok(
      generationBoundary.forbiddenTrainingEntrypoints?.some((forbiddenRoot) => (
        apiRoot === forbiddenRoot || apiRoot.startsWith(`${forbiddenRoot}/`)
      )),
      `Generation modules should treat ${apiRoot} as training-owned.`,
    );
  }

  for (const apiRoot of generationOwnedApiRoots) {
    assert.ok(
      trainingBoundary.forbiddenGenerationEntrypoints?.includes(apiRoot),
      `Training modules should treat ${apiRoot} as generation-owned.`,
    );
  }

  assert.deepEqual(Object.keys(generationBoundary.sharedResources), ["models", "settings"]);
  assert.deepEqual(Object.keys(trainingBoundary.sharedResources), ["models", "settings"]);
});

test("work mode resource boundary exposes an explicit shared-resource whitelist", () => {
  const buildBoundary = (WorkModeResources as Record<string, unknown>).buildWorkModeResourceBoundary as
    | ((mode: "generation" | "lora_training") => {
        moduleOwnedResourceKeys?: string[];
        sharedResourceKeys?: string[];
        moduleOwnedResources: Record<string, unknown>;
        sharedResources: Record<string, unknown>;
      })
    | undefined;

  assert.equal(
    typeof buildBoundary,
    "function",
    "The shared work-mode resource contract should expose boundaries for both modules.",
  );
  if (typeof buildBoundary !== "function") {
    throw new Error("buildWorkModeResourceBoundary export missing");
  }

  const generationBoundary = buildBoundary("generation");
  const trainingBoundary = buildBoundary("lora_training");

  for (const [label, boundary] of [
    ["generation", generationBoundary],
    ["training", trainingBoundary],
  ] as const) {
    assert.deepEqual(
      boundary.moduleOwnedResourceKeys,
      ["runs", "projects", "presets", "templates"],
      `${label} boundary should explicitly mark runs/projects/presets/templates as module-owned resources.`,
    );
    assert.deepEqual(
      boundary.sharedResourceKeys,
      ["models", "settings"],
      `${label} boundary should explicitly keep only models/settings shared across modules.`,
    );
    assert.deepEqual(
      Object.keys(boundary.moduleOwnedResources),
      boundary.moduleOwnedResourceKeys,
      `${label} module-owned resource keys should match the advertised resource map.`,
    );
    assert.deepEqual(
      Object.keys(boundary.sharedResources),
      boundary.sharedResourceKeys,
      `${label} shared resource keys should match the advertised shared-resource map.`,
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

test("module-owned list API routes stay on their owning resource services", () => {
  for (const [label, source] of [
    ["generation project list", generationProjectListRouteSource],
    ["generation preset list", generationPresetListRouteSource],
    ["generation preset library categories", generationPresetLibraryCategoryRouteSource],
    ["generation template list", generationTemplateListRouteSource],
    ["generation queue list", generationQueueDataRouteSource],
  ] as const) {
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training|@\/server\/repositories\/training|@\/features\/training|\/api\/training/,
      `${label} must not read training-owned list resources.`,
    );
  }

  assert.match(generationProjectListRouteSource, /@\/server\/services\/project-service/);
  assert.match(generationPresetListRouteSource, /@\/server\/services\/preset-query-service/);
  assert.match(generationPresetLibraryCategoryRouteSource, /getPresetCategoriesWithPresets/);
  assert.match(generationTemplateListRouteSource, /listProjectTemplates/);

  for (const [label, source] of [
    ["training project list", trainingProjectListRouteSource],
    ["training run list", trainingRunListRouteSource],
    ["training preset list", trainingPresetListRouteSource],
    ["training template list", trainingTemplateListRouteSource],
  ] as const) {
    assert.match(
      source,
      /@\/server\/services\/training\/read-service/,
      `${label} should read through the Training read service boundary.`,
    );
    assert.doesNotMatch(
      source,
      /@\/lib\/server-data|@\/server\/services\/(?:project-service|preset-query-service)|listProjectTemplates|\/api\/(?:projects|presets|templates|queue)\b/,
      `${label} must not read generation-owned list resources.`,
    );
  }
});

test("module-owned preset services keep generation and training preset storage separate", () => {
  for (const [label, source] of [
    ["generation preset query service", generationPresetQueryServiceSource],
    ["generation preset view repository", generationPresetViewRepositorySource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationPresetWhere/,
      `${label} must use the generation preset boundary before returning preset resources.`,
    );
    assert.match(
      source,
      /ORDINARY_PRESET_CATEGORY_TYPE|ordinaryPresetLibraryCategoryTypeWhere/,
      `${label} must scope visible preset resources to ordinary generation preset categories.`,
    );
    assert.doesNotMatch(
      source,
      /trainingSceneDescriptionPreset|TrainingSceneDescriptionPreset|@\/server\/repositories\/training\/scene-description-presets|@\/server\/services\/training\/preset-service/,
      `${label} must not read training scene-description preset storage.`,
    );
  }

  for (const [label, source] of [
    ["training preset service", trainingPresetServiceSource],
    ["training run preset service", trainingRunPresetServiceSource],
    ["training scene-description preset repository", trainingSceneDescriptionPresetRepositorySource],
  ] as const) {
    assert.match(
      source,
      /trainingSceneDescriptionPreset/,
      `${label} must read/write dedicated training scene-description preset storage.`,
    );
    assert.doesNotMatch(
      source,
      /buildGenerationPresetWhere|ORDINARY_PRESET_CATEGORY_TYPE|ordinaryPresetLibraryCategoryTypeWhere|prisma\.preset(?:Category|Folder|Group|Variant)?\b|@\/server\/services\/preset-query-service|@\/server\/repositories\/preset-view-repository/,
      `${label} must not read generation preset storage; models/settings are the only shared resource classes.`,
    );
  }
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

test("production shell does not mount the legacy Character LoRA task panel", () => {
  assert.doesNotMatch(
    appShellSource,
    /TaskPanel(?:Provider|Container)|@\/components\/task-panel/,
    "The production shell must not mount the old Character LoRA task panel because it owns training resources.",
  );
});

test("production training shell and routes expose only training-owned resources plus shared navigation", () => {
  assert.match(
    trainingShellSource,
    /PersistentBottomNav/,
    "Training shell should render the shared persistent navigation instead of owning sidebar resource links.",
  );
  assert.match(
    trainingShellSource,
    /navigationChrome="none"/,
    "Training shell should disable the demo sidebar navigation chrome.",
  );
  assert.doesNotMatch(
    trainingShellSource,
    /buildTrainingNavigationLinks|navigationLinks=\{/,
    "Training shell should not build or inject private sidebar navigation links.",
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

test("design-demo generation data loader filters training-owned resources before shaping pages", () => {
  assert.match(
    designDemoDataSource,
    /from Project p[\s\S]*where[\s\S]*training_benchmark[\s\S]*order by datetime\(p\.updatedAt\) desc/,
    "Design-demo generation project lists should not load training-reserved projects from the shared Project table.",
  );
  assert.match(
    designDemoDataSource,
    /from Preset p[\s\S]*join PresetCategory c on c\.id = p\.categoryId[\s\S]*where[\s\S]*c\.type = 'preset'/,
    "Design-demo generation preset lists should only load ordinary generation presets.",
  );
  assert.match(
    designDemoDataSource,
    /from PresetCategory c[\s\S]*where[\s\S]*c\.type in \('preset', 'group'\)/,
    "Design-demo generation preset categories should hide training scene-description categories.",
  );
  assert.match(
    designDemoDataSource,
    /from ProjectTemplate t[\s\S]*where[\s\S]*training benchmark[\s\S]*order by datetime\(t\.updatedAt\) desc/,
    "Design-demo generation template lists should not load reserved training templates.",
  );
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

test("training manifest advertises only training-owned APIs plus shared resources", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const advertisedManifest = JSON.stringify({
    entrypoints: payload.data.entrypoints,
    resources: payload.data.resources,
    workflows: payload.data.workflows,
  });
  const forbiddenGenerationEntrypoints = [
    "/api/agent/projects",
    "/api/agent/runs",
    "/api/image-review",
    "/api/images",
    "/api/project-create-options",
    "/api/project-folders",
    "/api/preset-library",
    "/api/projects",
    "/api/presets",
    "/api/queue",
    "/api/queue-data",
    "/api/runs",
    "/api/templates",
    "/api/worker",
  ];

  assert.deepEqual(payload.data.resourceBoundary.forbiddenGenerationEntrypoints, forbiddenGenerationEntrypoints);

  for (const forbiddenPath of forbiddenGenerationEntrypoints) {
    assert.doesNotMatch(
      advertisedManifest,
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

test("generation project detail loaders reuse the generation resource boundary", () => {
  assert.match(
    generationProjectDetailSource,
    /buildGenerationProjectWhere/,
    "Generation project detail/result loaders should reuse the shared generation project boundary.",
  );
  assert.doesNotMatch(
    generationProjectDetailSource,
    /prisma\.project\.findUnique\(\{\s*where:\s*\{\s*id:\s*projectId\s*\}/,
    "Generation project detail/result loaders must not fetch projects by id without the resource boundary.",
  );
  assert.match(
    generationProjectDetailSource,
    /prisma\.projectSection\.findFirst\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation section result detail should reject sections owned by hidden training benchmark projects.",
  );
});

test("generation template action entrypoints reuse generation resource boundaries", () => {
  assert.match(
    generationTemplateCrudSource,
    /buildGenerationProjectTemplateWhere/,
    "Generation template option lists should reuse the generation template boundary.",
  );
  assert.match(
    generationTemplateCrudSource,
    /projectTemplate\.findMany\(\{[\s\S]*where:\s*buildGenerationProjectTemplateWhere\(\)/,
    "Generation template option lists must not expose training-owned templates.",
  );

  assert.match(
    generationTemplateImportSource,
    /buildGenerationProjectWhere/,
    "Generation template import should verify the destination project is generation-owned.",
  );
  assert.match(
    generationTemplateImportSource,
    /buildGenerationProjectTemplateWhere/,
    "Generation template import should verify the source template is generation-owned.",
  );
  assert.doesNotMatch(
    generationTemplateImportSource,
    /projectTemplate\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*templateId\s*\}/,
    "Generation template import must not fetch templates by id without the generation template boundary.",
  );
  assert.doesNotMatch(
    generationTemplateImportSource,
    /project\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*projectId\s*\}/,
    "Generation template import must not fetch projects by id without the generation project boundary.",
  );

  assert.match(
    generationPresetReplacementSource,
    /buildGenerationProjectWhere/,
    "Generation preset replacement project targets should reuse the generation project boundary.",
  );
  assert.match(
    generationPresetReplacementSource,
    /buildGenerationProjectTemplateWhere/,
    "Generation preset replacement template targets should reuse the generation template boundary.",
  );
  assert.doesNotMatch(
    generationPresetReplacementSource,
    /project\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*projectId\s*\}/,
    "Generation preset replacement must not load project targets by id without the generation project boundary.",
  );
  assert.doesNotMatch(
    generationPresetReplacementSource,
    /projectTemplate\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*templateId\s*\}/,
    "Generation preset replacement must not load template targets by id without the generation template boundary.",
  );
});

test("generation queue auxiliary lists reuse the generation project boundary", () => {
  for (const [label, source] of [
    ["generation queue page", generationQueuePageSource],
    ["generation queue data API", generationQueueDataRouteSource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationProjectWhere/,
      `${label} auxiliary lists should import the generation project boundary.`,
    );
    assert.match(
      source,
      /censoringTask\.groupBy\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
      `${label} active censoring progress should not include training-owned projects.`,
    );
    assert.match(
      source,
      /censoringTask\.findMany\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
      `${label} censoring history should not include training-owned projects.`,
    );
    assert.doesNotMatch(
      source,
      /project\.findMany\(\{[\s\S]*where:\s*\{\s*id:\s*\{\s*in:\s*projectIds\s*\}/,
      `${label} project-title lookup must not fetch projects by id without the generation project boundary.`,
    );
  }
});

test("generation project service entrypoints reuse the generation project boundary", () => {
  for (const [label, source] of [
    ["generation project export service", generationProjectExportServiceSource],
    ["generation project archive service", generationProjectArchiveServiceSource],
    ["generation project folder service", generationProjectFolderServiceSource],
    ["generation project service", generationProjectServiceSource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationProjectWhere/,
      `${label} should import the generation project boundary.`,
    );
    assert.doesNotMatch(
      source,
      /project\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*(?:projectId|normalizedProjectId)/,
      `${label} must not fetch projects by id without the generation project boundary.`,
    );
    assert.doesNotMatch(
      source,
      /project\.update\(\{[\s\S]*where:\s*\{\s*id:\s*(?:projectId|normalizedProjectId)/,
      `${label} must not update projects by id without the generation project boundary.`,
    );
  }

  assert.match(
    generationProjectExportServiceSource,
    /imageResult\.findFirst\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation project export cover lookup should reject images from hidden training benchmark projects.",
  );
  assert.match(
    generationProjectArchiveServiceSource,
    /imageResult\.findMany\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation project archive trash cleanup should reject images from hidden training benchmark projects.",
  );
  assert.match(
    generationProjectArchiveServiceSource,
    /run\.findMany\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation project archive output cleanup should reject runs from hidden training benchmark projects.",
  );
  assert.match(
    generationProjectFolderServiceSource,
    /project\.count\(\{[\s\S]*buildGenerationProjectWhere\(\{\s*folderId:\s*id\s*\}\)/,
    "Generation project folder deletion should not count hidden training benchmark projects as visible folder contents.",
  );
  assert.match(
    generationProjectServiceSource,
    /enqueueProjectRuns[\s\S]*project\.findFirst\(\{[\s\S]*where:\s*buildGenerationProjectWhere\(\{\s*id:\s*normalizedId/,
    "Generation project enqueue should reject hidden training benchmark projects before repository enqueue.",
  );
  assert.match(
    generationProjectServiceSource,
    /enqueueProjectSectionRun[\s\S]*projectSection\.findFirst\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\{\s*id:\s*normalizedProjectId/,
    "Generation section enqueue should reject sections from hidden training benchmark projects before repository enqueue.",
  );
});

test("generation image review and censoring entrypoints reuse the generation project boundary", () => {
  for (const [label, source] of [
    ["generation image review actions", generationImageReviewActionSource],
    ["generation censoring actions", generationCensoringActionSource],
    ["generation censoring executor", generationCensoringExecutorSource],
    ["generation censoring service", generationCensoringServiceSource],
    ["generation trash repository", generationTrashRepositorySource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationProjectWhere/,
      `${label} should import the generation project boundary.`,
    );
  }

  assert.match(
    generationImageReviewActionSource,
    /imageResult\.findMany\(\{[\s\S]*where:\s*\{[\s\S]*id:\s*\{\s*in:\s*uniqueImageIds\s*\}[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation image review actions should bulk-load images through generation-owned projects.",
  );
  assert.doesNotMatch(
    generationImageReviewActionSource,
    /project\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*normalizedProjectId\s*\}/,
    "Generation project image trash actions must not load projects by id without the project boundary.",
  );
  assert.match(
    generationImageReviewActionSource,
    /trashRecord\.findMany\(\{[\s\S]*imageResult:\s*\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation clear-trash should only clear trash records from generation-owned projects.",
  );
  assert.match(
    generationCensoringActionSource,
    /imageResult\.findFirst\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation single-image censoring should resolve images through generation-owned projects.",
  );
  assert.match(
    generationCensoringActionSource,
    /censoringTask\.(?:groupBy|updateMany)\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation censoring task aggregates and mutations should resolve tasks through generation-owned projects.",
  );
  assert.match(
    generationCensoringExecutorSource,
    /censoringTask\.updateMany\(\{[\s\S]*status:\s*"running"[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation censoring task recovery should not recover training-owned tasks.",
  );
  assert.match(
    generationCensoringExecutorSource,
    /censoringTask\.findMany\(\{[\s\S]*status:\s*"queued"[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation censoring executor should not lease queued training-owned tasks.",
  );
  assert.match(
    generationCensoringServiceSource,
    /imageResult\.findFirst\(\{[\s\S]*id:\s*input\.imageResultId[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation auto-censor service should resolve images through generation-owned projects.",
  );
  assert.match(
    generationCensoringServiceSource,
    /imageResult\.findFirst\(\{[\s\S]*id:\s*imageResultId[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation manual-censor service should resolve images through generation-owned projects.",
  );
  assert.match(
    generationTrashRepositorySource,
    /projectSection\.findFirst\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation section trash reads should reject section ids from hidden training benchmark projects.",
  );
});

test("generation section actions reuse the generation project boundary", () => {
  assert.match(
    generationSectionActionSource,
    /buildGenerationProjectWhere/,
    "Generation section actions should import the generation project boundary.",
  );
  assert.doesNotMatch(
    generationSectionActionSource,
    /project\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*projectId\s*\}/,
    "Generation section actions must not load projects by id without the project boundary.",
  );
  assert.doesNotMatch(
    generationSectionActionSource,
    /project\.update\(\{[\s\S]*where:\s*\{\s*id:\s*projectId\s*\}/,
    "Generation section actions must not update projects by id without the project boundary.",
  );
  assert.match(
    generationSectionActionSource,
    /projectSection\.find(?:First|Many)\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation section id entrypoints should resolve sections through generation-owned projects.",
  );
  assert.match(
    generationSectionActionSource,
    /run\.count\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation section run counts should reject hidden training benchmark projects.",
  );
  assert.match(
    generationSectionActionSource,
    /imageResult\.count\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation section image counts should reject hidden training benchmark projects.",
  );
});

test("generation project, template, and agent entrypoints reuse the generation project boundary", () => {
  for (const [label, source] of [
    ["generation project actions", generationProjectActionSource],
    ["generation template save action", generationTemplateSaveActionSource],
    ["generation agent preset flow", generationAgentPresetVariantFlowSource],
    ["generation agent preset sync", generationAgentPresetVariantSyncSource],
    ["generation section workflow service", generationSectionWorkflowServiceSource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationProjectWhere/,
      `${label} should import the generation project boundary.`,
    );
  }

  assert.match(
    generationProjectActionSource,
    /project\.updateMany\(\{[\s\S]*where:\s*buildGenerationProjectWhere\(\{\s*id:\s*projectId/,
    "Generation project updates should reject hidden training benchmark projects.",
  );
  assert.match(
    generationProjectActionSource,
    /projectSection\.updateMany\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(/,
    "Generation project bulk section updates should reject hidden training benchmark projects.",
  );
  assert.match(
    generationTemplateSaveActionSource,
    /project\.findFirst\(\{[\s\S]*where:\s*buildGenerationProjectWhere\(\{\s*id:\s*projectId/,
    "Generation template save should not snapshot hidden training benchmark projects.",
  );
  assert.match(
    generationAgentPresetVariantFlowSource,
    /project\.find(?:First|Many)\(\{[\s\S]*where:\s*buildGenerationProjectWhere\(/,
    "Generation agent preset flow project lookup should reject hidden training benchmark projects.",
  );
  assert.match(
    generationAgentPresetVariantSyncSource,
    /project\.findFirst\(\{[\s\S]*where:\s*buildGenerationProjectWhere\(\{\s*id:\s*projectId/,
    "Generation agent preset sync should resolve source and target projects through the generation boundary.",
  );
  assert.match(
    generationSectionWorkflowServiceSource,
    /project\.findFirst\(\{[\s\S]*where:\s*buildGenerationProjectWhere\(\{\s*id:\s*projectId/,
    "Generation section workflow downloads should reject hidden training benchmark projects.",
  );
});

test("generation review and image API entrypoints reuse the generation project boundary", () => {
  for (const [label, source] of [
    ["generation review repository", generationReviewRepositorySource],
    ["generation manual censor route", generationManualCensorRouteSource],
    ["generation image cover route", generationImageCoverRouteSource],
    ["generation featured image helper", generationImageFeaturedHelperSource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationProjectWhere/,
      `${label} should import the generation project boundary.`,
    );
  }

  assert.match(
    generationReviewRepositorySource,
    /run\.findFirst\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation review run loaders should reject hidden training benchmark runs.",
  );
  assert.match(
    generationReviewRepositorySource,
    /imageResult\.findMany\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation review image mutations should reject hidden training benchmark images.",
  );
  assert.match(
    generationReviewRepositorySource,
    /imageResult\.findFirst\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation review restore should reject hidden training benchmark images.",
  );
  assert.match(
    generationImageCoverRouteSource,
    /imageResult\.findFirst\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation cover image route should reject hidden training benchmark images.",
  );
  assert.match(
    generationImageFeaturedHelperSource,
    /imageResult\.findFirst\(\{[\s\S]*run:\s*\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation featured image route should reject hidden training benchmark images.",
  );
});

test("generation worker status uses the generation project boundary", () => {
  assert.match(
    generationWorkerStatusRouteSource,
    /buildGenerationProjectWhere/,
    "Generation worker status should not aggregate training-owned run resources.",
  );
  assert.match(
    generationWorkerStatusRouteSource,
    /run\.count\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation worker status queued/running counts should filter through generation-owned projects.",
  );
  assert.match(
    generationWorkerStatusRouteSource,
    /run\.findMany\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation worker status recent runs should filter through generation-owned projects.",
  );
});

test("generation run workflow downloads use the generation project boundary", () => {
  assert.match(
    generationRunWorkflowRouteSource,
    /buildRunWorkflowDownload/,
    "Generation workflow downloads should delegate run workflow lookup below the route.",
  );
  assert.doesNotMatch(
    generationRunWorkflowRouteSource,
    /@\/lib\/prisma|buildGenerationProjectWhere|prisma\.run/,
    "Generation workflow download routes should not own the resource-boundary query.",
  );
  assert.match(
    generationRunWorkflowServiceSource,
    /buildGenerationProjectWhere/,
    "Generation workflow downloads should not expose training-owned run workflow payloads.",
  );
  assert.match(
    generationRunWorkflowServiceSource,
    /run\.findFirst\(\{[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation workflow downloads should resolve runs through generation-owned projects.",
  );
  assert.doesNotMatch(
    generationRunWorkflowServiceSource,
    /run\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*runId\s*\}/,
    "Generation workflow downloads must not fetch runs by id without the resource boundary.",
  );
});

test("generation run lifecycle actions use the generation project boundary", () => {
  assert.match(
    generationRunLifecycleSource,
    /buildGenerationRunWhere/,
    "Generation run lifecycle actions should centralize Run ownership filtering.",
  );
  assert.match(
    generationRunLifecycleSource,
    /buildGenerationProjectWhere/,
    "Generation run lifecycle actions should derive run ownership from generation-owned projects.",
  );
  assert.doesNotMatch(
    generationRunLifecycleSource,
    /run\.findUnique\(\{[\s\S]*where:\s*\{\s*id:\s*runId\s*\}/,
    "Generation run lifecycle actions must not fetch runs by id without the resource boundary.",
  );
  assert.doesNotMatch(
    generationRunLifecycleSource,
    /where:\s*\{\s*status:\s*\{\s*in:\s*RUN_ACTIVE_STATUSES\s*\}\s*\}/,
    "Bulk active-run lifecycle actions must not scan every module's active runs.",
  );
  assert.doesNotMatch(
    generationRunLifecycleSource,
    /where:\s*\{\s*status:\s*"paused"/,
    "Bulk paused-run lifecycle actions must not scan every module's paused runs.",
  );
  assert.doesNotMatch(
    generationRunLifecycleSource,
    /project\.update\(\{[\s\S]*where:\s*\{\s*id:\s*run\.projectId\s*\}/,
    "Generation run lifecycle actions must not update projects without the generation project boundary.",
  );
});

test("generation worker execution entrypoints reuse the generation project boundary", () => {
  for (const [label, source] of [
    ["generation worker repository", generationWorkerRepositorySource],
    ["generation run executor", generationRunExecutorSource],
  ] as const) {
    assert.match(
      source,
      /buildGenerationProjectWhere/,
      `${label} should import the generation project boundary.`,
    );
  }

  assert.match(
    generationWorkerRepositorySource,
    /run\.findMany\(\{[\s\S]*status:\s*RunStatus\.queued[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation worker queue leasing should not pick hidden training benchmark runs.",
  );
  assert.match(
    generationWorkerRepositorySource,
    /run\.findFirst\(\{[\s\S]*where:\s*buildGenerationRunWhere\(\{\s*id:\s*runId/,
    "Generation worker run lookup should resolve runs through generation-owned projects.",
  );
  assert.match(
    generationRunExecutorSource,
    /run\.findMany\(\{[\s\S]*status:\s*\{\s*in:\s*\[RunStatus\.queued,\s*RunStatus\.running\][\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation run recovery should not recover hidden training benchmark runs.",
  );
  assert.match(
    generationRunExecutorSource,
    /run\.findMany\(\{[\s\S]*status:\s*RunStatus\.queued[\s\S]*project:\s*buildGenerationProjectWhere\(\)/,
    "Generation run recovery should not submit hidden training benchmark queued runs.",
  );
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
