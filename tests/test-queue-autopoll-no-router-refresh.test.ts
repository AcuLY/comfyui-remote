import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("queue auto-poll refresh updates client state without triggering a server component refresh", () => {
  const source = readSource("src/app/queue/queue-page-client.tsx");
  const refreshStart = source.indexOf("const refresh = useCallback(() => {");
  assert.notEqual(refreshStart, -1, "Queue page should define the auto-poll refresh callback");

  const refreshEnd = source.indexOf("}, [activeTab", refreshStart);
  assert.notEqual(refreshEnd, -1, "Queue page refresh callback should keep its dependency list marker");

  const refreshSource = source.slice(refreshStart, refreshEnd);
  assert.match(
    refreshSource,
    /fetch\(`\/api\/queue-data\?\$\{params\.toString\(\)\}`\)/,
    "auto-poll refresh should fetch the queue data API",
  );
  assert.doesNotMatch(
    refreshSource,
    /router\.refresh\(\)/,
    "auto-poll should not call router.refresh(), because it races the API response and resets visible queue state from server props",
  );
});
