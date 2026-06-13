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

function loadStandardWorkflow(): WorkflowPrompt {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/workflow.api.json"), "utf8"),
  ) as WorkflowPrompt;
}

function tupleEquals(value: unknown, expectedNodeId: string, expectedOutputIndex: number) {
  return Array.isArray(value) && value[0] === expectedNodeId && value[1] === expectedOutputIndex;
}

test("debug workflow converts image save nodes to preview image nodes", () => {
  const original = loadStandardWorkflow();
  const debug = buildDebugWorkflowPrompt(original) as WorkflowPrompt;

  assert.notEqual(debug, original, "debug transform should return a cloned workflow");
  assert.equal(original["515"].class_type, "Image Save", "original workflow should remain unchanged");

  assert.equal(debug["515"].class_type, "PreviewImage");
  assert.deepEqual(debug["515"].inputs, { images: ["410", 0] });
  assert.equal(debug["515"]._meta?.title, "Preview Image");
});

test("debug workflow adds a KSampler1 preview branch", () => {
  const debug = buildDebugWorkflowPrompt(loadStandardWorkflow()) as WorkflowPrompt;

  const decodeEntry = Object.entries(debug).find(([id, node]) =>
    id !== "410" &&
    node.class_type === "VAEDecode" &&
    tupleEquals(node.inputs?.samples, "3", 0) &&
    tupleEquals(node.inputs?.vae, "1", 2)
  );
  assert.ok(decodeEntry, "debug workflow should add a VAEDecode node for KSampler1");

  const [decodeId] = decodeEntry;
  const previewEntry = Object.entries(debug).find(([id, node]) =>
    id !== "515" &&
    node.class_type === "PreviewImage" &&
    tupleEquals(node.inputs?.images, decodeId, 0)
  );
  assert.ok(previewEntry, "debug workflow should add a PreviewImage node for the KSampler1 decode");

  assert.deepEqual(debug["410"].inputs?.samples, ["427", 0], "final output decode should keep reading KSampler2");
});
