import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("clearActiveRuns waits for ComfyUI cancellation before marking local rows cancelled", () => {
  const source = readFileSync("src/lib/actions/run-lifecycle.ts", "utf8");
  const start = source.indexOf("export async function clearActiveRuns");
  assert.notEqual(start, -1, "clearActiveRuns should exist");

  const end = source.indexOf("// ---------------------------------------------------------------------------", start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);

  const dbUpdateIndex = body.indexOf("const result = await prisma.run.updateMany");
  const remoteCancelIndex = body.indexOf("await cancelComfyPromptsForRuns(activeRuns)");

  assert.notEqual(dbUpdateIndex, -1, "clearActiveRuns should update Run rows");
  assert.notEqual(remoteCancelIndex, -1, "clearActiveRuns should await remote ComfyUI cancellation");
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
