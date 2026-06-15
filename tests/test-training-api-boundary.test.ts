import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

function listFiles(root: string, includeFile: (name: string) => boolean): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return listFiles(path, includeFile);
    }

    return entry.isFile() && includeFile(entry.name) ? [path] : [];
  });
}

test("training API route handlers do not directly depend on legacy character-lora-training modules", () => {
  const routeFiles = listFiles(join(process.cwd(), "src/app/api/training"), (name) => name === "route.ts");
  const directLegacyImports = routeFiles
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("character-lora-training"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    directLegacyImports,
    [],
    "Route handlers should call Training* services/repositories instead of importing legacy character-lora-training modules directly.",
  );
});

test("training services isolate legacy character-lora-training dependencies in one adapter", () => {
  const serviceFiles = listFiles(join(process.cwd(), "src/server/services/training"), (name) => name.endsWith(".ts"));
  const directLegacyImports = serviceFiles
    .filter((path) => !path.endsWith("legacy-compat-service.ts"))
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("character-lora-training"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    directLegacyImports,
    [],
    "Training services should use legacy-compat-service while the remaining old implementation is migrated.",
  );
});

test("training API design docs use reference-image route names as the primary project media API", () => {
  const backendApiDesign = readFileSync(
    join(process.cwd(), "docs/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md"),
    "utf8",
  );
  const finalTechnicalDesign = readFileSync(
    join(process.cwd(), "docs/plans/2026-06-07-manager-lora-training-final-technical-design.md"),
    "utf8",
  );

  for (const path of [
    "/api/training/projects/:projectId/reference-images",
    "/api/training/reference-images/:imageId",
    "/api/training/reference-images/:imageId/add-to-results",
  ]) {
    assert.match(backendApiDesign, new RegExp(path.replaceAll("/", "\\/")));
  }

  for (const legacyPath of [
    "/api/training/projects/:projectId/character-images",
    "/api/training/character-images/:imageId",
    "/api/training/character-images/:imageId/add-to-results",
  ]) {
    assert.doesNotMatch(backendApiDesign, new RegExp(legacyPath.replaceAll("/", "\\/")));
  }

  assert.match(backendApiDesign, /### 6\.2 Profile and Reference Images/);
  assert.match(finalTechnicalDesign, /\breference-images\b/);
  assert.doesNotMatch(finalTechnicalDesign, /\bcharacter-images\b/);
});

test("production training API route tests use reference-image routes instead of legacy character-image aliases", () => {
  const routeTestSource = readFileSync(join(process.cwd(), "tests/test-training-api-routes.test.ts"), "utf8");
  const productionTestsUsingLegacyReferenceAliases: string[] = [];
  const testBlockPattern = /test\("([^"]+)", async \(\) => \{([\s\S]*?)(?=\n\}\);\n\ntest\("|$)/g;

  for (const match of routeTestSource.matchAll(testBlockPattern)) {
    const [, title, body] = match;
    if (title.includes("production") && body.includes("/character-images")) {
      productionTestsUsingLegacyReferenceAliases.push(title);
    }
  }

  assert.deepEqual(
    productionTestsUsingLegacyReferenceAliases,
    [],
    "Production training API behavior tests should exercise /reference-images; /character-images has been removed.",
  );
});

test("production training API no longer ships legacy character-image alias routes", () => {
  const routeFiles = listFiles(join(process.cwd(), "src/app/api/training"), (name) => name === "route.ts")
    .map((path) => relative(process.cwd(), path))
    .filter((path) => path.includes("character-images"));
  const routeTestSource = readFileSync(join(process.cwd(), "tests/test-training-api-routes.test.ts"), "utf8");

  assert.deepEqual(
    routeFiles,
    [],
    "Training reference images should only be exposed through /reference-images route handlers.",
  );
  assert.doesNotMatch(
    routeTestSource,
    /\/character-images|legacy training character image aliases/i,
    "Training API behavior tests should not keep compatibility coverage for removed character-image aliases.",
  );
});

test("training API behavior tests use only reference-image routes", () => {
  const routeTestSource = readFileSync(join(process.cwd(), "tests/test-training-api-routes.test.ts"), "utf8");

  assert.doesNotMatch(
    routeTestSource,
    /\/character-images/,
    "Training API behavior tests should exercise /reference-images and not legacy character-image aliases.",
  );
});

test("training scene-description DTO schemas live under src/lib/training", async () => {
  const schemasPath = join(process.cwd(), "src/lib/training/schemas.ts");

  assert.equal(
    existsSync(schemasPath),
    true,
    "Training API DTO schemas should live under src/lib/training/schemas.ts",
  );

  const presetServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/preset-service.ts"), "utf8");
  assert.match(
    presetServiceSource,
    /@\/lib\/training\/schemas/,
    "Training preset service should consume shared Training DTO schemas",
  );
  assert.doesNotMatch(
    presetServiceSource,
    /from "zod"/,
    "Training preset service should not define API DTO schemas inline",
  );

  const {
    trainingPresetSortRulesSchema,
    trainingPresetInputSchema,
    trainingSceneCategoryCreateSchema,
    trainingSceneCategoryUpdateSchema,
    trainingSceneFolderCreateSchema,
    trainingSceneFolderUpdateSchema,
  } = await import("../src/lib/training/schemas");

  assert.deepEqual(
    trainingPresetInputSchema.parse({
      category: "环境",
      folder: "雨景",
      sceneDescriptionText: "雨夜街角，霓虹反射。",
      title: "雨夜街角",
    }),
    {
      category: "环境",
      folder: "雨景",
      sceneDescriptionText: "雨夜街角，霓虹反射。",
      title: "雨夜街角",
    },
  );
  assert.deepEqual(
    trainingSceneCategoryCreateSchema.parse({
      color: null,
      icon: "CloudRain",
      name: "环境",
      sceneDescriptionOrder: 4,
      slug: "training-environment",
      sortOrder: 2,
    }),
    {
      color: null,
      icon: "CloudRain",
      name: "环境",
      sceneDescriptionOrder: 4,
      slug: "training-environment",
      sortOrder: 2,
    },
  );
  assert.deepEqual(
    trainingSceneCategoryUpdateSchema.parse({
      name: "环境更新",
    }),
    {
      name: "环境更新",
    },
  );
  assert.deepEqual(
    trainingPresetSortRulesSchema.parse({
      categoryOrder: ["环境", "光线"],
      presetOrder: ["rainy-street", "cyan-rim-light"],
    }),
    {
      categoryOrder: ["环境", "光线"],
      presetOrder: ["rainy-street", "cyan-rim-light"],
    },
  );
  assert.deepEqual(
    trainingSceneFolderCreateSchema.parse({
      categoryId: "training-category",
      name: "环境文件夹",
      parentId: "parent-folder",
      sortOrder: 8,
    }),
    {
      categoryId: "training-category",
      name: "环境文件夹",
      parentId: "parent-folder",
      sortOrder: 8,
    },
  );
  assert.deepEqual(
    trainingSceneFolderUpdateSchema.parse({
      name: "更新文件夹",
      parentId: null,
    }),
    {
      name: "更新文件夹",
      parentId: null,
    },
  );
});

