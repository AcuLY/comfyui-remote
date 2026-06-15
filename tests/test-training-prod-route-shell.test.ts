import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const layoutPath = resolve(repoRoot, "src/app/layout.tsx");
const appShellPath = resolve(repoRoot, "src/components/app-shell.tsx");
const bottomNavPath = resolve(repoRoot, "src/components/persistent-bottom-nav.tsx");
const workModeResourcesPath = resolve(repoRoot, "src/lib/work-mode-resources.ts");
const settingsPagePath = resolve(repoRoot, "src/app/settings/page.tsx");
const shellPath = resolve(repoRoot, "src/components/design-demo-shell/app-shell.tsx");
const headerSurfacePath = resolve(repoRoot, "src/components/design-demo-shell/header-surface.tsx");
const buttonPath = resolve(repoRoot, "src/components/design-demo-ui/primitives/button/index.tsx");
const hrefContextPath = resolve(repoRoot, "src/components/design-demo-routing/href-context.tsx");
const trainingRoutePagePath = resolve(repoRoot, "src/app/training/[[...route]]/page.tsx");
const trainingAppClientPath = resolve(repoRoot, "src/app/training/training-app-client.tsx");
const trainingFeatureAppPath = resolve(repoRoot, "src/features/training/app.tsx");
const trainingRuntimePath = resolve(repoRoot, "src/features/training/runtime.ts");
const trainingShellPath = resolve(repoRoot, "src/features/training/shell.tsx");
const trainingHeaderSpecsPath = resolve(repoRoot, "src/features/training/header-specs.ts");
const trainingRoutesPath = resolve(repoRoot, "src/features/training/routes.ts");
const trainingThemePath = resolve(repoRoot, "src/features/training/theme.ts");

const layoutSource = readFileSync(layoutPath, "utf8");
const appShellSource = readFileSync(appShellPath, "utf8");
const bottomNavSource = readFileSync(bottomNavPath, "utf8");
const workModeResourcesSource = readFileSync(workModeResourcesPath, "utf8");
const settingsPageSource = readFileSync(settingsPagePath, "utf8");
const shellSource = readFileSync(shellPath, "utf8");
const headerSurfaceSource = readFileSync(headerSurfacePath, "utf8");
const buttonSource = readFileSync(buttonPath, "utf8");
const hrefContextSource = existsSync(hrefContextPath) ? readFileSync(hrefContextPath, "utf8") : "";
const trainingRoutePageSource = existsSync(trainingRoutePagePath) ? readFileSync(trainingRoutePagePath, "utf8") : "";
const trainingAppClientSource = existsSync(trainingAppClientPath) ? readFileSync(trainingAppClientPath, "utf8") : "";
const trainingFeatureAppSource = existsSync(trainingFeatureAppPath) ? readFileSync(trainingFeatureAppPath, "utf8") : "";
const trainingRuntimeSource = existsSync(trainingRuntimePath) ? readFileSync(trainingRuntimePath, "utf8") : "";
const trainingShellSource = existsSync(trainingShellPath) ? readFileSync(trainingShellPath, "utf8") : "";
const trainingHeaderSpecsSource = existsSync(trainingHeaderSpecsPath) ? readFileSync(trainingHeaderSpecsPath, "utf8") : "";
const trainingRoutesSource = existsSync(trainingRoutesPath) ? readFileSync(trainingRoutesPath, "utf8") : "";
const trainingThemeSource = existsSync(trainingThemePath) ? readFileSync(trainingThemePath, "utf8") : "";

