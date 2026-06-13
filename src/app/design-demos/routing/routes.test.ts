import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { fallbackData } from "../data/fallback-data";
import { buildHeaderSpecs, findHeaderSpecForRoute } from "./header-specs";
import * as routeModule from "./routes";
import { demoHref, matchRoute, MOBILE_NAV_LINKS, NAV_LINKS, ROUTES, sampleRouteInventory } from "./routes";

const testDir = dirname(fileURLToPath(import.meta.url));
const headerSpecsSource = readFileSync(resolve(testDir, "header-specs.ts"), "utf8");

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

test("work mode navigation keeps shared models out of the LoRA training workspace", () => {
  const labels = ["运行", "项目", "预制", "模板", "模型", "设置"];

  assert.deepEqual(NAV_LINKS.map((link) => link.label), labels);
  assert.deepEqual(MOBILE_NAV_LINKS.map((link) => link.label), labels);

  const buildWorkModeNavLinks = (routeModule as Record<string, unknown>).buildWorkModeNavLinks;
  assert.equal(typeof buildWorkModeNavLinks, "function", "mode-aware nav builder should be exported");

  const generationLinks = (buildWorkModeNavLinks as (mode: "generation" | "lora_training") => typeof NAV_LINKS)("generation");
  const trainingLinks = (buildWorkModeNavLinks as (mode: "generation" | "lora_training") => typeof NAV_LINKS)("lora_training");

  assert.deepEqual(generationLinks.map((link) => link.href), [
    "/runs",
    "/projects",
    "/presets",
    "/templates",
    "/models",
    "/settings",
  ]);
  assert.deepEqual(trainingLinks.map((link) => link.href), [
    "/training/runs",
    "/training/projects",
    "/training/presets",
    "/training/templates",
    "/settings",
  ]);
  assert.equal(matchRoute("/training/models").key, "not-found", "Models should remain a shared resource page, not a LoRA training module route");
  assert.equal(trainingLinks.some((link) => link.href === "/models"), false, "Training mode should not include models in its primary workspace nav");
  assert.deepEqual(trainingLinks.slice(0, 4).map((link) => link.activePrefix), [
    "/training/runs",
    "/training/projects",
    "/training/presets",
    "/training/templates",
  ]);
});

