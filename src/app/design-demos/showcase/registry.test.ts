import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ROUTES } from "../routing";
import {
  getShowcaseFamilyIdByRoute,
  SHOWCASE_COMPONENTS,
  SHOWCASE_FAMILIES,
  SHOWCASE_FAMILY_ROUTES,
} from "./registry";
import { SHOWCASE_PREVIEW_COMPONENT_NAMES } from "./preview-keys";

const expectedFamilyIds = [
  "controls",
  "surfaces",
  "unit-items",
  "folders",
  "batch-actions",
  "generation-params",
  "preset-prompt-lora",
  "taxonomy-history",
  "images",
  "runs",
  "system",
  "headers",
  "icons",
] as const;

const removedRouteFragments = [
  "atoms",
  "mid",
  "editor",
  "projects",
  "image-list-components",
];

const showcasePages = [
  "pages/component-previews.tsx",
  "pages/family-samples.tsx",
  "pages/family-page.tsx",
  "pages/headers-page.tsx",
  "pages/icons-page.tsx",
  "pages/index-page.tsx",
] as const;

const removedShowcaseFiles = [
  "icons/icons-page.tsx",
] as const;

const sharedPatternsThatNeedFeatureUse = [
  "UnitRowShell",
  "FolderBreadcrumb",
  "FolderRow",
  "MoveTargetPicker",
  "SelectionBatchBar",
  "WorkbenchSurface",
  "EditorBlock",
  "InspectorAside",
  "SortableRowShell",
  "AnchorRail",
] as const;

const deletedTopLevelPathSegments = new Set([
  "ui",
  "utils",
  "projects",
  "presets",
  "templates",
  "models",
  "runs",
  "system",
  "batch-create",
  "section-editor",
  "icon-showcase",
]);

const allowedDirectImports = new Set([
  // Fixture data and header specialty previews are allowed direct architectural imports.
  "../../data",
  "../../shell/header-surface",
  "../helpers",
  "../preview-keys",
  "../registry",
  "./headers-page",
  "./icons-page",
  "./showcase-pages.module.css",
  "./headers-page.module.css",
]);

const crossLayerImportPattern = /from\s+["'](\.\.\/\.\.\/[^"']+)["']/g;
const testDir = dirname(fileURLToPath(import.meta.url));
const demoClientSource = readFileSync(resolve(testDir, "../shell/app-client.tsx"), "utf8");
const familyPageSource = readFileSync(resolve(testDir, "pages/family-page.tsx"), "utf8");
const designDemosDir = resolve(testDir, "..");

function sourceFilesUnder(relativeDir: string) {
  const root = resolve(designDemosDir, relativeDir);
  const files: string[] = [];

  function visit(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = resolve(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        visit(path);
      } else if (/\.(ts|tsx)$/.test(path)) {
        files.push(path);
      }
    }
  }

  visit(root);
  return files;
}

function filesUnder(relativeDir: string, extensionPattern: RegExp) {
  const root = resolve(designDemosDir, relativeDir);
  const files: string[] = [];

  function visit(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = resolve(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        visit(path);
      } else if (extensionPattern.test(path)) {
        files.push(path);
      }
    }
  }

  visit(root);
  return files;
}

function assertNoForbiddenImports(relativeDir: string, forbiddenTargets: string[]) {
  const importPattern = /(?:import|export)\s+(?:type\s+)?[^"']*?\sfrom\s+["']([^"']+)["']/g;

  for (const sourcePath of sourceFilesUnder(relativeDir)) {
    const source = readFileSync(sourcePath, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const importPath = match[1];
      assert.ok(
        !forbiddenTargets.some((target) => importPath.includes(target)),
        `${relative(process.cwd(), sourcePath)} must not import ${importPath}`,
      );
    }
  }
}

function sourcePathExists(sourcePath: string) {
  const absolutePath = resolve(designDemosDir, sourcePath);
  const candidates = [
    absolutePath,
    `${absolutePath}.ts`,
    `${absolutePath}.tsx`,
    resolve(absolutePath, "index.ts"),
    resolve(absolutePath, "index.tsx"),
    `${absolutePath}.module.css`,
  ];

  return candidates.some((candidate) => existsSync(candidate));
}

function joinedSourceUnder(relativeDir: string) {
  return sourceFilesUnder(relativeDir)
    .map((sourcePath) => readFileSync(sourcePath, "utf8"))
    .join("\n");
}

assert.deepEqual(
  SHOWCASE_FAMILIES.map((family) => family.id),
  expectedFamilyIds,
  "showcase family order must match the approved functional taxonomy",
);

