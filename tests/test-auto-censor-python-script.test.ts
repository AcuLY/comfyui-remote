import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("auto-censor Python runner is CLI-only and uses YOLO plus OpenCV mosaic", () => {
  const source = readSource("scripts/auto-censor-mosaic.py");

  assert.match(source, /from ultralytics import YOLO/);
  assert.match(source, /import cv2/);
  assert.match(source, /def create_mosaic/);
  assert.match(source, /block_size = max\(1, int\(mosaic_size \* 0\.1\)\)/);
  assert.match(source, /argparse\.ArgumentParser/);
  assert.match(source, /selected_classes/);
  assert.doesNotMatch(source, /tkinter/);
  assert.doesNotMatch(source, /TkinterDnD/);
});
