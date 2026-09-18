import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDebugWorkflowPrompt } from "../src/server/services/workflow-debug-download";

type WorkflowNode = {
  inputs?: Record<string, unknown>;
  class_type?: string;
  _meta?: {
    title?: string;
  };
};

type WorkflowPrompt = Record<string, WorkflowNode>;
type GraphNodeInput = { name: string; type: string; link: number | null };
type GraphNodeOutput = { name: string; type: string; links: number[] | null };
type GraphNode = {
  id: number;
  type: string;
  title?: string;
  inputs: GraphNodeInput[];
  outputs: GraphNodeOutput[];
  widgets_values?: unknown[];
};
type GraphWorkflow = {
  nodes: GraphNode[];
  links: Array<[number, number, number, number, number, string]>;
};

function loadStandardWorkflow(): WorkflowPrompt {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), "config/workflows/standard-workflow.api.json"),
      "utf8",
    ),
  ) as WorkflowPrompt;
}

function asGraph(workflow: Record<string, unknown>) {
  assert.ok(Array.isArray(workflow.nodes), "debug workflow should be a ComfyUI frontend graph");
  assert.ok(Array.isArray(workflow.links), "debug workflow should include frontend graph links");
  return workflow as unknown as GraphWorkflow;
}

function findNode(graph: GraphWorkflow, id: number) {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  assert.ok(node, `expected graph node ${id} to exist`);
  return node;
}

function inputLink(node: GraphNode, inputName: string) {
  const input = node.inputs.find((candidate) => candidate.name === inputName);
  assert.ok(input, `expected ${node.id}.${inputName} input to exist`);
  return input.link;
}

test("debug workflow converts image save nodes to frontend preview image nodes", () => {
  const original = loadStandardWorkflow();
  const debug = asGraph(buildDebugWorkflowPrompt(original));

  assert.notEqual(debug, original, "debug transform should return a new workflow");
  assert.equal(original["515"].class_type, "Image Save", "original workflow should remain unchanged");

  const preview = findNode(debug, 515);
  assert.equal(preview.type, "PreviewImage");
  assert.equal(inputLink(preview, "images"), 45);
  assert.deepEqual(preview.widgets_values, []);
});

test("debug workflow adds a KSampler1 preview branch", () => {
  const debug = asGraph(buildDebugWorkflowPrompt(loadStandardWorkflow()));

  const decode = debug.nodes.find((node) => node.type === "VAEDecode" && node.title === "KSampler1 VAE Decode");
  assert.ok(decode, "debug workflow should add a VAEDecode node for KSampler1");
  assert.equal(inputLink(decode, "samples"), 52);
  assert.equal(inputLink(decode, "vae"), 53);

  const preview = debug.nodes.find((node) => node.type === "PreviewImage" && node.title === "KSampler1 Preview Image");
  assert.ok(preview, "debug workflow should add a PreviewImage node for the KSampler1 decode");
  assert.equal(inputLink(preview, "images"), 54);

  assert.equal(inputLink(findNode(debug, 410), "samples"), 38, "final output decode should keep reading KSampler2");
});

test("debug workflow adds blank lines after prompt block BREAK separators", () => {
  const workflow = loadStandardWorkflow();
  workflow["511"].inputs = { text: "character prompt BREAK pose prompt BREAK scene prompt" };
  workflow["513"].inputs = { text: "bad anatomy BREAK watermark" };

  const debug = asGraph(buildDebugWorkflowPrompt(workflow));

  assert.equal(
    findNode(debug, 511).widgets_values?.[0],
    "character prompt BREAK\n\npose prompt BREAK\n\nscene prompt",
  );
  assert.equal(findNode(debug, 513).widgets_values?.[0], "bad anatomy BREAK\n\nwatermark");
  assert.equal(
    workflow["511"].inputs?.text,
    "character prompt BREAK pose prompt BREAK scene prompt",
    "original workflow should remain unchanged",
  );
});

test("debug workflow uses one boolean to swap portrait and landscape dimensions", () => {
  const debug = asGraph(buildDebugWorkflowPrompt(loadStandardWorkflow()));
  const emptyLatent = findNode(debug, 407);
  const latentUpscale = findNode(debug, 425);
  const vertical = debug.nodes.find((node) => node.type === "PrimitiveBoolean" && node.title === "vertical");
  assert.ok(vertical, "debug workflow should expose a vertical boolean control");
  assert.deepEqual(vertical.widgets_values, [true]);

  assert.equal(inputLink(emptyLatent, "width"), 56);
  assert.equal(inputLink(emptyLatent, "height"), 61);
  assert.equal(inputLink(latentUpscale, "width"), 70);
  assert.equal(inputLink(latentUpscale, "height"), 71);

  const booleanLinks = debug.links.filter((link) => link[1] === vertical.id).map((link) => link[0]).sort((a, b) => a - b);
  assert.deepEqual(booleanLinks, [58, 72, 73, 74]);

  assert.equal(findNode(debug, 526).widgets_values?.[0], 512);
  assert.equal(findNode(debug, 528).widgets_values?.[0], 768);
  assert.equal(findNode(debug, 533).widgets_values?.[0], 1024);
  assert.equal(findNode(debug, 535).widgets_values?.[0], 1536);
});
