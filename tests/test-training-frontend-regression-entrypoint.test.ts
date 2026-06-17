import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

test("npm test includes the LoRA training frontend regression suite from tests/", () => {
  const testScript = packageJson.scripts?.test ?? "";
  const legacyTrainingTestFiles = readdirSync(join(process.cwd(), "src", "app", "design-demos", "features", "lora-training"))
    .filter((fileName) => fileName.endsWith(".test.ts"));

  assert.match(
    testScript,
    /tests\/\*\.test\.ts/,
    "npm test should include the top-level tests suite",
  );
  assert.doesNotMatch(
    testScript,
    /src\/app\/design-demos\/features\/lora-training\/\*\.test\.ts/,
    "training frontend regression tests should not require a design-demos source glob",
  );
  assert.deepEqual(
    legacyTrainingTestFiles,
    [],
    "training frontend regression tests should live under tests/ instead of src/app/design-demos",
  );
});
