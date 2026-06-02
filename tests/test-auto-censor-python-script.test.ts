import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function runPythonScript(args: string[]) {
  return spawnSync("python3", ["scripts/auto-censor-mosaic.py", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
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

test("auto-censor Python runner help does not require model dependencies", () => {
  const result = runPythonScript(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /usage:/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /ModuleNotFoundError|No module named/);
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
