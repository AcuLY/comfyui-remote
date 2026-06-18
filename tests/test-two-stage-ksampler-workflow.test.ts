import { test } from "node:test";
import assert from "node:assert/strict";

import { buildWorkflowPrompt } from "../src/server/services/workflow-prompt-builder";

function workflowTemplate() {
  return {
    "1": { inputs: {} },
    "511": { inputs: {} },
    "513": { inputs: {} },
    "407": { inputs: {} },
    "522": { inputs: {} },
    "36": { inputs: { lora_1: { on: true, lora: "old.safetensors", strength: 1 } } },
    "3": { inputs: {} },
    "425": { inputs: {} },
    "427": { inputs: {} },
    "410": { inputs: { samples: ["427", 0] } },
    "515": { inputs: {} },
  } as Record<string, { inputs: Record<string, unknown> }>;
}

function nodeInputs(workflow: Record<string, unknown>, id: string) {
  const node = workflow[id] as { inputs?: Record<string, unknown> } | undefined;
  assert.ok(node, `expected node ${id}`);
  assert.ok(node.inputs, `expected inputs for node ${id}`);
  return node.inputs;
}

test("single-stage workflow removes hires nodes and renders the final upscaled size in KSampler1", () => {
  const workflow = buildWorkflowPrompt({
    workflowTemplate: workflowTemplate(),
    positivePrompt: "positive",
    negativePrompt: "negative",
    width: 512,
    height: 768,
    batchSize: 2,
    upscaleFactor: 2,
    useTwoStageKSampler: false,
    checkpointName: "model.safetensors",
    lora1List: [{ path: "style/base.safetensors", weight: 0.7, enabled: true }],
    lora2List: [{ path: "style/upscale.safetensors", weight: 1.2, enabled: true }],
    ksampler1: { steps: 20, cfg: 5, sampler_name: "euler", scheduler: "normal", denoise: 1, seedPolicy: "fixed" },
    ksampler2: { steps: 10, cfg: 7, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 0.5, seedPolicy: "fixed" },
    outputPath: "project/section",
    runId: "run-1",
  });

  assert.equal("425" in workflow, false, "single-stage workflow should remove latent upscale");
  assert.equal("427" in workflow, false, "single-stage workflow should remove KSampler2");
  assert.equal("36" in workflow, false, "single-stage workflow should remove the stage-2 LoRA loader");
  assert.deepEqual(nodeInputs(workflow, "410").samples, ["3", 0]);
  assert.equal(nodeInputs(workflow, "407").width, 1024);
  assert.equal(nodeInputs(workflow, "407").height, 1536);
  assert.deepEqual(nodeInputs(workflow, "522").lora_1, {
    on: true,
    lora: "style/base.safetensors",
    strength: 0.7,
  });
});

test("two-stage workflow stays enabled even when upscale factor is 1", () => {
  const workflow = buildWorkflowPrompt({
    workflowTemplate: workflowTemplate(),
    positivePrompt: "positive",
    negativePrompt: "negative",
    width: 512,
    height: 768,
    batchSize: 2,
    upscaleFactor: 1,
    useTwoStageKSampler: true,
    checkpointName: "model.safetensors",
    lora1List: [],
    lora2List: [{ path: "style/upscale.safetensors", weight: 1.2, enabled: true }],
    ksampler1: {},
    ksampler2: {},
    outputPath: "project/section",
    runId: "run-1",
  });

  assert.ok(workflow["425"], "two-stage workflow should keep latent upscale");
  assert.ok(workflow["427"], "two-stage workflow should keep KSampler2");
  assert.ok(workflow["36"], "two-stage workflow should keep the stage-2 LoRA loader");
  assert.deepEqual(nodeInputs(workflow, "410").samples, ["427", 0]);
  assert.equal(nodeInputs(workflow, "425").width, 512);
  assert.equal(nodeInputs(workflow, "425").height, 768);
  assert.deepEqual(nodeInputs(workflow, "36").lora_1, {
    on: true,
    lora: "style/upscale.safetensors",
    strength: 1.2,
  });
});
