import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelComfyPromptsForRuns,
  type ComfyQueueCancellationDependencies,
} from "../src/server/services/comfy-queue-cancellation";

function createCancellationDeps(
  positions: Record<string, "running" | "pending" | "not_found">,
) {
  const deletedPromptBatches: string[][] = [];
  let interruptCount = 0;
  let clearCount = 0;
  const positionChecks: string[] = [];

  const deps: ComfyQueueCancellationDependencies = {
    apiUrl: "http://127.0.0.1:18188",
    clearQueueSnapshotCache: () => {
      clearCount += 1;
    },
    getQueuePosition: async (_apiUrl, promptId) => {
      positionChecks.push(promptId);
      return positions[promptId] ?? "not_found";
    },
    deleteQueueItems: async (_apiUrl, promptIds) => {
      deletedPromptBatches.push([...promptIds]);
    },
    interruptPrompt: async () => {
      interruptCount += 1;
    },
  };

  return {
    deps,
    calls: {
      deletedPromptBatches,
      get interruptCount() {
        return interruptCount;
      },
      get clearCount() {
        return clearCount;
      },
      positionChecks,
    },
  };
}

test("batch ComfyUI cancellation deletes pending prompts in one request and interrupts once", async () => {
  const { deps, calls } = createCancellationDeps({
    pendingA: "pending",
    pendingB: "pending",
    runningA: "running",
  });

  const result = await cancelComfyPromptsForRuns(
    [
      { status: "queued", comfyPromptId: "pendingA" },
      { status: "queued", comfyPromptId: "pendingB" },
      { status: "running", comfyPromptId: "runningA" },
    ],
    deps,
  );

  assert.deepEqual(calls.positionChecks, ["pendingA", "pendingB", "runningA"]);
  assert.deepEqual(calls.deletedPromptBatches, [["pendingA", "pendingB"]]);
  assert.equal(calls.interruptCount, 1);
  assert.equal(calls.clearCount, 2);
  assert.deepEqual(result, {
    deletedPromptIds: ["pendingA", "pendingB"],
    interrupted: true,
  });
});

test("paused runs with retained prompt ids remain cancellable in ComfyUI", async () => {
  const { deps, calls } = createCancellationDeps({
    pausedPending: "pending",
  });

  const result = await cancelComfyPromptsForRuns(
    [{ status: "paused", comfyPromptId: "pausedPending" }],
    deps,
  );

  assert.deepEqual(calls.positionChecks, ["pausedPending"]);
  assert.deepEqual(calls.deletedPromptBatches, [["pausedPending"]]);
  assert.equal(calls.interruptCount, 0);
  assert.deepEqual(result, {
    deletedPromptIds: ["pausedPending"],
    interrupted: false,
  });
});

test("batch ComfyUI cancellation checks prompt positions concurrently", async () => {
  let releaseFirstPosition: ((position: "pending") => void) | undefined;
  const firstPosition = new Promise<"pending">((resolve) => {
    releaseFirstPosition = resolve;
  });
  const positionChecks: string[] = [];
  const deletedPromptBatches: string[][] = [];

  const deps: ComfyQueueCancellationDependencies = {
    apiUrl: "http://127.0.0.1:18188",
    clearQueueSnapshotCache: () => {},
    getQueuePosition: async (_apiUrl, promptId) => {
      positionChecks.push(promptId);
      if (promptId === "slowPending") {
        return firstPosition;
      }
      return "pending";
    },
    deleteQueueItems: async (_apiUrl, promptIds) => {
      deletedPromptBatches.push([...promptIds]);
    },
    interruptPrompt: async () => {},
  };

  const cancellation = cancelComfyPromptsForRuns(
    [
      { status: "queued", comfyPromptId: "slowPending" },
      { status: "queued", comfyPromptId: "secondPending" },
    ],
    deps,
  );

  let assertionError: unknown;
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(positionChecks, ["slowPending", "secondPending"]);
  } catch (error) {
    assertionError = error;
  } finally {
    releaseFirstPosition?.("pending");
    await cancellation;
  }

  if (assertionError) throw assertionError;
  assert.deepEqual(deletedPromptBatches, [["slowPending", "secondPending"]]);
});
