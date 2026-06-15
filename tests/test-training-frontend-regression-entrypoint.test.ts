import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

test("npm test includes the LoRA training frontend regression suite", () => {
  const testScript = packageJson.scripts?.test ?? "";

  assert.match(
    testScript,
    /src\/app\/design-demos\/features\/lora-training\/\*\.test\.ts/,
    "npm test should include the LoRA training frontend source regression tests, not only tests/*.test.ts",
  );
});
