import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { matchRoute, TRAINING_ROUTE_PATTERNS, type TrainingRouteKey } from "../src/features/training/routes";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");

const routeEntrySource = readFileSync(resolve(repoRoot, "src/app/training/[[...route]]/page.tsx"), "utf8");
const clientBoundarySource = readFileSync(resolve(repoRoot, "src/app/training/training-app-client.tsx"), "utf8");
const appSource = readFileSync(resolve(repoRoot, "src/features/training/app.tsx"), "utf8");
const runtimeSource = readFileSync(resolve(repoRoot, "src/features/training/runtime.ts"), "utf8");
const shellSource = readFileSync(resolve(repoRoot, "src/features/training/shell.tsx"), "utf8");

function extractTrainingPageSwitchCases() {
  return new Set([...appSource.matchAll(/case "([^"]+)":/g)].map((match) => match[1] ?? ""));
}

test("training route page stays an app-router entry and server data boundary only", () => {
  assert.doesNotMatch(routeEntrySource, /^"use client";/m, "the route entry should remain a server component");
  assert.match(routeEntrySource, /export const dynamic = "force-dynamic";/);
  assert.match(routeEntrySource, /export const runtime = "nodejs";/);
  assert.match(routeEntrySource, /const resolvedRoute = route \?\? \[\];/);
  assert.match(routeEntrySource, /redirect\("\/training\/runs"\)/);
  assert.match(routeEntrySource, /loadTrainingRouteData\(resolvedRoute\)/);
  assert.match(routeEntrySource, /<TrainingApp data=\{data\} initialTheme=\{initialTheme\} \/>/);

  for (const forbidden of [
    /@\/features\/training\/ui/,
    /@\/features\/training\/runtime/,
    /DesignDemoShell/,
    /PersistentBottomNav/,
    /\busePathname\b/,
    /\bfetch\(/,
  ]) {
    assert.doesNotMatch(routeEntrySource, forbidden, "the route entry should not own training page internals");
  }
});

test("training app client remains a hydration pass-through until it owns client state", () => {
  assert.equal(
    clientBoundarySource.trim(),
    'export { TrainingApp } from "@/features/training/app";',
    "the app-layer training client should only re-export the feature client app",
  );
  assert.doesNotMatch(
    clientBoundarySource,
    /^"use client";/m,
    "the app-layer boundary should not opt into a client bundle unless it owns state or hooks",
  );
});

test("training feature app owns route matching and page dispatch without shell internals", () => {
  const routeKeys = TRAINING_ROUTE_PATTERNS.map((definition) => definition.key);
  const switchCases = extractTrainingPageSwitchCases();

  assert.match(appSource, /^"use client";/m, "the feature app should own the client pathname read");
  assert.match(appSource, /usePathname\(\)/);
  assert.match(appSource, /matchRoute\(currentRoute\)/);
  assert.match(appSource, /function CurrentTrainingPage/);
  assert.match(appSource, /<TrainingShell[\s\S]*?<CurrentTrainingPage data=\{data\} match=\{match\} \/>/);
  assert.deepEqual(
    routeKeys.filter((key) => !switchCases.has(key)),
    [],
    "every known training route should be dispatched by the feature app",
  );

  for (const forbidden of [
    /DesignDemoShell/,
    /PersistentBottomNav/,
    /loadTrainingRouteData/,
    /\bcookies\(/,
    /\bredirect\(/,
    /\bfetch\(/,
    /@\/server\//,
    /@\/app\/design-demos\//,
  ]) {
    assert.doesNotMatch(appSource, forbidden, "the feature app should not own route data, shell chrome, or server work");
  }
});

test("training runtime exports only routing and shell primitives", () => {
  assert.doesNotMatch(runtimeSource, /^"use client";/m, "runtime primitives should not force a client boundary");
  assert.match(runtimeSource, /export \{ TrainingShell \} from "\.\/shell";/);
  assert.match(runtimeSource, /export \{ TrainingNotFoundPage as NotFoundPage \} from "\.\/not-found-page";/);
  assert.match(runtimeSource, /export \{ matchRoute \} from "\.\/routes";/);
  assert.match(runtimeSource, /export type \{ Match \} from "\.\/routes";/);
  assert.match(runtimeSource, /export type \{ TrainingTheme \} from "\.\/theme";/);

  for (const forbidden of [/@\/features\/training\/ui/, /@\/server\//, /@\/app\/design-demos\//]) {
    assert.doesNotMatch(runtimeSource, forbidden, "runtime primitives should not import page UI, server code, or demo app modules");
  }
});

test("training route matcher resolves known production paths with specific patterns first", () => {
  const cases: Array<{
    route: string;
    key: TrainingRouteKey;
    params?: Record<string, string>;
  }> = [
    { route: "/training/runs", key: "training-runs" },
    {
      route: "/training/runs/generation/task%201",
      key: "training-generation-run-detail",
      params: { taskId: "task 1" },
    },
    {
      route: "/training/runs/training/train%2F1",
      key: "training-training-run-detail",
      params: { trainingRunId: "train/1" },
    },
    { route: "/training/projects/new", key: "training-project-new" },
    { route: "/training/projects/project-1", key: "training-project-detail", params: { trainingProjectId: "project-1" } },
    {
      route: "/training/projects/project-1/sections/section-2/generation-tasks/new",
      key: "training-generation-compose",
      params: { trainingProjectId: "project-1", sectionId: "section-2" },
    },
    { route: "/training/presets/sort-rules", key: "training-preset-sort-rules" },
    { route: "/training/presets/preset-1", key: "training-preset-detail", params: { presetId: "preset-1" } },
    {
      route: "/training/templates/template-1/sections/3",
      key: "training-template-section",
      params: { templateId: "template-1", sectionIndex: "3" },
    },
    { route: "/training/not-a-real-page", key: "not-found", params: {} },
  ];

  assert.ok(TRAINING_ROUTE_PATTERNS.length >= 20, "training route primitives should cover the production workspace");
  assert.deepEqual(
    TRAINING_ROUTE_PATTERNS.filter((definition) => !definition.pattern.startsWith("/training/")),
    [],
    "training routes should stay scoped to production /training paths",
  );

  for (const { route, key, params = {} } of cases) {
    const match = matchRoute(route);
    assert.equal(match.key, key, `${route} should match ${key}`);
    assert.deepEqual(match.params, params, `${route} should decode the expected route params`);
    assert.equal(match.route, route);
  }
});

test("training shell owns training chrome while disabling inherited demo sidebar behavior", () => {
  assert.match(shellSource, /^"use client";/m, "the shell may own client shell chrome");
  assert.match(shellSource, /DesignDemoShell/);
  assert.match(shellSource, /PersistentBottomNav/);
  assert.match(shellSource, /footerNav=\{<PersistentBottomNav\s*\/>\}/);
  assert.match(shellSource, /navigationChrome="none"/);
  assert.match(shellSource, /routeHeaderActionSlots=\{getTrainingHeaderActionSlots\(currentRoute\)\}/);
  assert.match(shellSource, /routeHeaderConfig=\{findTrainingHeaderSpecForRoute\(data,\s*currentRoute\)\}/);
  assert.match(shellSource, /themePersistence=\{TRAINING_THEME_PERSISTENCE\}/);

  for (const forbidden of [
    /@\/features\/training\/ui/,
    /@\/components\/ui\/sidebar/,
    /buildTrainingNavigationLinks/,
    /navigationLinks=\{/,
    /MobileBottomNav/,
    /mobileBottomNav/,
  ]) {
    assert.doesNotMatch(shellSource, forbidden, "training shell should not reintroduce page UI or demo sidebar navigation");
  }
});
