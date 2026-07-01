import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";

function sourceSlice(source: string, startNeedle: string, endNeedle: string) {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const start = normalizedSource.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start needle: ${startNeedle}`);
  const end = normalizedSource.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `missing end needle: ${endNeedle}`);
  return normalizedSource.slice(start, end);
}

test("queue trash restore uses the background restore API without refreshing the heavy queue page", () => {
  const source = readFileSync("src/app/queue/queue-page-client.tsx", "utf8");
  const imports = sourceSlice(source, "import {", "type QueueControlStreamResult");
  const handleRestore = sourceSlice(
    source,
    "  function handleRestore",
    "  function handleClearTrash",
  );

  assert.doesNotMatch(
    imports,
    /restoreImage/,
    "queue trash tab should not import the direct Server Action restoreImage",
  );
  assert.match(
    handleRestore,
    /fetch\(`\/api\/images\/\$\{encodeURIComponent\(item\.imageResultId\)\}\/restore`/,
    "queue trash restore should call the dedicated image restore API with the image id",
  );
  assert.doesNotMatch(
    handleRestore,
    /await restoreImage\(/,
    "queue trash restore should not await a direct Server Action from the Client Component",
  );
  assert.doesNotMatch(
    handleRestore,
    /router\.refresh\(\)/,
    "queue trash restore should update local trash state instead of refreshing the full queue page",
  );
  assert.match(
    handleRestore,
    /setTrashItems\(\(prev\) => prev\.filter\(\(trashItem\) => trashItem\.id !== item\.id\)\)/,
    "queue trash restore should remove the restored trash record locally after the API succeeds",
  );
});