assert.equal(
  new Set(SHOWCASE_FAMILIES.map((family) => family.route)).size,
  SHOWCASE_FAMILIES.length,
  "showcase family routes must be unique",
);

for (const family of SHOWCASE_FAMILIES) {
  assert.match(family.title, /[\u3400-\u9fff]/, `${family.id} needs a Chinese review title`);
  assert.match(family.summary, /[\u3400-\u9fff]/, `${family.id} needs a Chinese summary`);
  assert.ok(family.route.startsWith("/component-showcase-"), `${family.id} route should live under component-showcase family routes`);
  assert.ok(!family.route.startsWith("#family-"), `${family.id} route navigation must not use page anchors`);
  assert.ok(!removedRouteFragments.some((fragment) => family.route.includes(fragment)), `${family.id} must not use removed showcase route naming`);
  assert.equal(SHOWCASE_FAMILY_ROUTES[family.id], family.route, `${family.id} route map should match family registry`);
  assert.ok(
    ROUTES.some((route) => route.pattern === family.route && route.key === family.route.slice(1)),
    `${family.id} route must be a registered /component-showcase-* route`,
  );
  assert.equal(getShowcaseFamilyIdByRoute(family.route), family.id, `${family.id} route should resolve from registry`);
  assert.equal(getShowcaseFamilyIdByRoute(family.route.slice(1)), family.id, `${family.id} route resolver should normalize a missing slash`);

  const components = SHOWCASE_COMPONENTS.filter((component) => component.familyId === family.id);
  assert.ok(components.length > 0, `${family.id} must document at least one review item`);
}

assert.ok(
  !SHOWCASE_COMPONENTS.some((component) => component.componentName === `FloatingSelect / ${["Select", "Like"].join("")}`),
  "controls family must not present the removed select adapter as a peer primary component",
);
assert.ok(
  !SHOWCASE_COMPONENTS.some((component) => component.componentName === `Field / ${["Text", "Area", "Field"].join("")}`),
  "controls family must not present the removed textarea adapter as a peer primary component",
);

const baseSelectControl = SHOWCASE_COMPONENTS.find((component) => component.componentName === "FloatingSelect");
assert.ok(baseSelectControl, "controls family must document FloatingSelect as the base dropdown select primitive");
assert.equal(baseSelectControl.familyId, "controls", "FloatingSelect belongs in the controls family");
assert.ok(baseSelectControl.paths.includes("shared/primitives/floating-select"), "FloatingSelect path must be listed");
assert.ok(!baseSelectControl.paths.includes(["shared/primitives/select", "like"].join("-")), "removed select adapter path must not be listed");
assert.doesNotMatch(baseSelectControl.description, new RegExp(["Select", "Like"].join("")), "FloatingSelect documentation must not mention removed select adapter");
assert.ok(
  SHOWCASE_PREVIEW_COMPONENT_NAMES.includes("FloatingSelect"),
  "base dropdown select controls must have a showcase preview key",
);

const fieldControl = SHOWCASE_COMPONENTS.find((component) => component.componentName === "Field");
assert.ok(fieldControl, "controls family must document Field as the base text field primitive");
assert.equal(fieldControl.familyId, "controls", "Field belongs in the controls family");
assert.ok(fieldControl.paths.includes("shared/primitives/field"), "Field path must be listed");
assert.ok(!fieldControl.paths.includes(["shared/primitives/text", "area", "field"].join("-")), "removed textarea adapter path must not be listed");
assert.doesNotMatch(fieldControl.description, new RegExp(["Text", "Area", "Field"].join("")), "Field documentation must not mention removed textarea adapter");
assert.ok(SHOWCASE_PREVIEW_COMPONENT_NAMES.includes("Field"), "text field controls must have a showcase preview key");

assert.match(
  demoClientSource,
  /getShowcaseFamilyIdByRoute\(match\.route\)/,
  "demo client should dispatch showcase family routes through the registry resolver",
);
assert.doesNotMatch(
  demoClientSource,
  /case "component-showcase-(controls|surfaces|unit-items|folders|batch-actions|generation-params|preset-prompt-lora|taxonomy-history|images|runs|system|headers|icons)"/,
  "demo client should not hard-code individual showcase family route cases",
);

assert.match(
  familyPageSource,
  /<MetaBlock label="归属路径" values=\{component\.paths\} kind="path" \/>/,
  "source path metadata must render with path/code chip semantics",
);
assert.match(
  familyPageSource,
  /<MetaBlock label="覆盖页面 \/ 语境" values=\{component\.usedBy\} kind="context" \/>/,
  "usage context metadata must render with context chip semantics",
);
assert.doesNotMatch(
  familyPageSource,
  /function MetaBlock[\s\S]*values\.map\(\(value\) => <code key=\{value\}>\{value\}<\/code>\)/,
  "usage context metadata such as 预设详情 must not be rendered as code tags",
);

