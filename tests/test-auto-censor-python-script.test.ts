import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function runPythonScript(args: string[], env: Partial<NodeJS.ProcessEnv> = {}) {
  return spawnSync("python3", ["scripts/auto-censor-mosaic.py", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function firstPatternIndex(source: string, patterns: RegExp[], startIndex = 0) {
  const offsetSource = source.slice(startIndex);
  const indexes = patterns
    .map((pattern) => offsetSource.search(pattern))
    .filter((index) => index >= 0)
    .map((index) => startIndex + index);

  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

async function createImportTrapPythonPath() {
  const trapRoot = await mkdtemp(join(tmpdir(), "auto-censor-import-trap-"));
  await writeFile(
    join(trapRoot, "cv2.py"),
    "raise RuntimeError('auto-censor import trap: cv2 loaded during help')\n",
  );
  await mkdir(join(trapRoot, "ultralytics"), { recursive: true });
  await writeFile(
    join(trapRoot, "ultralytics", "__init__.py"),
    "raise RuntimeError('auto-censor import trap: ultralytics loaded during help')\n",
  );
  return trapRoot;
}

test("auto-censor Python runner is CLI-only and uses YOLO plus OpenCV mosaic", () => {
  const source = readSource("scripts/auto-censor-mosaic.py");

  assert.match(source, /from ultralytics import YOLO/);
  assert.match(source, /import cv2/);
  assert.match(source, /import math/);
  assert.match(source, /def create_mosaic/);
  assert.match(source, /block_size = max\(1, int\(mosaic_size \* 0\.1\)\)/);
  assert.match(source, /argparse\.ArgumentParser/);
  assert.match(source, /selected_classes/);
  assert.match(source, /math\.floor/);
  assert.match(source, /math\.ceil/);
  assert.match(source, /math\.isfinite/);
  assert.doesNotMatch(source, /tkinter/);
  assert.doesNotMatch(source, /TkinterDnD/);
});

test("auto-censor Python runner declares batch manifest mode while preserving single-image args", () => {
  const source = readSource("scripts/auto-censor-mosaic.py");

  assert.match(source, /argparse\.ArgumentParser/);
  assert.match(source, /--batch/);
  assert.match(source, /--input/);
  assert.match(source, /--output/);
  assert.match(source, /--model/);
  assert.match(source, /--classes/);
  assert.match(source, /--mosaic-size/);
  assert.match(source, /json\.load|json\.loads/);
});

test("auto-censor Python runner batch path loads one YOLO model before looping manifest items", () => {
  const source = readSource("scripts/auto-censor-mosaic.py");
  const batchFunctionIndex = source.indexOf("def run_batch");
  const batchFunctionSource = source.slice(batchFunctionIndex);

  const modelLoadIndex = batchFunctionSource.indexOf("YOLO(str(model_path))");
  const batchItemsLoadIndex = batchFunctionSource.indexOf("load_batch_items(batch_path)");
  const manifestReadIndex = firstPatternIndex(
    source,
    [/json\.load/, /json\.loads/],
  );
  const batchLoopIndex = firstPatternIndex(
    batchFunctionSource,
    [
      /for\s+\w+(?:,\s*\w+)?\s+in\s+(?:enumerate\()?items(?:\))?\s*:/,
      /for\s+\w+\s+in\s+manifest\[['"]items['"]\]\s*:/,
      /for\s+\w+\s+in\s+manifest\.get\(\s*['"]items['"]/,
    ],
    batchItemsLoadIndex,
  );

  assert.ok(modelLoadIndex >= 0, "YOLO model load must be present");
  assert.ok(batchFunctionIndex >= 0, "run_batch function must be present");
  assert.ok(manifestReadIndex >= 0, "batch mode must read a JSON manifest");
  assert.ok(batchItemsLoadIndex >= 0, "run_batch must load batch manifest items");
  assert.ok(
    batchItemsLoadIndex < modelLoadIndex,
    "batch manifest items must be loaded before the model run starts",
  );
  assert.ok(batchLoopIndex > batchItemsLoadIndex, "batch mode must loop over manifest items");
  assert.ok(
    modelLoadIndex < batchLoopIndex,
    "YOLO model must be loaded before per-item batch processing",
  );
  assert.doesNotMatch(
    batchFunctionSource.slice(modelLoadIndex, batchLoopIndex),
    /\ndef\s+\w+/,
    "YOLO(str(model_path)) must be in the same batch flow before the item loop, not buried in an earlier per-item helper",
  );
  assert.equal(
    batchFunctionSource.slice(batchLoopIndex).indexOf("YOLO(str(model_path))"),
    -1,
    "YOLO(str(model_path)) must not appear inside or after the per-item batch loop",
  );
});

test("auto-censor Python runner help documents batch and single-image modes without loading model dependencies", async () => {
  const trapRoot = await createImportTrapPythonPath();

  try {
    const result = runPythonScript(["--help"], {
      PYTHONPATH: trapRoot,
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /usage:/);
    assert.match(result.stdout, /--batch/);
    assert.match(result.stdout, /--input/);
    assert.match(result.stdout, /--output/);
    assert.match(result.stdout, /--model/);
    assert.match(result.stdout, /--classes/);
    assert.match(result.stdout, /--mosaic-size/);
    assert.doesNotMatch(
      `${result.stdout}\n${result.stderr}`,
      /ModuleNotFoundError|No module named|auto-censor import trap/,
    );
  } finally {
    await rm(trapRoot, { recursive: true, force: true });
  }
});

test("auto-censor Python runner rejects unsafe mosaic sizes before loading dependencies", () => {
  const result = runPythonScript([
    "--model",
    "m",
    "--input",
    "i",
    "--output",
    "o",
    "--classes",
    "2,4",
    "--mosaic-size",
    "0",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mosaic-size must be at least 20/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /ModuleNotFoundError|No module named/);
});
