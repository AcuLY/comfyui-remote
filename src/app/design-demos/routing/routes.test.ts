import assert from "node:assert/strict";
import test from "node:test";

import { fallbackData } from "../data/fallback-data";
import { buildHeaderSpecs, findHeaderSpecForRoute } from "./header-specs";
import { demoHref, matchRoute, MOBILE_NAV_LINKS, NAV_LINKS, ROUTES, sampleRouteInventory } from "./routes";

test("LoRA training entry routes are registered in the demo router", () => {
  assert.equal(matchRoute("/training/runs").key, "training-runs");
  assert.equal(matchRoute("/training/projects").key, "training-projects");

  assert.ok(ROUTES.some((route) => route.key === "training-runs" && route.pattern === "/training/runs"));
  assert.ok(ROUTES.some((route) => route.key === "training-projects" && route.pattern === "/training/projects"));
});

test("LoRA training module registers the confirmed route tree", () => {
  const expectedRoutes = [
    ["/training/runs/generation/task-1", "training-generation-run-detail"],
    ["/training/runs/training/run-1", "training-training-run-detail"],
    ["/training/projects/new", "training-project-new"],
    ["/training/projects/project-1", "training-project-detail"],
    ["/training/projects/project-1/profile", "training-project-profile"],
    ["/training/projects/project-1/sections", "training-project-sections"],
    ["/training/projects/project-1/sections/section-1", "training-project-section-detail"],
    ["/training/projects/project-1/sections/section-1/generation-tasks/new", "training-generation-compose"],
    ["/training/projects/project-1/results", "training-project-results"],
    ["/training/projects/project-1/dataset", "training-project-dataset"],
    ["/training/projects/project-1/dataset/revisions/revision-1", "training-project-dataset-revision"],
    ["/training/projects/project-1/training-runs", "training-project-training-runs"],
    ["/training/projects/project-1/generation-tasks", "training-project-generation-tasks"],
    ["/training/presets", "training-presets"],
    ["/training/presets/new", "training-preset-new"],
    ["/training/presets/preset-1", "training-preset-detail"],
    ["/training/presets/sort-rules", "training-preset-sort-rules"],
    ["/training/templates", "training-templates"],
    ["/training/templates/new", "training-template-new"],
    ["/training/templates/template-1/edit", "training-template-edit"],
    ["/training/templates/template-1/sections/0", "training-template-section"],
  ] as const;

  for (const [route, key] of expectedRoutes) {
    assert.equal(matchRoute(route).key, key, `${route} should resolve to ${key}`);
  }
});

test("LoRA training routes stay inside the design demos route namespace", () => {
  assert.equal(demoHref("/training/runs"), "/design-demos/training/runs");
  assert.equal(demoHref("/training/projects"), "/design-demos/training/projects");
  assert.equal(
    demoHref("/training/projects/project-1/sections/section-1/generation-tasks/new"),
    "/design-demos/training/projects/project-1/sections/section-1/generation-tasks/new",
  );
});

test("LoRA training sample routes use LoRA training fixture ids", () => {
  const samples = new Map(sampleRouteInventory(fallbackData(null)).map((route) => [route.key, route.sample]));

  assert.equal(samples.get("training-generation-run-detail"), "/training/runs/generation/gen-vela-dataset");
  assert.equal(samples.get("training-training-run-detail"), "/training/runs/training/train-vela-v5");
  assert.equal(samples.get("training-project-detail"), "/training/projects/vela-neon");
  assert.equal(samples.get("training-project-profile"), "/training/projects/vela-neon/profile");
  assert.equal(samples.get("training-project-section-detail"), "/training/projects/vela-neon/sections/stage-light");
  assert.equal(samples.get("training-generation-compose"), "/training/projects/vela-neon/sections/stage-light/generation-tasks/new");
  assert.equal(samples.get("training-project-dataset-revision"), "/training/projects/vela-neon/dataset/revisions/v5-current");
  assert.equal(samples.get("training-preset-detail"), "/training/presets/cyan-rim-light");
  assert.equal(samples.get("training-template-edit"), "/training/templates/character-lora-base/edit");
  assert.equal(samples.get("training-template-section"), "/training/templates/character-lora-base/sections/0");
});

test("LoRA training primary pages are discoverable from demo navigation", () => {
  const trainingNav = NAV_LINKS.filter((link) => link.group === "LoRA 训练");
  assert.deepEqual(trainingNav.map((link) => link.href), [
    "/training/runs",
    "/training/projects",
    "/training/presets",
    "/training/templates",
  ]);
  assert.deepEqual(trainingNav.map((link) => link.activePrefix), [
    "/training/runs",
    "/training/projects",
    "/training/presets",
    "/training/templates",
  ]);

  const mobileTrainingNav = MOBILE_NAV_LINKS.filter((link) => link.href.startsWith("/training/"));
  assert.deepEqual(mobileTrainingNav.map((link) => link.href), [
    "/training/runs",
    "/training/projects",
  ]);
});

test("LoRA training dataset header uses training-prep product language", () => {
  const spec = findHeaderSpecForRoute(fallbackData(null), "/training/projects/vela-neon/dataset");

  assert.ok(spec, "dataset route should have a header spec");
  assert.equal(spec.title, "数据集");
  assert.match(spec.subtitle ?? "", /训练准备/);
  assert.doesNotMatch(spec.subtitle ?? "", /Readiness/i);
});

test("LoRA training header specs use product-facing copy instead of internal schema terms", () => {
  const blockedTerms = [
    /provenance/i,
    /dataset revision/i,
    /\bsource tree\b/i,
    /\bkeep\/reject\b/i,
    /\bkept\b/i,
    /\bcaption\b/i,
    /captionSnapshot/i,
    /\bmanifest\b/i,
    /\bscoped\b/i,
    /\btraining run list\b/i,
    /\bgeneration task list\b/i,
    /\bscene description\b/i,
    /\bvariants\b/i,
    /sceneDescriptionText/i,
    /Project-level/i,
    /section settings/i,
    /preset\/local blocks/i,
    /普通预设/,
    /多变体结构/,
    /\bComposer\b/i,
    /\blightbox\b/i,
    /\bSnapshot\b/i,
    /\bseed\b/i,
  ];
  const trainingSpecs = buildHeaderSpecs(fallbackData(null))
    .flatMap((group) => group.specs)
    .filter((spec) => spec.group === "LoRA 训练");

  assert.ok(trainingSpecs.length > 0, "LoRA training header specs should exist");

  for (const spec of trainingSpecs) {
    const copy = [spec.subtitle, spec.status].filter(Boolean).join(" ");

    for (const term of blockedTerms) {
      assert.doesNotMatch(copy, term, `${spec.key} should not expose ${term}`);
    }
  }
});