for (const component of SHOWCASE_COMPONENTS) {
  assert.match(component.reviewName, /[\u3400-\u9fff]/, `${component.componentName} needs a Chinese review name`);
  assert.match(component.description, /[\u3400-\u9fff]/, `${component.componentName} needs a Chinese description`);
  assert.ok(component.componentName.length > 0, `${component.reviewName} needs an English component name`);
  assert.notEqual(component.status, "planned", `${component.componentName} must be extracted or removed from the registry`);
  assert.ok(
    SHOWCASE_PREVIEW_COMPONENT_NAMES.includes(component.componentName as (typeof SHOWCASE_PREVIEW_COMPONENT_NAMES)[number]),
    `${component.componentName} must have a showcase preview`,
  );
  assert.ok(component.familyId in SHOWCASE_FAMILY_ROUTES, `${component.componentName} has an unknown family id`);
  assert.ok(component.paths.length > 0, `${component.componentName} must list source paths`);
  assert.ok(!component.paths.some((path) => path.split("/").some((part) => part.startsWith("_"))), `${component.componentName} should not reference underscored implementation folders`);
  for (const sourcePath of component.paths) {
    const [topLevelSegment] = sourcePath.split("/");
    assert.ok(
      !deletedTopLevelPathSegments.has(topLevelSegment),
      `${component.componentName} must not reference deleted top-level source path ${sourcePath}`,
    );
    assert.ok(sourcePathExists(sourcePath), `${component.componentName} source path must exist: ${sourcePath}`);
  }
  assert.ok(component.usedBy.length > 0, `${component.componentName} must list covered pages or usage contexts`);
}

for (const previewName of SHOWCASE_PREVIEW_COMPONENT_NAMES) {
  assert.ok(
    SHOWCASE_COMPONENTS.some((component) => component.componentName === previewName),
    `${previewName} preview key must correspond to a registry entry`,
  );
}

const featureSource = joinedSourceUnder("features");
for (const patternName of sharedPatternsThatNeedFeatureUse) {
  assert.match(
    featureSource,
    new RegExp(`(<${patternName}\\b|\\b${patternName}\\b)`),
    `${patternName} must be used by at least one feature, not only by showcase samples`,
  );
}

for (const cssPath of filesUnder("features", /\.css$/)) {
  const source = readFileSync(cssPath, "utf8");
  const relativePath = relative(designDemosDir, cssPath);
  assert.doesNotMatch(
    source,
    /\[data-demo-pattern=/,
    `${relative(process.cwd(), cssPath)} must not target shared pattern internals through data-demo-pattern selectors`,
  );
  if (relativePath !== "features/projects/project-list-item.projects.module.css") {
    assert.doesNotMatch(
      source,
      /\.(projectDragHandle|projectItemActions|projectItemControls|projectListCard|projectListCardSelected|projectListContent|projectListMeta|projectListOpenArea|projectListRecentResult|projectListTitleLink|projectListTitleRow|projectListTitleSlot|projectSelectCheckbox|projectStatusGroup|projectUpdateDate)\b/,
      `${relative(process.cwd(), cssPath)} must not style ProjectListItem-owned CSS module classes`,
    );
  }
}

for (const page of showcasePages) {
  const sourcePath = resolve(testDir, page);
  const source = readFileSync(sourcePath, "utf8");
  const imports = source.matchAll(crossLayerImportPattern);

  for (const match of imports) {
    const importPath = match[1];
    const isArchitecturalEntry =
      importPath.startsWith("../../shared/") ||
      importPath.startsWith("../../features/") ||
      importPath.startsWith("../../routing") ||
      importPath.startsWith("../../data");

    assert.ok(
      isArchitecturalEntry || allowedDirectImports.has(importPath),
      `${relative(process.cwd(), sourcePath)} should import ${importPath} through shared/*, features/*, routing/*, or an allowed showcase fixture/specialty path`,
    );
  }
}

for (const removedFile of removedShowcaseFiles) {
  assert.ok(
    !existsSync(resolve(testDir, removedFile)),
    `${removedFile} should not exist; specialty pages belong under showcase/pages`,
  );
}

assertNoForbiddenImports("routing", ["/features/", "/showcase/"]);
assertNoForbiddenImports("shared", ["/features/"]);
