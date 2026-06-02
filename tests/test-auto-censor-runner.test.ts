import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("auto-censor env variables are exposed in env config", () => {
  const envSource = readSource("src/lib/env.ts");

  assert.match(envSource, /autoCensorModelPath:\s*process\.env\.AUTO_CENSOR_MODEL_PATH/);
  assert.match(envSource, /autoCensorPythonCmd:\s*process\.env\.AUTO_CENSOR_PYTHON_CMD/);
});

test("auto-censor runner passes fixed mosaic settings to the Python CLI", () => {
  const runnerSource = readSource("src/server/services/auto-censor-runner.ts");

  assert.match(runnerSource, /AUTO_CENSOR_SELECTED_CLASSES\s*=\s*\[2,\s*4\]/);
  assert.match(runnerSource, /AUTO_CENSOR_MOSAIC_SIZE\s*=\s*100/);
  assert.match(runnerSource, /--classes/);
  assert.match(runnerSource, /2,4/);
  assert.match(runnerSource, /--mosaic-size/);
});

test("auto-censor documentation names model path and python command env vars", () => {
  const exampleEnv = readSource(".env.example");

  assert.match(exampleEnv, /AUTO_CENSOR_MODEL_PATH/);
  assert.match(exampleEnv, /AUTO_CENSOR_PYTHON_CMD/);
});
