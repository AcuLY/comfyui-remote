import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("clearActiveRuns waits for ComfyUI cancellation before marking local rows cancelled", () => {
  const source = readFileSync("src/lib/actions/run-lifecycle.ts", "utf8");
  const start = source.indexOf("export async function clearActiveRuns");
  assert.notEqual(start, -1, "clearActiveRuns should exist");

  const end = source.indexOf("// ---------------------------------------------------------------------------", start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);

  const remoteCancelIndex = body.indexOf("await cancelComfyPromptsForRuns(remoteRuns");
  const batchConfirmedIndex = body.indexOf("onBatchConfirmed");
  const dbUpdateIndex = body.indexOf("const result = await prisma.run.updateMany", batchConfirmedIndex);

  assert.notEqual(dbUpdateIndex, -1, "clearActiveRuns should update Run rows");
  assert.notEqual(remoteCancelIndex, -1, "clearActiveRuns should await remote ComfyUI cancellation");
  assert.notEqual(batchConfirmedIndex, -1, "clearActiveRuns should update rows from confirmed batches");
  assert.ok(
    remoteCancelIndex < dbUpdateIndex,
    "Run rows should only be marked cancelled after ComfyUI cancellation succeeds",
  );
  assert.equal(
    body.includes("void cancelComfyPromptsForRuns(activeRuns)"),
    false,
    "bulk clear must not use best-effort background ComfyUI cancellation",
  );
});

test("queue lifecycle actions do not best-effort ComfyUI failures", () => {
  const source = readFileSync("src/lib/actions/run-lifecycle.ts", "utf8");
  const queueControlStart = source.indexOf("export async function cancelRun");
  const queueControlEnd = source.indexOf("// ---------------------------------------------------------------------------\r\n// 涓€閿竻绌鸿繍琛岃褰", queueControlStart);
  const pauseControlStart = source.indexOf("export async function pauseRun");
  const pauseControlEnd = source.indexOf("// ---------------------------------------------------------------------------\r\n// 鎭㈠浠诲姟", pauseControlStart);
  const batchPauseStart = source.indexOf("export async function pauseAllRuns");
  const batchPauseEnd = source.indexOf("// ---------------------------------------------------------------------------\r\n// 涓€閿仮澶", batchPauseStart);

  const queueControlSource = [
    source.slice(queueControlStart, queueControlEnd),
    source.slice(pauseControlStart, pauseControlEnd),
    source.slice(batchPauseStart, batchPauseEnd),
  ].join("\n");

  assert.doesNotMatch(
    queueControlSource,
    /Failed to cancel in ComfyUI|Failed to cancel ComfyUI prompts|best-effort/i,
    "cancel and pause paths must not swallow ComfyUI cancellation failures",
  );
  assert.doesNotMatch(
    queueControlSource,
    /cancelComfyPromptsForRuns[\s\S]{0,120}\.catch/,
    "cancel and pause paths must not attach catch handlers to ComfyUI cancellation",
  );
});

test("pauseRun cancels ComfyUI before marking the local run paused", () => {
  const source = readFileSync("src/lib/actions/run-lifecycle.ts", "utf8");
  const start = source.indexOf("export async function pauseRun");
  assert.notEqual(start, -1, "pauseRun should exist");

  const end = source.indexOf("// ---------------------------------------------------------------------------", start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);
  const remoteCancelIndex = body.indexOf("await cancelComfyPromptsForRuns([run])");
  const dbUpdateIndex = body.indexOf("await prisma.run.updateMany");

  assert.notEqual(remoteCancelIndex, -1, "pauseRun should await remote ComfyUI cancellation");
  assert.notEqual(dbUpdateIndex, -1, "pauseRun should update the Run row");
  assert.ok(
    remoteCancelIndex < dbUpdateIndex,
    "pauseRun should only mark the run paused after ComfyUI cancellation succeeds",
  );
});
