import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  buildResolvedConfigSnapshot,
  createQueuedRunsForPositions,
  serializeProjectSection,
  type ProjectSectionRecord,
  type QueuableProjectRecord,
} from "../src/server/repositories/project-repository/helpers";
import type { ResolvedSectionConfig } from "../src/server/prompt-config/types";
import { buildComfyPromptDraft } from "../src/server/worker/payload-builder";
import type { WorkerRunSnapshot } from "../src/server/worker/types";

function project(): QueuableProjectRecord {
  return {
    id: "project-1",
    title: "Resolver Project",
    slug: "resolver-project",
    status: "draft",
    checkpointName: "project-stale.ckpt",
    projectLevelOverrides: {
      defaultAspectRatio: "4:3",
      defaultBatchSize: 3,
    },
  };
}

function staleSection(): ProjectSectionRecord {
  return {
    id: "section-1",
    name: "Resolver Section",
    sortOrder: 0,
    enabled: true,
    latestRunId: null,
    positivePrompt: "stale section positive",
    negativePrompt: "stale section negative",
    aspectRatio: "4:3",
    shortSidePx: 512,
    batchSize: 2,
    seedPolicy1: "stale-seed-1",
    seedPolicy2: "stale-seed-2",
    ksampler1: { stale: "ksampler1" },
    ksampler2: { stale: "ksampler2" },
    upscaleFactor: 1,
    checkpointName: "section-stale.ckpt",
    loraConfig: {
      lora1: [
        {
          id: "stale-lora",
          path: "/stale.safetensors",
          weight: 0.1,
          enabled: true,
          source: "manual",
        },
      ],
      lora2: [],
    },
    extraParams: { stale: true },
    runs: [],
    promptBlocks: [
      {
        positive: "stale legacy block positive",
        negative: "stale legacy block negative",
        type: "preset",
        categoryId: "cat-stale",
        sourceId: "preset-stale",
        label: "Stale copied block",
      },
    ],
  };
}

function resolvedConfig(): ResolvedSectionConfig {
  return {
    promptBlocks: [
      {
        type: "preset",
        sourceId: "preset-fresh",
        variantId: "variant-fresh",
        categoryId: "cat-character",
        bindingId: "bind-character",
        groupBindingId: null,
        label: "Fresh Character",
        positive: "fresh resolver positive",
        negative: "fresh resolver negative",
        sortOrder: 0,
      },
    ],
    prompt: {
      positive: "fresh resolver positive",
      negative: "fresh resolver negative",
    },
    presets: [
      {
        categoryId: "cat-character",
        presetId: "preset-fresh",
        variantId: "variant-fresh",
        bindingId: "bind-character",
        label: "Fresh Character",
      },
    ],
    loraConfig: {
      lora1: [
        {
          id: "preset:bind-character:lora1:0:/fresh.safetensors",
          path: "/fresh.safetensors",
          weight: 0.75,
          enabled: true,
          source: "preset",
          sourceName: "Fresh Character",
          bindingId: "bind-character",
        },
      ],
      lora2: [],
    },
    parameters: {
      aspectRatio: "16:9",
      shortSidePx: 768,
      batchSize: 4,
      seedPolicy: "resolver-seed-1",
      seedPolicy1: "resolver-seed-1",
      seedPolicy2: "resolver-seed-2",
      upscaleFactor: 2,
      checkpointName: "resolver.ckpt",
    },
    ksampler1: { steps: 28 },
    ksampler2: { denoise: 0.4 },
    extraParams: { sampler: "resolver" },
    warnings: [],
    missingReferences: [],
  };
}