test("training scene-description row reads go through a Training repository boundary", () => {
  const repositoryPath = join(process.cwd(), "src/server/repositories/training/scene-description-presets.ts");

  assert.equal(
    existsSync(repositoryPath),
    true,
    "Training scene-description preset row reads should live under src/server/repositories/training",
  );

  const repositorySource = readFileSync(repositoryPath, "utf8");
  assert.match(repositorySource, /export async function listTrainingSceneDescriptionPresetRows/);
  assert.match(repositorySource, /export async function getTrainingSceneDescriptionPresetRow/);
  assert.match(repositorySource, /export async function listTrainingSceneDescriptionCategoryRows/);
  assert.match(repositorySource, /export async function getTrainingSceneDescriptionCategoryRow/);
  assert.match(repositorySource, /export async function listTrainingSceneDescriptionFolderRows/);
  assert.match(repositorySource, /export async function getTrainingSceneDescriptionFolderRow/);

  const presetServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/preset-service.ts"), "utf8");
  assert.match(
    presetServiceSource,
    /@\/server\/repositories\/training\/scene-description-presets/,
    "Training preset service should call repository functions for scene-description row reads",
  );
});

test("training scene-description presets have dedicated Prisma models instead of only shared preset scope", () => {
  for (const schemaPath of ["prisma/schema.prisma", "prisma/schema.sqlite.prisma"]) {
    const schemaSource = readFileSync(join(process.cwd(), schemaPath), "utf8");
    const sceneDescriptionTextPattern = schemaPath.includes("sqlite")
      ? /sceneDescriptionText\s+String\b/
      : /sceneDescriptionText\s+String\s+@db\.Text/;

    assert.match(
      schemaSource,
      /model TrainingSceneDescriptionPresetCategory\s*\{/,
      `${schemaPath} should define a dedicated training scene-description category table.`,
    );
    assert.match(
      schemaSource,
      /model TrainingSceneDescriptionPresetFolder\s*\{/,
      `${schemaPath} should define a dedicated training scene-description folder table.`,
    );
    assert.match(
      schemaSource,
      /model TrainingSceneDescriptionPreset\s*\{/,
      `${schemaPath} should define a dedicated training scene-description preset table.`,
    );
    assert.match(
      schemaSource,
      sceneDescriptionTextPattern,
      `${schemaPath} should store training preset text as sceneDescriptionText, not as a generation prompt variant.`,
    );
    assert.match(
      schemaSource,
      /sceneDescriptionOrder\s+Int\s+@default\(0\)/,
      `${schemaPath} should store training scene-description composition order without borrowing positivePromptOrder.`,
    );
  }
});

test("training templates have dedicated Prisma models instead of legacy character-lora templates only", () => {
  for (const schemaPath of ["prisma/schema.prisma", "prisma/schema.sqlite.prisma"]) {
    const schemaSource = readFileSync(join(process.cwd(), schemaPath), "utf8");
    const textFieldPattern = schemaPath.includes("sqlite") ? /String\b/ : /String\s+@db\.Text/;

    assert.match(
      schemaSource,
      /model TrainingTemplate\s*\{/,
      `${schemaPath} should define a dedicated TrainingTemplate table.`,
    );
    assert.match(
      schemaSource,
      /model TrainingTemplateSection\s*\{/,
      `${schemaPath} should define dedicated TrainingTemplateSection rows.`,
    );
    assert.match(
      schemaSource,
      /model TrainingTemplateSectionSceneDescriptionBlock\s*\{/,
      `${schemaPath} should define dedicated template scene-description block rows.`,
    );
    assert.match(
      schemaSource,
      new RegExp(`imagePromptGuidance\\s+${textFieldPattern.source}`),
      `${schemaPath} should store template image prompt guidance on TrainingTemplate.`,
    );
    assert.match(
      schemaSource,
      new RegExp(`trainingCaptionFormat\\s+${textFieldPattern.source}`),
      `${schemaPath} should store template caption format on TrainingTemplate.`,
    );
    assert.match(
      schemaSource,
      /trainingDefaultsJson\s+Json\?/,
      `${schemaPath} should keep training defaults on the dedicated training template row.`,
    );
  }
});

test("training template row reads and writes go through a Training repository boundary", () => {
  const repositoryPath = join(process.cwd(), "src/server/repositories/training/templates.ts");

  assert.equal(
    existsSync(repositoryPath),
    true,
    "Training template row access should live under src/server/repositories/training.",
  );

  const repositorySource = readFileSync(repositoryPath, "utf8");
  assert.match(repositorySource, /export async function listTrainingTemplateRows/);
  assert.match(repositorySource, /export async function getTrainingTemplateRow/);
  assert.match(repositorySource, /export async function createTrainingTemplateRow/);
  assert.match(repositorySource, /export async function updateTrainingTemplateRow/);
  assert.match(repositorySource, /export async function softDeleteTrainingTemplateRow/);
  assert.match(
    repositorySource,
    /trainingTemplate\.findMany/,
    "Training template rows should read from the dedicated TrainingTemplate table.",
  );
  assert.match(
    repositorySource,
    /trainingTemplate\.create/,
    "Training template creation should write to the dedicated TrainingTemplate table.",
  );

  const templateServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/template-service.ts"), "utf8");
  assert.match(
    templateServiceSource,
    /@\/server\/repositories\/training\/templates/,
    "Training template service should call the dedicated training template repository.",
  );
  assert.doesNotMatch(
    templateServiceSource,
    /createLegacyTrainingTemplate|getLegacyTrainingTemplateSnapshot|listLegacyTrainingTemplates|updateLegacyTrainingTemplate|upsertLegacyTrainingTemplates/,
    "Training template CRUD should no longer use legacy CharacterLora template storage.",
  );
});

test("training template creation lets dedicated storage own nested row ids", () => {
  const templateServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/template-service.ts"), "utf8");

  assert.match(
    templateServiceSource,
    /normalizeTemplatePayload\(parsed,\s*\{\s*preserveIds:\s*false\s*\}\)/,
    "Training template creation should not persist client draft section or block ids as dedicated table primary keys.",
  );
  assert.match(
    templateServiceSource,
    /updateTrainingTemplateRow\(lookupId,\s*normalizeTemplatePayload\(parsed,\s*\{\s*preserveIds:\s*true\s*\}\)\)/,
    "Training template updates should keep existing nested row ids when replacing owned sections.",
  );
});

test("preset resource lists stay scoped to their owning work mode except shared models and settings", async () => {
  const presetScopeSource = readFileSync(join(process.cwd(), "src/lib/actions/preset-resource-scope.ts"), "utf8");
  assert.match(
    presetScopeSource,
    /TRAINING_SCENE_DESCRIPTION_PRESET_CATEGORY_TYPE\s*=\s*"training_scene_description"/,
    "Training scene-description preset category type should live in the shared preset resource scope contract.",
  );
  assert.match(
    presetScopeSource,
    /trainingSceneDescriptionPresetCategoryTypeWhere/,
    "Training preset queries should reuse a named scope helper instead of hand-writing category type filters.",
  );

  const generationPresetQuerySource = readFileSync(join(process.cwd(), "src/server/services/preset-query-service.ts"), "utf8");
  assert.match(
    generationPresetQuerySource,
    /ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation preset APIs should use the ordinary preset category scope constant.",
  );
  assert.doesNotMatch(
    generationPresetQuerySource,
    /type:\s*"preset"/,
    "Generation preset APIs should not hand-write the ordinary category type string.",
  );

  const generationPresetViewSource = readFileSync(join(process.cwd(), "src/server/repositories/preset-view-repository.ts"), "utf8");
  assert.match(
    generationPresetViewSource,
    /ordinaryPresetLibraryCategoryTypeWhere/,
    "Generation preset pages should use the ordinary preset-library scope for preset and group categories.",
  );
  assert.doesNotMatch(
    generationPresetViewSource,
    /training_scene_description|TRAINING_PRESET_CATEGORY_TYPE/,
    "Generation preset pages should not include training scene-description categories.",
  );

  const trainingPresetRepositorySource = readFileSync(
    join(process.cwd(), "src/server/repositories/training/scene-description-presets.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    trainingPresetRepositorySource,
    /@\/lib\/actions\/preset-resource-scope/,
    "Training preset repository should not depend on generation preset resource-scope filters after moving to dedicated tables.",
  );
  assert.doesNotMatch(
    trainingPresetRepositorySource,
    /TRAINING_PRESET_CATEGORY_TYPE\s*=\s*"training_scene_description"/,
    "Training preset repository should not own a second training category type constant.",
  );
  assert.match(
    trainingPresetRepositorySource,
    /trainingSceneDescriptionPreset\.findMany/,
    "Training preset rows should read from the dedicated training scene-description preset table.",
  );
  assert.match(
    trainingPresetRepositorySource,
    /trainingSceneDescriptionPresetCategory\.findMany/,
    "Training preset category rows should read from the dedicated training scene-description category table.",
  );
  assert.match(
    trainingPresetRepositorySource,
    /trainingSceneDescriptionPresetFolder\.findMany/,
    "Training preset folder rows should read from the dedicated training scene-description folder table.",
  );
  assert.doesNotMatch(
    trainingPresetRepositorySource,
    /prisma\.preset(?:Category|Folder)?\./,
    "Training preset repository must not read from generation preset tables.",
  );

  const trainingPresetServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/preset-service.ts"), "utf8");
  assert.match(
    trainingPresetServiceSource,
    /@\/server\/repositories\/training\/helpers/,
    "Training preset service should use Training-owned repository helpers for slug generation.",
  );
  assert.doesNotMatch(
    trainingPresetServiceSource,
    /@\/server\/services\/training\/legacy-compat-service/,
    "Training preset service should not import the legacy compat adapter for helper functions.",
  );
  assert.match(
    trainingPresetServiceSource,
    /trainingSceneDescriptionPresetCategory\.findFirst\(\{\s*where:\s*\{[\s\S]*?slug:\s*preset\.categorySlug/,
    "Training default presets should only reuse dedicated training scene-description categories.",
  );
  assert.doesNotMatch(
    trainingPresetServiceSource,
    /presetCategory\.findUnique\(\{\s*where:\s*\{\s*slug:\s*preset\.categorySlug\s*\}/,
    "Training default presets must not claim an ordinary generation category just because the slug matches.",
  );
  assert.doesNotMatch(
    trainingPresetServiceSource,
    /(?:prisma|tx)\.preset(?:Category|Folder|Variant)?\./,
    "Training scene-description preset CRUD must not write to generation preset tables.",
  );

  const { buildWorkModeNavLinks } = await import("../src/app/design-demos/routing/routes");
  const generationHrefs = buildWorkModeNavLinks("generation").map((link) => link.href);
  const trainingHrefs = buildWorkModeNavLinks("lora_training").map((link) => link.href);

  assert.equal(
    generationHrefs.some((href) => href.startsWith("/training/")),
    false,
    "Generation navigation should not surface training-owned resources.",
  );
  assert.equal(
    trainingHrefs.includes("/assets/presets") || trainingHrefs.includes("/presets"),
    false,
    "Training navigation should not point at generation preset resources.",
  );
  assert.equal(
    trainingHrefs.includes("/assets/templates") || trainingHrefs.includes("/templates"),
    false,
    "Training navigation should not point at generation template resources.",
  );
  assert.equal(generationHrefs.includes("/assets/models"), true, "Models remain a shared resource.");
  assert.equal(trainingHrefs.includes("/assets/models"), true, "Models remain a shared resource.");
  assert.equal(generationHrefs.includes("/settings"), true, "Settings remain a shared resource.");
  assert.equal(trainingHrefs.includes("/settings"), true, "Settings remain a shared resource.");
});

test("resource navigation and loaders do not mix generation and training owned resources", async () => {
  const { buildWorkModeResourceTargetList } = await import("../src/lib/work-mode-resources");
  const generationTargets = buildWorkModeResourceTargetList("generation");
  const trainingTargets = buildWorkModeResourceTargetList("lora_training");

  const routePrefixesFor = (target: (typeof generationTargets)[number]) => {
    const activePrefixes = target.activePrefix
      ? Array.isArray(target.activePrefix) ? target.activePrefix : [target.activePrefix]
      : [];
    return [target.href, ...activePrefixes];
  };
  const routeTouches = (route: string, prefix: string) => route === prefix || route.startsWith(`${prefix}/`);
  const generationOwnedPrefixes = generationTargets
    .filter((target) => target.owner === "generation")
    .flatMap(routePrefixesFor);
  const trainingOwnedPrefixes = trainingTargets
    .filter((target) => target.owner === "lora_training")
    .flatMap(routePrefixesFor);

  for (const target of generationTargets.filter((item) => item.owner === "generation")) {
    for (const route of routePrefixesFor(target)) {
      assert.equal(
        trainingOwnedPrefixes.some((prefix) => routeTouches(route, prefix)),
        false,
        `Generation resource ${target.key} should not point at training-owned route ${route}`,
      );
    }
  }

  for (const target of trainingTargets.filter((item) => item.owner === "lora_training")) {
    for (const route of routePrefixesFor(target)) {
      assert.equal(
        generationOwnedPrefixes.some((prefix) => routeTouches(route, prefix)),
        false,
        `Training resource ${target.key} should not point at generation-owned route ${route}`,
      );
    }
  }

  for (const key of ["runs", "projects", "presets", "templates"] as const) {
    assert.notEqual(
      generationTargets.find((target) => target.key === key)?.href,
      trainingTargets.find((target) => target.key === key)?.href,
      `${key} should have separate generation and training resource routes`,
    );
  }

  for (const key of ["models", "settings"] as const) {
    assert.equal(
      generationTargets.find((target) => target.key === key)?.href,
      trainingTargets.find((target) => target.key === key)?.href,
      `${key} should stay a shared resource route`,
    );
  }

  const trainingUiFiles = [
    "src/features/training/header-specs.ts",
    "src/features/training/not-found-page.tsx",
    "src/features/training/shell.tsx",
    "src/features/training/ui/training-project-pages.tsx",
    "src/features/training/ui/training-resource-pages.tsx",
    "src/features/training/ui/training-run-detail-page.tsx",
  ];
  for (const relativePath of trainingUiFiles) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.doesNotMatch(
      source,
      /["'`]\/assets\/(?:presets|templates)\b/,
      `${relativePath} should not link training pages to generation-owned resource pages.`,
    );
    assert.doesNotMatch(
      source,
      /["'`]\/api\/(?:presets|preset-library|templates)\b/,
      `${relativePath} should not call generation-owned preset/template APIs from training pages.`,
    );
  }

  const generationResourceUiFiles = [
    ...listFiles(join(process.cwd(), "src/app/assets/presets"), (name) => name.endsWith(".ts") || name.endsWith(".tsx")),
    ...listFiles(join(process.cwd(), "src/app/assets/templates"), (name) => name.endsWith(".ts") || name.endsWith(".tsx")),
  ];
  for (const filePath of generationResourceUiFiles) {
    const relativePath = relative(process.cwd(), filePath);
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /["'`]\/training\/(?:presets|templates)\b/,
      `${relativePath} should not link generation resource pages to training-owned resources.`,
    );
    assert.doesNotMatch(
      source,
      /["'`]\/api\/training\/(?:presets|scene-description|templates)\b/,
      `${relativePath} should not call training-owned preset/template APIs from generation pages.`,
    );
  }

  const trainingSnapshotSource = readFileSync(join(process.cwd(), "src/server/services/training/snapshot-service.ts"), "utf8");
  assert.match(trainingSnapshotSource, /listTrainingSceneDescriptionPresets/, "Training snapshots should load training scene-description presets.");
  assert.match(trainingSnapshotSource, /listManagedTrainingTemplates/, "Training snapshots should load training templates.");
  assert.doesNotMatch(
    trainingSnapshotSource,
    /getPresetCategoriesWithPresets|getPresetLibraryV2|listProjectTemplates/,
    "Training snapshots should not load ordinary generation preset or template lists.",
  );
});

test("generation preset list workspaces reuse the ordinary preset scope contract", () => {
  const scopedGenerationPresetListFiles = [
    "src/app/assets/presets/sort-rules/page.tsx",
  ] as const;

  for (const relativePath of scopedGenerationPresetListFiles) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(
      source,
      /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
      `${relativePath} should reuse the ordinary preset scope helper instead of owning a raw category filter.`,
    );
    assert.doesNotMatch(
      source,
      /type:\s*"preset"/,
      `${relativePath} should not hand-write generation preset category filters.`,
    );
  }
});

test("training run create-preset category hints only resolve training-owned categories", () => {
  const runPresetServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/run-preset-service.ts"), "utf8");
  assert.match(
    runPresetServiceSource,
    /trainingSceneDescriptionPresetCategory\.findFirst/,
    "Training run create-preset should resolve category hints through the dedicated training category table.",
  );
  assert.doesNotMatch(
    runPresetServiceSource,
    /prisma\.presetCategory\./,
    "Training run create-preset must not derive training preset categories from generation preset category ids.",
  );
});

test("shared model resources are not re-exposed as training-owned resources", () => {
  assert.equal(
    existsSync(join(process.cwd(), "src/app/api/training/models/route.ts")),
    false,
    "Models are shared resources; the training API namespace should not own a duplicate models route.",
  );

  const trainingManifestSource = readFileSync(join(process.cwd(), "src/app/api/training/route.ts"), "utf8");
  assert.doesNotMatch(
    trainingManifestSource,
    /\/api\/training\/models/,
    "Training manifest should advertise the shared model API instead of a training-owned model API.",
  );
  assert.match(
    trainingManifestSource,
    /\/api\/models\?kind=checkpoint/,
    "Training manifest should still point agents to the shared checkpoint model list.",
  );
  assert.match(
    trainingManifestSource,
    /\/api\/models\?kind=lora/,
    "Training manifest should still point agents to the shared LoRA model list.",
  );

  const projectPagesSource = readFileSync(join(process.cwd(), "src/features/training/ui/training-project-pages.tsx"), "utf8");
  assert.doesNotMatch(
    projectPagesSource,
    /\/api\/training\/models/,
    "Training project forms should load model options through the shared model API.",
  );
  assert.match(
    projectPagesSource,
    /fetch\("\/api\/models\?kind=checkpoint"\)/,
    "Training project forms should use the shared checkpoint model API.",
  );
});

test("generation preset import and replacement helpers keep training presets out of ordinary reads", () => {
  const promptBlockSource = readFileSync(join(process.cwd(), "src/lib/actions/prompt-block.ts"), "utf8");
  assert.match(
    promptBlockSource,
    /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation section preset imports should reuse the shared ordinary preset scope helper.",
  );
  assert.doesNotMatch(
    promptBlockSource,
    /export async function importPresetToSection[\s\S]*?prisma\.preset\.findUnique\(\{[\s\S]*?where:\s*\{\s*id:\s*presetId\s*\}/,
    "Generation section preset imports must not fetch presets by id without a resource type filter.",
  );

  const templateCrudSource = readFileSync(join(process.cwd(), "src/lib/actions/template-crud.ts"), "utf8");
  assert.match(
    templateCrudSource,
    /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation template preset imports should reuse the shared ordinary preset scope helper.",
  );

  const replacementSource = readFileSync(
    join(process.cwd(), "src/server/services/preset-section-replacement-service.ts"),
    "utf8",
  );
  assert.match(
    replacementSource,
    /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation preset replacement helpers should reuse the shared ordinary preset scope helper.",
  );

  const flowSource = readFileSync(join(process.cwd(), "src/server/services/agent-preset-variant-flow-service.ts"), "utf8");
  assert.match(
    flowSource,
    /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation agent preset flows should reuse the shared ordinary preset scope helper.",
  );

  const agentSyncSource = readFileSync(join(process.cwd(), "src/server/services/agent-preset-variant-service.ts"), "utf8");
  assert.match(
    agentSyncSource,
    /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation agent preset sync should reuse the shared ordinary preset scope helper.",
  );

  const queueDataSource = readFileSync(join(process.cwd(), "src/server/repositories/queue-data-repository.ts"), "utf8");
  assert.match(
    queueDataSource,
    /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
    "Generation queue preset display names should reuse the shared ordinary preset scope helper.",
  );

  for (const [label, source] of [
    ["prompt block imports", promptBlockSource],
    ["template preset imports", templateCrudSource],
    ["preset replacement", replacementSource],
    ["agent preset flow", flowSource],
    ["agent preset sync", agentSyncSource],
    ["queue preset display", queueDataSource],
  ] as const) {
    assert.doesNotMatch(
      source,
      /category:\s*\{\s*type:\s*"preset"\s*\}/,
      `${label} should not hand-write generation preset category filters.`,
    );
    assert.doesNotMatch(
      source,
      /where:\s*\{\s*type:\s*"preset"\s*\}/,
      `${label} should not hand-write generation preset category filters.`,
    );
  }
});

test("generation preset variant links cannot write training-owned variants", () => {
  const presetScopeSource = readFileSync(join(process.cwd(), "src/lib/actions/preset-resource-scope.ts"), "utf8");
  assert.match(
    presetScopeSource,
    /export async function assertOrdinaryPresetVariants/,
    "Shared preset scope should expose a batch guard for ordinary generation preset variants.",
  );

  const presetCrudSource = readFileSync(join(process.cwd(), "src/lib/actions/preset-variant-crud.ts"), "utf8");
  assert.match(
    presetCrudSource,
    /assertOrdinaryPresetVariants\(refs\.map\(\(ref\) => ref\.variantId\)\)/,
    "Generation preset variant link writes should reject training-owned linked variant ids before createMany.",
  );
  assert.match(
    presetCrudSource,
    /assertOrdinaryPresetVariants\(ids\)/,
    "Generation preset variant reordering should reject training-owned variant ids before updating sort order.",
  );
});

test("generation preset resolvers use the shared ordinary preset scope contract", () => {
  const scopedGenerationFiles = [
    "src/lib/actions/preset-variant-resolve.ts",
    "src/server/prompt-config/preset-resolver.ts",
    "src/server/prompt-config/preset-group-resolver.ts",
  ] as const;

  for (const relativePath of scopedGenerationFiles) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(
      source,
      /@\/lib\/actions\/preset-resource-scope/,
      `${relativePath} should import the shared preset resource scope contract.`,
    );
    assert.doesNotMatch(
      source,
      /const\s+ORDINARY_PRESET_CATEGORY_TYPE\s*=\s*"preset"/,
      `${relativePath} should not redefine the ordinary preset category type.`,
    );
    assert.doesNotMatch(
      source,
      /type:\s*"preset"/,
      `${relativePath} should not hand-write generation preset category filters.`,
    );
  }
});

test("generation project option loaders use the shared ordinary preset scope", () => {
  for (const relativePath of ["src/server/repositories/project-view-repository/form-view.ts"]) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(
      source,
      /ordinaryPresetCategoryTypeWhere|ordinaryPresetLibraryCategoryTypeWhere|ORDINARY_PRESET_CATEGORY_TYPE/,
      `${relativePath} should reuse the shared ordinary preset scope contract.`,
    );
    assert.doesNotMatch(
      source,
      /category:\s*\{\s*type:\s*"preset"\s*\}/,
      `${relativePath} should not hand-write generation preset category filters.`,
    );
    assert.doesNotMatch(
      source,
      /where:\s*\{\s*type:\s*"preset"\s*\}/,
      `${relativePath} should not hand-write generation preset category filters.`,
    );
  }
});

test("legacy training compatibility cannot create generation preset categories with a raw scope string", () => {
  const helperSource = readFileSync(join(process.cwd(), "src/server/repositories/character-lora-training/helpers.ts"), "utf8");

  assert.match(
    helperSource,
    /ORDINARY_PRESET_CATEGORY_TYPE/,
    "Legacy training compatibility should import the shared ordinary preset category constant.",
  );
  assert.doesNotMatch(
    helperSource,
    /type:\s*"preset"/,
    "Legacy training compatibility should not hand-write generation preset category type strings.",
  );
});

test("training worker task routes go through the Training worker boundary", () => {
  const taskApiPath = join(process.cwd(), "src/server/worker/training/task-api.ts");
  assert.equal(existsSync(taskApiPath), true, "Training worker task API boundary should exist under src/server/worker/training");

  const taskApiSource = readFileSync(taskApiPath, "utf8");
  assert.doesNotMatch(
    taskApiSource,
    /@\/server\/services\/character-lora-training/,
    "Training worker task boundary should not import legacy character-lora-training services directly",
  );
  assert.doesNotMatch(
    taskApiSource,
    /@\/server\/character-lora-training\/contracts/,
    "Training worker task boundary should use Training-owned DTO schemas instead of legacy CharacterLora contracts.",
  );
  assert.match(
    taskApiSource,
    /@\/lib\/training\/schemas/,
    "Training worker task boundary should consume worker task request schemas from src/lib/training/schemas.ts.",
  );
  assert.match(taskApiSource, /export async function getTrainingWorkerQueueStatus/);
  assert.match(taskApiSource, /export async function leaseNextTrainingWorkerTask/);
  assert.match(taskApiSource, /export async function heartbeatTrainingWorkerTask/);
  assert.match(taskApiSource, /export async function completeTrainingWorkerTask/);
  assert.match(taskApiSource, /export async function failTrainingWorkerTask/);

  const workerRouteFiles = listFiles(join(process.cwd(), "src/app/api/training/worker"), (name) => name === "route.ts");
  const leakingRoutes = workerRouteFiles
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("@/server/services/training/legacy-compat-service"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    leakingRoutes,
    [],
    "Training worker routes should call src/server/worker/training/task-api instead of the legacy compat service directly.",
  );

  const taskLifecycleRoutes = workerRouteFiles
    .filter((path) => path.includes(join("worker", "tasks")))
    .map((path) => readFileSync(path, "utf8").includes("@/server/worker/training/task-api"));
  assert.ok(
    taskLifecycleRoutes.every(Boolean),
    "Training worker task lifecycle routes should import the Training worker task API boundary",
  );
});

test("training worker task DTO schemas live under src/lib/training", async () => {
  const schemasSource = readFileSync(join(process.cwd(), "src/lib/training/schemas.ts"), "utf8");
  assert.match(schemasSource, /trainingWorkerTaskLeaseRequestSchema/);
  assert.match(schemasSource, /trainingWorkerTaskHeartbeatRequestSchema/);
  assert.match(schemasSource, /trainingWorkerTaskCompleteRequestSchema/);
  assert.match(schemasSource, /trainingWorkerTaskFailRequestSchema/);

  const { trainingWorkerTaskLeaseRequestSchema } = await import("../src/lib/training/schemas");
  const parsed = trainingWorkerTaskLeaseRequestSchema.parse({
    leaseOwner: "agent",
    targetId: "generation-run-1",
    targetType: "generationRun",
    workerType: "image_generation",
  });

  assert.deepEqual(parsed, {
    leaseOwner: "agent",
    targetId: "generation-run-1",
    targetType: "generationRun",
    workerType: "image_generation",
  });
  assert.throws(
    () => trainingWorkerTaskLeaseRequestSchema.parse({
      targetType: "generationRun",
      workerType: "image_generation",
    }),
    /targetType and targetId must be provided together/,
  );
});

test("training caption service uses the Training image-result repository boundary", () => {
  const captionServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/caption-service.ts"), "utf8");
  const repositoryPath = join(process.cwd(), "src/server/repositories/training/image-results.ts");

  assert.equal(
    existsSync(repositoryPath),
    true,
    "Training image-result access should live under src/server/repositories/training.",
  );
  assert.match(
    captionServiceSource,
    /@\/server\/repositories\/training\/image-results/,
    "Training caption service should call the Training image-result repository boundary.",
  );
  assert.match(captionServiceSource, /getTrainingCandidateImage/);
  assert.match(captionServiceSource, /getTrainingProductionProject/);
  assert.match(captionServiceSource, /listTrainingCandidateImages/);
  assert.match(captionServiceSource, /updateTrainingCandidateImageCaption/);
  assert.doesNotMatch(
    captionServiceSource,
    /@\/server\/services\/training\/legacy-compat-service|getLegacyTrainingCandidateImage|getLegacyTrainingProject|listLegacyTrainingCandidateImages|updateLegacyTrainingImageCaption/,
    "Training caption service should not import production image-result operations from legacy compat directly.",
  );
  assert.doesNotMatch(
    captionServiceSource,
    /CharacterLora|getCharacterLora|listCharacterLora|updateCharacterLora/,
    "Training caption service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training generation output service uses the Training image-result repository boundary", () => {
  const generationOutputServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/generation-output-service.ts"), "utf8");
  const repositorySource = readFileSync(join(process.cwd(), "src/server/repositories/training/image-results.ts"), "utf8");

  assert.match(
    generationOutputServiceSource,
    /@\/server\/repositories\/training\/image-results/,
    "Training generation output service should call the Training image-result repository boundary.",
  );
  assert.match(generationOutputServiceSource, /createTrainingReferenceImage/);
  assert.match(generationOutputServiceSource, /findTrainingReferenceImageDuplicate/);
  assert.match(generationOutputServiceSource, /getTrainingCandidateImage/);
  assert.match(generationOutputServiceSource, /getTrainingProductionProject/);
  assert.match(generationOutputServiceSource, /getTrainingReferenceImage/);
  assert.match(generationOutputServiceSource, /listTrainingReferenceImages/);
  assert.doesNotMatch(
    generationOutputServiceSource,
    /@\/server\/services\/training\/legacy-compat-service|createLegacyTrainingReferenceImage|findLegacyTrainingReferenceImageDuplicate|getLegacyTrainingCandidateImage|getLegacyTrainingProject|getLegacyTrainingReferenceImageFromRepository|listLegacyTrainingReferenceImages/,
    "Training generation output service should not import production image-result operations from legacy compat directly.",
  );
  assert.match(repositorySource, /createLegacyTrainingReferenceImage/);
  assert.match(repositorySource, /findLegacyTrainingReferenceImageDuplicate/);
  assert.match(repositorySource, /getLegacyTrainingReferenceImageFromRepository/);
  assert.match(repositorySource, /listLegacyTrainingReferenceImages/);
  assert.doesNotMatch(
    generationOutputServiceSource,
    /CharacterLora|CHARACTER_LORA|character-lora|getCharacterLora|listCharacterLora|createCharacterLora|findCharacterLora/,
    "Training generation output service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training snapshot service uses the Training snapshot repository boundary", () => {
  const snapshotServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/snapshot-service.ts"), "utf8");
  const repositorySource = readFileSync(join(process.cwd(), "src/server/repositories/training/snapshot.ts"), "utf8");

  assert.match(
    snapshotServiceSource,
    /@\/server\/repositories\/training\/snapshot/,
    "Training snapshot service should call the Training snapshot repository boundary.",
  );
  assert.match(snapshotServiceSource, /getTrainingGenerationRun/);
  assert.match(snapshotServiceSource, /getTrainingProjectOverview/);
  assert.match(snapshotServiceSource, /listTrainingCandidateImages/);
  assert.match(snapshotServiceSource, /listTrainingDatasetRevisions/);
  assert.match(snapshotServiceSource, /listTrainingProjectSections/);
  assert.match(snapshotServiceSource, /listTrainingPromptCardVersions/);
  assert.match(snapshotServiceSource, /listTrainingProductionProjects/);
  assert.match(snapshotServiceSource, /listTrainingReferenceImages/);
  assert.match(snapshotServiceSource, /listTrainingRuns/);
  assert.doesNotMatch(
    snapshotServiceSource,
    /@\/server\/services\/training\/legacy-compat-service|getLegacyTrainingGenerationRun|getLegacyTrainingProjectOverview|listLegacyTrainingCandidateImages|listLegacyTrainingDatasetRevisions|listLegacyTrainingProjectSections|listLegacyTrainingPromptCardVersions|listLegacyTrainingProjects|listLegacyTrainingReferenceImages|listLegacyTrainingRuns/,
    "Training snapshot service should not import production snapshot reads from legacy compat directly.",
  );
  assert.match(repositorySource, /getLegacyTrainingGenerationRun/);
  assert.match(repositorySource, /getLegacyTrainingProjectOverview/);
  assert.match(repositorySource, /listLegacyTrainingCandidateImages/);
  assert.match(repositorySource, /listLegacyTrainingDatasetRevisions/);
  assert.match(repositorySource, /listLegacyTrainingProjectSections/);
  assert.match(repositorySource, /listLegacyTrainingPromptCardVersions/);
  assert.match(repositorySource, /listLegacyTrainingProjects/);
  assert.match(repositorySource, /listLegacyTrainingReferenceImages/);
  assert.match(repositorySource, /listLegacyTrainingRuns/);
  assert.doesNotMatch(
    snapshotServiceSource,
    /CharacterLora|getCharacterLora|listCharacterLora/,
    "Training snapshot service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training project service uses Training-named legacy adapter aliases", () => {
  const projectServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");

  assert.match(projectServiceSource, /createLegacyTrainingProject/);
  assert.match(projectServiceSource, /getLegacyTrainingCandidateImage/);
  assert.match(projectServiceSource, /getLegacyTrainingProject/);
  assert.match(projectServiceSource, /getLegacyTrainingProjectSection/);
  assert.match(projectServiceSource, /listLegacyTrainingReferenceImages/);
  assert.match(projectServiceSource, /mapLegacyTrainingProjectError/);
  assert.match(projectServiceSource, /updateLegacyTrainingReferenceImage/);
  assert.match(projectServiceSource, /uploadLegacyTrainingReferenceImage/);
  assert.doesNotMatch(
    projectServiceSource,
    /CharacterLora|getCharacterLora|listCharacterLora|createCharacterLora|updateCharacterLora|uploadCharacterLora|mapCharacterLora/,
    "Training project service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training read service reads worker status through the Training worker task boundary", () => {
  const readServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/read-service.ts"), "utf8");

  assert.match(
    readServiceSource,
    /@\/server\/worker\/training\/task-api/,
    "Training read service should consume the Training worker task boundary instead of the legacy compat adapter.",
  );
  assert.match(readServiceSource, /getTrainingWorkerQueueStatus/);
  assert.match(readServiceSource, /mapTrainingWorkerTaskError/);
  assert.doesNotMatch(
    readServiceSource,
    /@\/server\/services\/training\/legacy-compat-service|getLegacyTrainingWorkerQueueStatus|mapLegacyTrainingGenerationError/,
    "Training read service should not read worker status through legacy adapter aliases.",
  );
  assert.doesNotMatch(
    readServiceSource,
    /CharacterLora|getCharacterLora|mapCharacterLora/,
    "Training read service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training text revision service uses Training-named legacy adapter aliases", () => {
  const textRevisionServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/text-revision-service.ts"), "utf8");

  assert.match(textRevisionServiceSource, /createLegacyTrainingPromptCardVersion/);
  assert.match(textRevisionServiceSource, /getLegacyTrainingCandidateImage/);
  assert.match(textRevisionServiceSource, /getLegacyTrainingProject/);
  assert.match(textRevisionServiceSource, /listLegacyTrainingPromptCardVersions/);
  assert.match(textRevisionServiceSource, /updateLegacyTrainingImageCaption/);
  assert.doesNotMatch(
    textRevisionServiceSource,
    /CharacterLora|getCharacterLora|listCharacterLora|createCharacterLora|updateCharacterLora/,
    "Training text revision service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training generation task draft service uses Training-named legacy adapter aliases", () => {
  const draftServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/generation-task-draft-service.ts"), "utf8");

  assert.match(draftServiceSource, /LegacyTrainingProviderInputImage/);
  assert.match(draftServiceSource, /createLegacyTrainingProjectArtifact/);
  assert.match(draftServiceSource, /enqueueLegacyTrainingSectionGenerationRun/);
  assert.match(draftServiceSource, /mapLegacyTrainingGenerationError/);
  assert.match(draftServiceSource, /writeLegacyTrainingBufferArtifact/);
  assert.match(draftServiceSource, /buildTrainingSupplementalInputImages/);
  assert.doesNotMatch(
    draftServiceSource,
    /CharacterLora|getCharacterLora|createCharacterLora|enqueueCharacterLora|writeCharacterLora|mapCharacterLora/,
    "Training generation task draft service should keep legacy CharacterLora symbol names inside the adapter boundary.",
  );
});

test("training template service has moved template CRUD off legacy adapter aliases", () => {
  const templateServiceSource = readFileSync(join(process.cwd(), "src/server/services/training/template-service.ts"), "utf8");

  assert.match(templateServiceSource, /createTrainingTemplateRow/);
  assert.match(templateServiceSource, /getTrainingTemplateRow/);
  assert.match(templateServiceSource, /listTrainingTemplateRows/);
  assert.match(templateServiceSource, /softDeleteTrainingTemplateRow/);
  assert.match(templateServiceSource, /updateTrainingTemplateRow/);
  assert.doesNotMatch(
    templateServiceSource,
    /createLegacyTrainingTemplate|getLegacyTrainingTemplateSnapshot|listLegacyTrainingTemplates|mapLegacyTrainingSectionTemplateError|updateLegacyTrainingTemplate|upsertLegacyTrainingTemplates/,
    "Training template service should use dedicated TrainingTemplate storage instead of legacy template CRUD.",
  );
});

test("training project archive and restore routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/projects/[projectId]/archive/route.ts",
    "src/app/api/training/projects/[projectId]/restore/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route project visibility mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function archiveTrainingProject/);
  assert.match(projectService, /export async function restoreTrainingProject/);
});

test("training run cancel routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/generation-tasks/[taskId]/cancel/route.ts",
    "src/app/api/training/section-runs/[runId]/cancel/route.ts",
    "src/app/api/training/training-runs/[trainingRunId]/cancel/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route cancel mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function cancelTrainingGenerationRun/);
  assert.match(projectService, /export async function cancelTrainingRun/);
});

test("training dataset revision freeze route uses the project service boundary", () => {
  const routeFile = "src/app/api/training/projects/[projectId]/dataset-revisions/route.ts";
  const source = readFileSync(join(process.cwd(), routeFile), "utf8");

  assert.match(
    source,
    /@\/server\/services\/training\/project-service/,
    `${routeFile} should route dataset freeze mutations through project-service`,
  );
  assert.doesNotMatch(
    source,
    /@\/server\/services\/training\/legacy-compat-service/,
    `${routeFile} should not fallback to legacy compat from the route layer`,
  );

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function freezeTrainingDataset/);
});

test("training run enqueue routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/sections/[sectionId]/runs/route.ts",
    "src/app/api/training/projects/[projectId]/training-runs/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route run enqueue mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function enqueueTrainingSectionGenerationRun/);
  assert.match(projectService, /export async function enqueueTrainingRun/);
});

test("training image result routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/image-results/[imageResultId]/route.ts",
    "src/app/api/training/image-results/[imageResultId]/review/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route image result mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function updateTrainingImageResult/);
  assert.match(projectService, /export async function reviewTrainingImageResult/);
});

test("training project detail route uses the project service boundary for mutations", () => {
  const routeFile = "src/app/api/training/projects/[projectId]/route.ts";
  const source = readFileSync(join(process.cwd(), routeFile), "utf8");

  assert.match(
    source,
    /@\/server\/services\/training\/project-service/,
    `${routeFile} should route project mutations through project-service`,
  );
  assert.doesNotMatch(
    source,
    /@\/server\/services\/training\/legacy-compat-service/,
    `${routeFile} should not update legacy projects from the route layer`,
  );

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function updateTrainingProject/);
});

test("training reference image routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/projects/[projectId]/reference-images/route.ts",
    "src/app/api/training/reference-images/[imageId]/route.ts",
    "src/app/api/training/reference-images/[imageId]/add-to-results/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route reference image mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function listTrainingProjectReferenceImages/);
  assert.match(projectService, /export async function uploadTrainingProjectReferenceImage/);
  assert.match(projectService, /export async function updateTrainingReferenceImage/);
  assert.match(projectService, /export async function deleteTrainingReferenceImage/);
  assert.match(projectService, /export async function addTrainingReferenceImageToResults/);
});

test("training profile route uses the project service boundary", () => {
  const routeFile = "src/app/api/training/projects/[projectId]/profile/route.ts";
  const source = readFileSync(join(process.cwd(), routeFile), "utf8");

  assert.match(
    source,
    /@\/server\/services\/training\/project-service/,
    `${routeFile} should route profile reads and writes through project-service`,
  );
  assert.doesNotMatch(
    source,
    /@\/server\/services\/training\/legacy-compat-service/,
    `${routeFile} should not read or write legacy prompt cards from the route layer`,
  );

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function getTrainingProjectProfile/);
  assert.match(projectService, /export async function updateTrainingProjectProfile/);
});
