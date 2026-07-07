import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  createPresetSaveQueue,
  type PresetSaveStatus,
} from "../src/app/assets/presets/use-preset-save-queue";

const formPath = "src/app/assets/presets/preset-form.tsx";
const hookPath = "src/app/assets/presets/use-preset-save-queue.ts";

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await tick();
    }
  }
  throw lastError;
}

function statusOf<TPayload>(queue: ReturnType<typeof createPresetSaveQueue<TPayload>>): PresetSaveStatus {
  return queue.getSnapshot().status;
}

test("preset save queue coalesces in-flight edits to the newest queued payload", async () => {
  const savedPayloads: string[] = [];
  const releases: Array<() => void> = [];
  const queue = createPresetSaveQueue<string>({
    initialStatus: "idle",
    onSave: async (payload) => {
      savedPayloads.push(payload);
      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    },
  });

  queue.requestSave("first");
  await waitFor(() => assert.deepEqual(savedPayloads, ["first"]));
  assert.equal(statusOf(queue), "saving");

  queue.requestSave("second");
  queue.requestSave("third");
  assert.equal(statusOf(queue), "queued");

  releases[0]?.();
  await waitFor(() => assert.deepEqual(savedPayloads, ["first", "third"]));
  assert.equal(statusOf(queue), "saving");

  releases[1]?.();
  await waitFor(() => assert.equal(statusOf(queue), "saved"));
  assert.deepEqual(savedPayloads, ["first", "third"]);
});

test("preset save queue stores failed payloads and retries them explicitly", async () => {
  const savedPayloads: string[] = [];
  let shouldFail = true;
  const queue = createPresetSaveQueue<string>({
    initialStatus: "saved",
    onSave: async (payload) => {
      savedPayloads.push(payload);
      if (shouldFail) {
        throw new Error("network unavailable");
      }
    },
  });

  queue.requestSave("draft");
  await waitFor(() => assert.equal(statusOf(queue), "error"));
  assert.equal(queue.getSnapshot().error, "network unavailable");
  assert.deepEqual(savedPayloads, ["draft"]);

  shouldFail = false;
  queue.retryFailedSave();

  await waitFor(() => assert.equal(statusOf(queue), "saved"));
  assert.equal(queue.getSnapshot().error, null);
  assert.deepEqual(savedPayloads, ["draft", "draft"]);
});

test("preset save queue can refresh its save handler without recreating queued state", async () => {
  const savedPayloads: string[] = [];
  const queue = createPresetSaveQueue<string>({
    initialStatus: "idle",
    onSave: async (payload) => {
      savedPayloads.push(`old:${payload}`);
    },
  });

  queue.updateHandlers({
    onSave: async (payload) => {
      savedPayloads.push(`new:${payload}`);
    },
  });
  queue.requestSave("draft");

  await waitFor(() => assert.equal(statusOf(queue), "saved"));
  assert.deepEqual(savedPayloads, ["new:draft"]);
});

test("preset save queue preserves falsy payloads", async () => {
  const savedPayloads: string[] = [];
  const queue = createPresetSaveQueue<string>({
    initialStatus: "idle",
    onSave: async (payload) => {
      savedPayloads.push(payload);
    },
  });

  queue.requestSave("");

  await waitFor(() => assert.equal(statusOf(queue), "saved"));
  assert.deepEqual(savedPayloads, [""]);
});

test("preset form delegates autosave status to a focused save queue hook", () => {
  assert.ok(existsSync(hookPath), `${hookPath} should own preset autosave queue state`);

  const formSource = readFileSync(formPath, "utf8");
  const hookSource = readFileSync(hookPath, "utf8");

  assert.match(hookSource, /export function usePresetSaveQueue/);
  assert.match(hookSource, /export function createPresetSaveQueue/);
  assert.match(formSource, /from "\.\/use-preset-save-queue";/);
  assert.doesNotMatch(formSource, /queuedSaveRef/);
  assert.doesNotMatch(formSource, /failedSaveRef/);
  assert.doesNotMatch(formSource, /async function flushSaveQueue/);
});