function asSnapshot(value: unknown) {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function assertSnapshotUsesResolvedConfig(
  value: unknown,
  resolved: ResolvedSectionConfig,
  expectedBatchSize: number,
) {
  const snapshot = asSnapshot(value);
  const section = asSnapshot(snapshot.section);
  const parameters = asSnapshot(snapshot.parameters);

  assert.equal(section.positivePrompt, resolved.prompt.positive);
  assert.equal(section.negativePrompt, resolved.prompt.negative);
  assert.deepEqual(snapshot.promptBlocks, resolved.promptBlocks);
  assert.deepEqual(snapshot.composedPrompt, resolved.prompt);
  assert.deepEqual(snapshot.presets, resolved.presets);
  assert.deepEqual(snapshot.loraConfig, resolved.loraConfig);
  assert.deepEqual(snapshot.ksampler1, resolved.ksampler1);
  assert.deepEqual(snapshot.ksampler2, resolved.ksampler2);
  assert.deepEqual(snapshot.extraParams, resolved.extraParams);
  assert.equal(parameters.aspectRatio, "16:9");
  assert.equal(parameters.batchSize, expectedBatchSize);
  assert.equal(snapshot.checkpointName, "resolver.ckpt");

  assert.notEqual(section.positivePrompt, "stale section positive");
  assert.notDeepEqual(snapshot.loraConfig, staleSection().loraConfig);
}

test("resolved config snapshot freezes resolver output instead of stale section fields", () => {
  const resolved = resolvedConfig();
  const snapshot = buildResolvedConfigSnapshot(
    project(),
    staleSection(),
    resolved,
    9,
  );

  assertSnapshotUsesResolvedConfig(snapshot, resolved, 9);
});

test("queued runs resolve each section before writing resolvedConfigSnapshot", async () => {
  const resolved = resolvedConfig();
  const createdRuns: unknown[] = [];
  const resolvedSectionIds: string[] = [];
  const tx = {
    run: {
      groupBy: async () => [],
      create: async (args: { data: unknown }) => {
        createdRuns.push(args.data);
        return {
          id: "run-1",
          runIndex: 1,
          status: "queued",
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        };
      },
    },
  };

  await createQueuedRunsForPositions(
    tx as never,
    project(),
    [staleSection()],
    11,
    async (sectionId, client) => {
      resolvedSectionIds.push(sectionId);
      assert.equal(client, tx);
      return resolved;
    },
  );

  assert.deepEqual(resolvedSectionIds, ["section-1"]);
  assert.equal(createdRuns.length, 1);
  const createdRun = asSnapshot(createdRuns[0]);
  assertSnapshotUsesResolvedConfig(createdRun.resolvedConfigSnapshot, resolved, 11);
});

test("project section serialization prefers resolver output over stale section fields", () => {
  const resolved = resolvedConfig();
  const serialized = serializeProjectSection(
    staleSection(),
    new Map(),
    resolved,
  );

  assert.equal(serialized.promptOverview.positivePrompt, resolved.prompt.positive);
  assert.equal(serialized.promptOverview.negativePrompt, resolved.prompt.negative);
  assert.equal(serialized.aspectRatio, "16:9");
  assert.equal(serialized.batchSize, 4);
  assert.equal(serialized.seedPolicy1, "resolver-seed-1");
  assert.equal(serialized.seedPolicy2, "resolver-seed-2");
  assert.equal(serialized.checkpointName, "resolver.ckpt");
  assert.deepEqual(serialized.ksampler1, resolved.ksampler1);
  assert.deepEqual(serialized.ksampler2, resolved.ksampler2);
  assert.deepEqual(serialized.loraConfig, resolved.loraConfig);
  assert.deepEqual(serialized.extraParams, resolved.extraParams);

  assert.notEqual(serialized.promptOverview.positivePrompt, "stale section positive");
  assert.notEqual(serialized.aspectRatio, "4:3");
  assert.notDeepEqual(serialized.loraConfig, staleSection().loraConfig);
});

test("project section serialization treats resolver nulls as authoritative", () => {
  const resolved: ResolvedSectionConfig = {
    ...resolvedConfig(),
    prompt: {
      positive: "",
      negative: null,
    },
    parameters: {
      aspectRatio: null,
      shortSidePx: null,
      batchSize: null,
      seedPolicy: null,
      seedPolicy1: null,
      seedPolicy2: null,
      upscaleFactor: null,
      checkpointName: null,
    },
    ksampler1: null,
    ksampler2: null,
    extraParams: null,
  };

  const serialized = serializeProjectSection(
    staleSection(),
    new Map(),
    resolved,
  );

  assert.equal(serialized.promptOverview.positivePrompt, "");
  assert.equal(serialized.promptOverview.negativePrompt, null);
  assert.equal(serialized.aspectRatio, null);
  assert.equal(serialized.batchSize, null);
  assert.equal(serialized.seedPolicy1, null);
  assert.equal(serialized.seedPolicy2, null);
  assert.equal(serialized.checkpointName, null);
  assert.equal(serialized.ksampler1, null);
  assert.equal(serialized.ksampler2, null);
  assert.equal(serialized.extraParams, null);
});

test("resolved config snapshots survive worker prompt draft normalization", () => {
  const resolved = resolvedConfig();
  const snapshot = buildResolvedConfigSnapshot(
    project(),
    staleSection(),
    resolved,
    13,
  );
  const persistedSnapshot = JSON.parse(JSON.stringify(snapshot)) as WorkerRunSnapshot["resolvedConfigSnapshot"];
  const run: WorkerRunSnapshot = {
    runId: "run-1",
    runIndex: 7,
    status: "queued",
    workflowId: "workflow-1",
    comfyApiUrl: "http://127.0.0.1:8188",
    outputDir: null,
    resolvedConfigSnapshot: persistedSnapshot,
    project: {
      id: "stale-project-id",
      title: "Stale Project",
      slug: "stale-project",
    },
    section: {
      id: "stale-section-id",
      name: "Stale Section",
      slug: "stale-section",
    },
  };

  const promptDraft = buildComfyPromptDraft(run);

  assert.deepEqual(promptDraft.prompt, resolved.prompt);
  assert.equal(promptDraft.parameters.batchSize, 13);
  assert.deepEqual(promptDraft.loraConfig, resolved.loraConfig);
  assert.deepEqual(promptDraft.ksampler1, resolved.ksampler1);
  assert.deepEqual(promptDraft.ksampler2, resolved.ksampler2);
  assert.deepEqual(promptDraft.extraParams, resolved.extraParams);
});
