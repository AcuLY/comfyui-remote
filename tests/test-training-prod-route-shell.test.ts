import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const layoutPath = resolve(repoRoot, "src/app/layout.tsx");
const bottomNavPath = resolve(repoRoot, "src/components/persistent-bottom-nav.tsx");
const shellPath = resolve(repoRoot, "src/components/design-demo-shell/app-shell.tsx");
const headerSurfacePath = resolve(repoRoot, "src/components/design-demo-shell/header-surface.tsx");
const buttonPath = resolve(repoRoot, "src/components/design-demo-ui/primitives/button/index.tsx");
const hrefContextPath = resolve(repoRoot, "src/app/design-demos/routing/href-context.tsx");
const trainingRoutePagePath = resolve(repoRoot, "src/app/training/[[...route]]/page.tsx");
const trainingAppClientPath = resolve(repoRoot, "src/app/training/training-app-client.tsx");
const trainingFeatureAppPath = resolve(repoRoot, "src/features/training/app.tsx");
const trainingRuntimePath = resolve(repoRoot, "src/features/training/runtime.ts");
const trainingThemePath = resolve(repoRoot, "src/features/training/theme.ts");

const layoutSource = readFileSync(layoutPath, "utf8");
const bottomNavSource = readFileSync(bottomNavPath, "utf8");
const shellSource = readFileSync(shellPath, "utf8");
const headerSurfaceSource = readFileSync(headerSurfacePath, "utf8");
const buttonSource = readFileSync(buttonPath, "utf8");
const hrefContextSource = existsSync(hrefContextPath) ? readFileSync(hrefContextPath, "utf8") : "";
const trainingRoutePageSource = existsSync(trainingRoutePagePath) ? readFileSync(trainingRoutePagePath, "utf8") : "";
const trainingAppClientSource = existsSync(trainingAppClientPath) ? readFileSync(trainingAppClientPath, "utf8") : "";
const trainingFeatureAppSource = existsSync(trainingFeatureAppPath) ? readFileSync(trainingFeatureAppPath, "utf8") : "";
const trainingRuntimeSource = existsSync(trainingRuntimePath) ? readFileSync(trainingRuntimePath, "utf8") : "";
const trainingThemeSource = existsSync(trainingThemePath) ? readFileSync(trainingThemePath, "utf8") : "";

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

test("persistent bottom nav points LoRA entry at production training routes", () => {
  assert.match(
    bottomNavSource,
    /href: "\/training\/runs", label: "LoRA训练"/,
    "LoRA nav entry should point at the production training route root",
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
    /DesignDemoShell[\s\S]*?hrefForRoute=\{\(route\) => route\}/,
    "feature-layer training app should keep product routes untouched instead of re-prefixing them with /design-demos",
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
    /TRAINING_THEME_COOKIE = "comfyui_manager_design_demo_theme"/,
    "feature-layer training theme should own the production theme cookie constant directly",
  );
});