function extractTrainingRouteKeys() {
  return [...trainingRoutesSource.matchAll(/\{\s*key:\s*"([^"]+)",\s*pattern:\s*"([^"]+)"/g)]
    .map((match) => ({ key: match[1] ?? "", pattern: match[2] ?? "" }))
    .filter((route) => route.key);
}

function extractTrainingPageSwitchCases() {
  return new Set([...trainingFeatureAppSource.matchAll(/case "([^"]+)":/g)].map((match) => match[1] ?? ""));
}

test("production app shell treats /training routes as standalone surfaces", () => {
  assert.match(
    layoutSource,
    /pathname === "\/training" \|\| pathname\.startsWith\("\/training\/"\)/,
    "root layout should recognize training routes explicitly",
  );
  assert.match(
    layoutSource,
    /isLoginPage \|\| isDesignDemoPage \|\| isTrainingPage \? children : <AppShell>\{children\}<\/AppShell>/,
    "training routes should not be wrapped in the legacy production AppShell",
  );
});

test("production training routes do not own the shared model manager page", () => {
  assert.doesNotMatch(
    trainingRoutesSource,
    /pattern:\s*"\/training\/models"/,
    "models should remain a shared resource page instead of a LoRA training module route",
  );
  assert.match(
    workModeResourcesSource,
    /href:\s*"\/assets\/models"/,
    "the shared resource contract should keep model management on the shared asset route",
  );
  assert.doesNotMatch(
    workModeResourcesSource,
    /href:\s*"\/training\/models"/,
    "the shared resource contract should not add a training-owned models page",
  );
  assert.match(
    bottomNavSource,
    /@\/lib\/work-mode-resources/,
    "persistent navigation should consume the shared resource contract.",
  );
});

test("production bottom nav resolves module-owned resources from the current work mode", () => {
  assert.doesNotMatch(
    bottomNavSource,
    /label:\s*"LoRA训练"/,
    "LoRA training should not remain a seventh standalone production nav item.",
  );
  assert.doesNotMatch(
    bottomNavSource,
    /label:\s*"待审核"/,
    "The shared run entry should be product-facing as 运行 instead of the old generation-only 待审核 label.",
  );
  for (const label of ["运行", "项目", "预制", "模板", "模型", "设置"]) {
    assert.match(workModeResourcesSource, new RegExp(`label:\\s*"${label}"`), `production resource contract should include ${label}`);
  }
  for (const href of ["/queue", "/projects", "/assets/presets", "/assets/templates", "/training/runs", "/training/projects", "/training/presets", "/training/templates"]) {
    assert.match(workModeResourcesSource, new RegExp(`href:\\s*"${href.replace(/\//g, "\\/")}"`), `production resource contract should be able to route to ${href}`);
  }
  assert.match(bottomNavSource, /WORK_MODE_STORAGE_KEY/, "production bottom nav should read the persisted work mode.");
  assert.match(bottomNavSource, /WORK_MODE_CHANGE_EVENT/, "production bottom nav should update when settings changes the work mode.");
  assert.match(bottomNavSource, /aria-label=\{modeLabel\}/, "the mode indicator should expose the current mode without becoming a seventh nav link.");
});

test("production training route headers keep caption copy product-facing", () => {
  for (const term of [
    /caption\s*缺失/i,
    /caption\s*快照/i,
    /补\s*caption/i,
    /训练前\s*readiness/i,
  ]) {
    assert.doesNotMatch(trainingHeaderSpecsSource, term, `training route headers should not expose ${term}`);
  }
  assert.match(trainingHeaderSpecsSource, /说明文本/, "training route headers should describe captions as user-facing text.");
});

test("production app shell hides generation task panel while LoRA training mode owns resource links", () => {
  assert.match(
    appShellSource,
    /resolveWorkModeForPathname/,
    "AppShell should resolve the current work mode instead of always exposing generation-only controls.",
  );
  assert.match(
    appShellSource,
    /workMode === "generation"/,
    "The generation task panel should be gated to generation mode.",
  );
  assert.doesNotMatch(
    appShellSource,
    /<PersistentBottomNav \/>\s*<TaskPanelContainer \/>/,
    "The generation task panel should not be rendered unconditionally on shared LoRA-mode pages.",
  );
});

test("production settings page exposes the work mode switch", () => {
  assert.match(
    settingsPageSource,
    /WorkModeToggle/,
    "settings should be the production place for switching generation vs LoRA training work mode.",
  );
  assert.doesNotMatch(
    settingsPageSource,
    /href=\{?["']\/training\/runs["']\}?/,
    "settings should switch mode in place instead of acting as a training shortcut.",
  );
});

test("production training route inventory is exported and every route renders a page", () => {
  const routes = extractTrainingRouteKeys();
  const pageCases = extractTrainingPageSwitchCases();
  const missingPageCases = routes
    .map((route) => route.key)
    .filter((key) => !pageCases.has(key));

  assert.match(
    trainingRoutesSource,
    /export const TRAINING_ROUTE_PATTERNS/,
    "training route patterns should be exported so route coverage can be audited without reading private source text",
  );
  assert.ok(routes.length >= 20, "training route inventory should cover the full training workspace");
  assert.deepEqual(
    routes.filter((route) => !route.pattern.startsWith("/training/")),
    [],
    "training feature route inventory should stay on production /training paths",
  );
  assert.deepEqual(
    missingPageCases,
    [],
    "every production training route key should be handled by CurrentTrainingPage",
  );
});

test("persistent bottom nav no longer exposes LoRA as a separate production route entry", () => {
  assert.doesNotMatch(
    bottomNavSource,
    /href: "\/training\/runs", label: "LoRA训练"/,
    "LoRA training should be selected through work mode resource routing instead of a separate nav item.",
  );
  assert.doesNotMatch(
    bottomNavSource,
    /design-demos\/training\/runs/,
    "production bottom nav should no longer point at the design-demos training route",
  );
});

test("design-demo shell links can be retargeted away from /design-demos", () => {
  assert.match(
    hrefContextSource,
    /export function RouteHrefProvider/,
    "route hrefs should be overridable through a shared provider",
  );
  assert.match(
    hrefContextSource,
    /export function useRouteHref/,
    "route hrefs should be readable through a shared hook",
  );
  assert.match(
    buttonSource,
    /useRouteHref/,
    "button links should respect the current route href builder",
  );
  assert.match(
    shellSource,
    /useRouteHref/,
    "shell navigation should respect the current route href builder",
  );
  assert.match(
    headerSurfaceSource,
    /useRouteHref/,
    "route header overflow links should respect the current route href builder",
  );
});

test("training routes render a production shell without the /design-demos prefix", () => {
  assert.match(
    trainingRoutePageSource,
    /loadTrainingRouteData/,
    "training route entry should use the dedicated production training data loader",
  );
  assert.match(
    trainingRoutePageSource,
    /from "@\/features\/training\/theme"/,
    "training route entry should read theme resolution through the training feature layer",
  );
  assert.doesNotMatch(
    trainingRoutePageSource,
    /from "@\/app\/design-demos\/routing\/sfw"/,
    "training route entry should not read theme resolution directly from the design-demos routing path anymore",
  );
  assert.match(
    trainingRoutePageSource,
    /TrainingApp/,
    "training route entry should render a dedicated production training app client",
  );
  assert.match(
    trainingAppClientSource,
    /export \{ TrainingApp \} from "@\/features\/training\/app";/,
    "app-layer training client should re-export the feature-layer TrainingApp",
  );
  assert.match(
    trainingFeatureAppSource,
    /pathname === "\/training" \? "\/training\/runs" : pathname \?\? "\/training\/runs"/,
    "feature-layer training app should derive product training routes directly from the current pathname",
  );
  assert.match(
    trainingFeatureAppSource,
    /TrainingShell[\s\S]*?hrefForRoute=\{\(route\) => route\}/,
    "feature-layer training app should keep product routes untouched instead of re-prefixing them with /design-demos",
  );
  assert.doesNotMatch(
    trainingFeatureAppSource,
    /DesignDemoShell|DemoTheme/,
    "feature-layer training app should not expose demo shell or theme names at the production training boundary",
  );
  assert.match(
    trainingFeatureAppSource,
    /from "@\/features\/training\/ui"/,
    "feature-layer training app should read training pages through a dedicated feature-layer entry point",
  );
  assert.doesNotMatch(
    trainingAppClientSource,
    /from "@\/features\/training\/ui"|from "@\/features\/training\/runtime"|from "@\/features\/training\/data"/,
    "app-layer training client should stay a thin re-export instead of duplicating feature-layer imports",
  );
  assert.match(
    trainingFeatureAppSource,
    /from "@\/features\/training\/runtime"/,
    "feature-layer training app should read training shell and route runtime concerns through a feature-layer runtime entry point",
  );
  assert.match(
    trainingFeatureAppSource,
    /from "@\/features\/training\/data"/,
    "feature-layer training app should read its page-data type through a feature-layer data entry point",
  );
  assert.doesNotMatch(
    trainingFeatureAppSource,
    /from "@\/app\/design-demos\/routing"/,
    "feature-layer training app should not import training route matching directly from the design-demos routing path anymore",
  );
  assert.doesNotMatch(
    trainingFeatureAppSource,
    /from "@\/app\/design-demos\/shell\/app-shell"/,
    "feature-layer training app should not import the training shell directly from the design-demos app-shell path anymore",
  );
  assert.doesNotMatch(
    trainingFeatureAppSource,
    /from "@\/app\/design-demos\/data"/,
    "feature-layer training app should not import training page data types directly from the design-demos data path anymore",
  );
  assert.doesNotMatch(
    trainingRuntimeSource,
    /from "@\/app\/design-demos\/routing"/,
    "feature-layer training runtime should not import the training route matcher directly from the design-demos routing path anymore",
  );
  assert.doesNotMatch(
    trainingRuntimeSource,
    /DesignDemoShell|DemoTheme/,
    "feature-layer training runtime should not re-export demo shell or theme names",
  );
  assert.match(
    trainingShellSource,
    /buildWorkModeResourceTargetList\("lora_training"\)/,
    "training shell should derive its navigation from the shared work-mode resource contract",
  );
  assert.match(
    trainingShellSource,
    /navigationLinks=\{buildTrainingNavigationLinks\(data\)\}/,
    "training shell should inject training-owned navigation links into the shared shell",
  );
  assert.ok(
    existsSync(trainingHeaderSpecsPath),
    "training shell should own route header specs in the training feature layer",
  );
  assert.match(
    trainingShellSource,
    /findTrainingHeaderSpecForRoute\(data,\s*currentRoute\)/,
    "training shell should derive route headers from training-owned header specs",
  );
  assert.match(
    trainingShellSource,
    /routeHeaderConfig=\{findTrainingHeaderSpecForRoute\(data,\s*currentRoute\)\}/,
    "training shell should inject training-owned route headers into the shared shell",
  );
  assert.doesNotMatch(
    trainingShellSource,
    /@\/app\/design-demos\/routing/,
    "training shell should not import design-demo routing to build production training navigation",
  );
  assert.match(
    trainingHeaderSpecsSource,
    /from "\.\/routes"/,
    "training header specs should read route matching from the local training route module",
  );
  assert.doesNotMatch(
    trainingHeaderSpecsSource,
    /@\/app\/design-demos/,
    "training header specs should not depend on design-demo routing, data, or fixtures",
  );
  assert.match(
    shellSource,
    /navigationLinks\?:/,
    "shared shell should expose a navigation injection point for production modules",
  );
  assert.match(
    shellSource,
    /navigationLinks \?\? buildWorkModeNavLinks\(workMode\)/,
    "shared shell should fall back to demo navigation only when no module-owned navigation is provided",
  );
  assert.match(
    shellSource,
    /routeHeaderConfig\?:/,
    "shared shell should expose a route header injection point for production modules",
  );
  assert.match(
    shellSource,
    /routeHeaderConfig === undefined \? defaultRouteHeaderConfig : routeHeaderConfig/,
    "shared shell should fall back to demo route headers only when no module-owned route header is provided",
  );
  assert.match(
    shellSource,
    /themePersistence\?:/,
    "shared shell should expose a theme persistence injection point for production modules",
  );
  assert.match(
    shellSource,
    /themePersistence \?\? DEFAULT_DESIGN_DEMO_THEME_PERSISTENCE/,
    "shared shell should keep the design-demo theme persistence as the default only when no module-owned persistence is provided",
  );
  assert.match(
    trainingRuntimeSource,
    /from "\.\/routes"/,
    "feature-layer training runtime should read route matching from a local training route module",
  );
  assert.doesNotMatch(
    trainingThemeSource,
    /from "@\/app\/design-demos\/routing\/sfw"/,
    "feature-layer training theme should not re-export theme helpers from the design-demos routing module anymore",
  );
  assert.match(
    trainingThemeSource,
    /TRAINING_THEME_STORAGE_KEY = "comfyui-manager:training-theme"/,
    "feature-layer training theme should own a production training localStorage key",
  );
  assert.match(
    trainingThemeSource,
    /TRAINING_THEME_COOKIE = "comfyui_manager_training_theme"/,
    "feature-layer training theme should own a production training cookie name",
  );
  assert.match(
    trainingThemeSource,
    /TRAINING_THEME_COOKIE_PATH = "\/training"/,
    "feature-layer training theme should scope the production training theme cookie to /training",
  );
  assert.doesNotMatch(
    trainingThemeSource,
    /design_demo_theme/,
    "feature-layer training theme should not reuse the design-demo theme cookie",
  );
  assert.match(
    trainingShellSource,
    /themePersistence=\{TRAINING_THEME_PERSISTENCE\}/,
    "production training shell should pass its own theme persistence contract to the shared shell",
  );
});
