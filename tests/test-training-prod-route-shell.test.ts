import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const layoutPath = resolve(repoRoot, "src/app/layout.tsx");
const bottomNavPath = resolve(repoRoot, "src/components/persistent-bottom-nav.tsx");
const shellPath = resolve(repoRoot, "src/app/design-demos/shell/app-shell.tsx");
const headerSurfacePath = resolve(repoRoot, "src/app/design-demos/shell/header-surface.tsx");
const buttonPath = resolve(repoRoot, "src/app/design-demos/shared/primitives/button/index.tsx");
const hrefContextPath = resolve(repoRoot, "src/app/design-demos/routing/href-context.tsx");
const trainingRoutePagePath = resolve(repoRoot, "src/app/training/[[...route]]/page.tsx");
const trainingAppClientPath = resolve(repoRoot, "src/app/training/training-app-client.tsx");

const layoutSource = readFileSync(layoutPath, "utf8");
const bottomNavSource = readFileSync(bottomNavPath, "utf8");
const shellSource = readFileSync(shellPath, "utf8");
const headerSurfaceSource = readFileSync(headerSurfacePath, "utf8");
const buttonSource = readFileSync(buttonPath, "utf8");
const hrefContextSource = existsSync(hrefContextPath) ? readFileSync(hrefContextPath, "utf8") : "";
const trainingRoutePageSource = existsSync(trainingRoutePagePath) ? readFileSync(trainingRoutePagePath, "utf8") : "";
const trainingAppClientSource = existsSync(trainingAppClientPath) ? readFileSync(trainingAppClientPath, "utf8") : "";

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
    /TrainingApp/,
    "training route entry should render a dedicated production training app client",
  );
  assert.match(
    trainingAppClientSource,
    /pathname === "\/training" \? "\/training\/runs" : pathname \?\? "\/training\/runs"/,
    "training app client should derive product training routes directly from the current pathname",
  );
  assert.match(
    trainingAppClientSource,
    /DesignDemoShell[\s\S]*?hrefForRoute=\{\(route\) => route\}/,
    "production training app should keep product routes untouched instead of re-prefixing them with /design-demos",
  );
  assert.match(
    trainingAppClientSource,
    /from "@\/features\/training\/ui"/,
    "production training app should read training pages through a dedicated feature-layer entry point",
  );
  assert.doesNotMatch(
    trainingAppClientSource,
    /from "@\/app\/design-demos\/features\/lora-training"/,
    "production training app should not import training pages directly from the design-demos app path anymore",
  );
});
