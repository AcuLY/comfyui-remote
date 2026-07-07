import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelComfyPromptsForRuns,
  type ComfyQueueCancellationDependencies,
} from "../src/server/services/comfy-queue-cancellation";

function createCancellationDeps(
  positions: Record<string, "running" | "pending" | "not_found">,
  options: {
    apiUrl?: string;
    isRemoteTarget?: boolean;
    preflightElapsedMs?: number;
    requestTimeoutMs?: number;
  } = {},
) {
  const currentPositions = { ...positions };
  const deletedPromptBatches: string[][] = [];
  let interruptCount = 0;
  let clearCount = 0;
  let preflightCount = 0;
  let now = 0;
  const positionChecks: string[] = [];

  const deps: ComfyQueueCancellationDependencies & {
    isRemoteTarget: boolean;
    preflight: () => Promise<void>;
    requestTimeoutMs: number;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
  } = {
    apiUrl: options.apiUrl ?? "http://127.0.0.1:18188",
    isRemoteTarget: options.isRemoteTarget ?? false,
    requestTimeoutMs: options.requestTimeoutMs ?? 10_000,
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    preflight: async () => {
      preflightCount += 1;
      now += options.preflightElapsedMs ?? 5;
    },
    clearQueueSnapshotCache: () => {
      clearCount += 1;
    },
    getQueuePosition: async (_apiUrl, promptId) => {
      positionChecks.push(promptId);
      return currentPositions[promptId] ?? "not_found";
    },
    deleteQueueItems: async (_apiUrl, promptIds) => {
      deletedPromptBatches.push([...promptIds]);
      for (const promptId of promptIds) {
        currentPositions[promptId] = "not_found";
      }
    },
    interruptPrompt: async () => {
      interruptCount += 1;
      for (const [promptId, position] of Object.entries(currentPositions)) {
        if (position === "running") {
          currentPositions[promptId] = "not_found";
        }
      }
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
      get preflightCount() {
        return preflightCount;
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

  assert.deepEqual(calls.positionChecks.slice(0, 3), ["pendingA", "pendingB", "runningA"]);
  assert.deepEqual(calls.deletedPromptBatches, [["pendingA", "pendingB"]]);
  assert.equal(calls.interruptCount, 1);
  assert.equal(calls.clearCount >= 2, true);
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

  assert.equal(calls.positionChecks[0], "pausedPending");
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
  const positions: Record<string, "pending" | "not_found"> = {
    slowPending: "pending",
    secondPending: "pending",
  };

  const deps: ComfyQueueCancellationDependencies = {
    apiUrl: "http://127.0.0.1:18188",
    clearQueueSnapshotCache: () => {},
    getQueuePosition: async (_apiUrl, promptId) => {
      positionChecks.push(promptId);
      if (promptId === "slowPending") {
        if (positions.slowPending === "not_found") return "not_found";
        return firstPosition;
      }
      return positions[promptId] ?? "not_found";
    },
    deleteQueueItems: async (_apiUrl, promptIds) => {
      deletedPromptBatches.push([...promptIds]);
      for (const promptId of promptIds) {
        positions[promptId] = "not_found";
      }
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

test("local fast preflight cancels 200 pending prompts in one batch", async () => {
  const positions = Object.fromEntries(
    Array.from({ length: 200 }, (_value, index) => [`prompt-${index}`, "pending"] as const),
  );
  const { deps, calls } = createCancellationDeps(positions, {
    apiUrl: "http://127.0.0.1:8188",
    preflightElapsedMs: 5,
  });

  await cancelComfyPromptsForRuns(
    Object.keys(positions).map((promptId) => ({ status: "queued", comfyPromptId: promptId })),
    deps,
  );

  assert.equal(calls.preflightCount, 1);
  assert.deepEqual(calls.deletedPromptBatches.map((batch) => batch.length), [200]);
});

test("local cancellation caps a single request at 256 prompts", async () => {
  const positions = Object.fromEntries(
    Array.from({ length: 300 }, (_value, index) => [`prompt-${index}`, "pending"] as const),
  );
  const { deps, calls } = createCancellationDeps(positions, {
    apiUrl: "http://localhost:8188",
    preflightElapsedMs: 5,
  });

  await cancelComfyPromptsForRuns(
    Object.keys(positions).map((promptId) => ({ status: "queued", comfyPromptId: promptId })),
    deps,
  );

  assert.equal(calls.deletedPromptBatches[0]?.length, 256);
  assert.equal(calls.deletedPromptBatches[1]?.length, 44);
});

test("remote or slow preflight starts with conservative batches", async () => {
  const positions = Object.fromEntries(
    Array.from({ length: 200 }, (_value, index) => [`prompt-${index}`, "pending"] as const),
  );
  const { deps, calls } = createCancellationDeps(positions, {
    apiUrl: "http://comfy.example.test:8188",
    isRemoteTarget: true,
    preflightElapsedMs: 1_500,
  });

  await cancelComfyPromptsForRuns(
    Object.keys(positions).map((promptId) => ({ status: "queued", comfyPromptId: promptId })),
    deps,
  );

  assert.equal(calls.preflightCount, 1);
  assert.ok(calls.deletedPromptBatches.length > 1);
  assert.ok(
    calls.deletedPromptBatches.every((batch) => batch.length <= 64),
    `expected conservative batches, got ${calls.deletedPromptBatches.map((batch) => batch.length).join(",")}`,
  );
});

test("HTTP failure fails the current batch and stops later batches", async () => {
  const positions = Object.fromEntries(
    Array.from({ length: 140 }, (_value, index) => [`prompt-${index}`, "pending"] as const),
  );
  const { deps, calls } = createCancellationDeps(positions, {
    apiUrl: "http://comfy.example.test:8188",
    isRemoteTarget: true,
    preflightElapsedMs: 1_500,
  });
  deps.deleteQueueItems = async (_apiUrl, promptIds) => {
    calls.deletedPromptBatches.push([...promptIds]);
    throw new Error("ComfyUI queue delete timed out after 10000ms");
  };

  await assert.rejects(
    () =>
      cancelComfyPromptsForRuns(
        Object.keys(positions).map((promptId) => ({ status: "queued", comfyPromptId: promptId })),
        deps,
      ),
    /timed out/,
  );

  assert.deepEqual(calls.deletedPromptBatches.map((batch) => batch.length), [64]);
});

test("confirmation timeout rejects instead of reporting local cancellation success", async () => {
  let confirmationChecks = 0;
  const { deps } = createCancellationDeps(
    { promptA: "pending" },
    { requestTimeoutMs: 10, preflightElapsedMs: 1 },
  );
  deps.getQueuePosition = async () => {
    confirmationChecks += 1;
    return "pending";
  };

  await assert.rejects(
    () => cancelComfyPromptsForRuns([{ status: "queued", comfyPromptId: "promptA" }], deps),
    /confirmation timed out/,
  );
  assert.ok(confirmationChecks > 1, "confirmation should poll after the delete request");
});

test("confirmation HTTP failure fails the current batch before later batches start", async () => {
  const positions = Object.fromEntries(
    Array.from({ length: 140 }, (_value, index) => [`prompt-${index}`, "pending"] as const),
  );
  const { deps, calls } = createCancellationDeps(positions, {
    apiUrl: "http://comfy.example.test:8188",
    isRemoteTarget: true,
    preflightElapsedMs: 1_500,
    requestTimeoutMs: 10,
  });
  const confirmedBatchIndexes: number[] = [];
  deps.getQueuePosition = async (_apiUrl, promptId) => {
    calls.positionChecks.push(promptId);
    return "pending";
  };

  await assert.rejects(
    () =>
      cancelComfyPromptsForRuns(
        Object.keys(positions).map((promptId) => ({ status: "queued", comfyPromptId: promptId })),
        deps,
        {
          onBatchConfirmed: async (batch) => {
            confirmedBatchIndexes.push(batch.batchIndex);
          },
        },
      ),
    /confirmation timed out/,
  );

  assert.deepEqual(calls.deletedPromptBatches.map((batch) => batch.length), [64]);
  assert.deepEqual(confirmedBatchIndexes, []);
  assert.equal(
    calls.positionChecks.includes("prompt-64"),
    false,
    "later batches must not start after the current batch fails confirmation",
  );
});