test("LoRA training dataset header uses training-prep product language", () => {
  const spec = findHeaderSpecForRoute(fallbackData(null), "/training/projects/vela-neon/dataset");

  assert.ok(spec, "dataset route should have a header spec");
  assert.equal(spec.title, "Vela Neon Jacket / 数据集");
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

test("LoRA training route header actions are navigable instead of inert buttons", () => {
  const trainingSpecs = buildHeaderSpecs(fallbackData(null))
    .flatMap((group) => group.specs)
    .filter((spec) => spec.group === "LoRA 训练");

  assert.ok(trainingSpecs.length > 0, "LoRA training header specs should exist");

  for (const spec of trainingSpecs) {
    for (const action of spec.actions ?? []) {
      assert.ok(action.href, `${spec.key} header action "${action.label}" should have a real href or be removed`);
    }
  }
});

test("LoRA training run route headers use the matched run context", () => {
  const data = fallbackData(null);

  const completedTraining = findHeaderSpecForRoute(data, "/training/runs/training/train-vela-v5");
  assert.ok(completedTraining, "completed training run should resolve a header spec");
  assert.equal(completedTraining.title, "Vela Neon Jacket / LoRA 训练 v5");
  assert.deepEqual(completedTraining.actions?.map((action) => action.label), ["数据集版本", "创建预制"]);
  assert.equal(completedTraining.actions?.[0]?.href, "/training/projects/vela-neon/dataset/revisions/v5-current");
  assert.match(completedTraining.actions?.[1]?.href ?? "", /\/training\/presets\/new\?/);
  assert.match(completedTraining.actions?.[1]?.href ?? "", /sourceRun=train-vela-v5/);
  assert.match(completedTraining.actions?.[1]?.href ?? "", /artifact=vela_neon_v05\.safetensors/);

  const runningTraining = findHeaderSpecForRoute(data, "/training/runs/training/train-azure-v4");
  assert.ok(runningTraining, "running training run should resolve a header spec");
  assert.deepEqual(runningTraining.actions?.map((action) => action.label), ["数据集版本"]);
  assert.equal(runningTraining.actions?.[0]?.href, "/training/projects/azure-idol/dataset/revisions/v4-current");

  const failedTraining = findHeaderSpecForRoute(data, "/training/runs/training/train-noir-failed");
  assert.ok(failedTraining, "failed training run should resolve a header spec");
  assert.deepEqual(failedTraining.actions?.map((action) => action.label), ["数据集版本"]);

  const lunaGeneration = findHeaderSpecForRoute(data, "/training/runs/generation/gen-luna-profile");
  assert.ok(lunaGeneration, "generation run should resolve a header spec");
  assert.equal(lunaGeneration.title, "Luna Editorial / 角色描述生成");
  assert.deepEqual(lunaGeneration.actions?.map((action) => action.label), ["项目详情"]);
  assert.equal(lunaGeneration.actions?.[0]?.href, "/training/projects/luna-editorial");
});

test("LoRA training project route headers use the matched project context", () => {
  const data = fallbackData(null);

  const projectDetail = findHeaderSpecForRoute(data, "/training/projects/azure-idol");
  assert.ok(projectDetail, "project detail should resolve a header spec");
  assert.equal(projectDetail.title, "Azure Idol");
  assert.deepEqual(projectDetail.actions?.map((action) => action.label), ["启动训练", "保存为模板"]);
  assert.equal(projectDetail.actions?.[0]?.href, "/training/projects/azure-idol/dataset");
  assert.match(projectDetail.actions?.[1]?.href ?? "", /\/training\/templates\/new\?/);
  assert.match(projectDetail.actions?.[1]?.href ?? "", /projectId=azure-idol/);
  assert.match(projectDetail.actions?.[1]?.href ?? "", /sourceProject=Azure\+Idol/);

  const sectionDetail = findHeaderSpecForRoute(data, "/training/projects/azure-idol/sections/stage-light");
  assert.ok(sectionDetail, "section detail should resolve a header spec");
  assert.equal(sectionDetail.title, "Azure Idol / 舞台灯光");
  assert.equal(sectionDetail.back?.href, "/training/projects/azure-idol/sections");
  assert.deepEqual(sectionDetail.actions?.map((action) => action.label), ["生成样本"]);
  assert.equal(sectionDetail.actions?.[0]?.href, "/training/projects/azure-idol/sections/stage-light/generation-tasks/new");

  const profile = findHeaderSpecForRoute(data, "/training/projects/azure-idol/profile");
  assert.ok(profile, "project profile should resolve a header spec");
  assert.equal(profile.title, "Azure Idol / 角色资料");
  assert.equal(profile.subtitle, "舞台偶像风格，蓝白服装和发饰是主要训练对象。");

  const sections = findHeaderSpecForRoute(data, "/training/projects/azure-idol/sections");
  assert.ok(sections, "project sections should resolve a header spec");
  assert.equal(sections.title, "Azure Idol / 小节");
  assert.equal(sections.back?.href, "/training/projects/azure-idol");

  const results = findHeaderSpecForRoute(data, "/training/projects/azure-idol/results");
  assert.ok(results, "project results should resolve a header spec");
  assert.equal(results.title, "Azure Idol / 结果池");
  assert.equal(results.back?.href, "/training/projects/azure-idol");

  const dataset = findHeaderSpecForRoute(data, "/training/projects/azure-idol/dataset");
  assert.ok(dataset, "project dataset should resolve a header spec");
  assert.equal(dataset.title, "Azure Idol / 数据集");
  assert.equal(dataset.back?.href, "/training/projects/azure-idol");

  const generationTasks = findHeaderSpecForRoute(data, "/training/projects/azure-idol/generation-tasks");
  assert.ok(generationTasks, "project generation tasks should resolve a header spec");
  assert.equal(generationTasks.title, "Azure Idol / 生成任务");
  assert.equal(generationTasks.actions?.[0]?.href, "/training/projects/azure-idol/sections/stage-light/generation-tasks/new");

  const trainingRuns = findHeaderSpecForRoute(data, "/training/projects/azure-idol/training-runs");
  assert.ok(trainingRuns, "project training runs should resolve a header spec");
  assert.equal(trainingRuns.title, "Azure Idol / 训练任务");
  assert.equal(trainingRuns.actions?.[0]?.href, "/training/projects/azure-idol/dataset");

  const datasetRevision = findHeaderSpecForRoute(data, "/training/projects/azure-idol/dataset/revisions/v4-current");
  assert.ok(datasetRevision, "dataset revision should resolve a header spec");
  assert.equal(datasetRevision.title, "Azure Idol / 数据集 v4");
  assert.equal(datasetRevision.back?.href, "/training/projects/azure-idol/dataset");
});

test("LoRA training project headers do not keep sample actions for invalid project ids", () => {
  const data = fallbackData(null);

  const missingProject = findHeaderSpecForRoute(data, "/training/projects/missing-project");
  assert.ok(missingProject, "invalid project route should still resolve a generic header spec");
  assert.equal(missingProject.title, "训练项目总览");
  assert.equal(missingProject.back?.href, "/training/projects");
  assert.equal(missingProject.actions, undefined);

  const missingProjectGenerationTasks = findHeaderSpecForRoute(data, "/training/projects/missing-project/generation-tasks");
  assert.ok(missingProjectGenerationTasks, "invalid project subroute should still resolve a generic header spec");
  assert.equal(missingProjectGenerationTasks.title, "项目生成任务");
  assert.equal(missingProjectGenerationTasks.back?.href, "/training/projects");
  assert.equal(missingProjectGenerationTasks.actions, undefined);
  assert.notEqual(missingProjectGenerationTasks.actions?.[0]?.href, "/training/projects/vela-neon/sections/stage-light/generation-tasks/new");
});

test("LoRA training project generation header action selects an enabled section entry", () => {
  const helperStart = headerSpecsSource.indexOf("function trainingProjectGenerationEntrySectionId");
  const helperEnd = headerSpecsSource.indexOf("function projectHeaderBase", helperStart);
  const projectHeaderStart = headerSpecsSource.indexOf("function loraTrainingProjectHeader");
  const runHeaderStart = headerSpecsSource.indexOf("function loraTrainingRunDetailHeader");
  assert.notEqual(helperStart, -1, "header specs should define a named generation entry section helper");
  assert.notEqual(helperEnd, -1);
  assert.notEqual(projectHeaderStart, -1);
  assert.notEqual(runHeaderStart, -1);

  const helperSource = headerSpecsSource.slice(helperStart, helperEnd);
  const projectHeaderSource = headerSpecsSource.slice(projectHeaderStart, runHeaderStart);

  assert.match(helperSource, /project\.sections\.find\(\(section\) => section\.enabled\)/, "header generation actions should prefer enabled sections");
  assert.match(helperSource, /\?\? project\.sections\[0\]/, "header generation actions should fall back to a concrete section before the placeholder id");
  assert.match(projectHeaderSource, /trainingProjectGenerationEntrySectionId\(project\)/, "project generation header should use the explicit helper");
  assert.doesNotMatch(projectHeaderSource, /project\.sections\[0\]\?\.id/, "project generation header should not silently target the first section");
});

test("LoRA training resource route headers use the matched preset and template context", () => {
  const data = fallbackData(null);

  const presetDetail = findHeaderSpecForRoute(data, "/training/presets/rainy-street");
  assert.ok(presetDetail, "preset detail should resolve a header spec");
  assert.equal(presetDetail.title, "雨后街角");
  assert.equal(presetDetail.subtitle, "环境 / 城市 · 更新 15:48");

  const templateEdit = findHeaderSpecForRoute(data, "/training/templates/portrait-soft/edit");
  assert.ok(templateEdit, "template edit should resolve a header spec");
  assert.equal(templateEdit.title, "柔和肖像模板");
  assert.equal(templateEdit.subtitle, "偏轻量的人像模板，适合资料较完整的角色快速生成训练集。");

  const templateSection = findHeaderSpecForRoute(data, "/training/templates/portrait-soft/sections/1");
  assert.ok(templateSection, "template section should resolve a header spec");
  assert.equal(templateSection.title, "柔和肖像模板 / 服装补充");
  assert.equal(templateSection.back?.href, "/training/templates/portrait-soft/edit");
});

test("LoRA training template section headers do not replace invalid indexes with first fixtures", () => {
  const data = fallbackData(null);

  const invalidTemplateSection = findHeaderSpecForRoute(data, "/training/templates/portrait-soft/sections/99");
  assert.ok(invalidTemplateSection, "invalid template section route should still resolve a header spec");
  assert.equal(invalidTemplateSection.title, "柔和肖像模板");
  assert.equal(invalidTemplateSection.subtitle, "偏轻量的人像模板，适合资料较完整的角色快速生成训练集。");
  assert.equal(invalidTemplateSection.back?.href, "/training/templates/portrait-soft/edit");
  assert.notEqual(invalidTemplateSection.title, "柔和肖像模板 / 半身特写");

  const helperStart = headerSpecsSource.indexOf("function findLoraTrainingTemplateSection");
  const helperEnd = headerSpecsSource.indexOf("function trainingProjectBaseHref", helperStart);
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);

  const helperSource = headerSpecsSource.slice(helperStart, helperEnd);

  assert.match(helperSource, /if \(!Number\.isInteger\(index\) \|\| index < 0\) return undefined;/, "invalid template section indexes should resolve to the parent header");
  assert.doesNotMatch(helperSource, /template\.sections\[safeIndex\] \?\? template\.sections\[0\]/, "header helper should not silently render the first template section");
});
