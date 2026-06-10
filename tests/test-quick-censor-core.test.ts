import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTO_CENSOR_MOSAIC_SIZE,
  getMosaicBlockSize,
  getQuickCensorBrushSettings,
  mosaicImageData,
} from "../src/lib/quick-censor-core";

test("quick censor derives brush and block sizes from the auto-censor mosaic setting", () => {
  assert.equal(AUTO_CENSOR_MOSAIC_SIZE, 100);
  assert.equal(getMosaicBlockSize(AUTO_CENSOR_MOSAIC_SIZE), 10);
  assert.deepEqual(getQuickCensorBrushSettings(), {
    areaSize: 100,
    blockSize: 10,
  });
});

test("quick censor mosaics only the requested rectangle using fixed-size blocks", () => {
  const data = new Uint8ClampedArray([
    10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255,
    50, 0, 0, 255, 60, 0, 0, 255, 70, 0, 0, 255, 80, 0, 0, 255,
    90, 0, 0, 255, 100, 0, 0, 255, 110, 0, 0, 255, 120, 0, 0, 255,
    130, 0, 0, 255, 140, 0, 0, 255, 150, 0, 0, 255, 160, 0, 0, 255,
  ]);

  mosaicImageData(data, {
    blockSize: 2,
    height: 4,
    rect: { x: 0, y: 0, width: 4, height: 2 },
    width: 4,
  });

  assert.deepEqual([...data], [
    10, 0, 0, 255, 10, 0, 0, 255, 30, 0, 0, 255, 30, 0, 0, 255,
    10, 0, 0, 255, 10, 0, 0, 255, 30, 0, 0, 255, 30, 0, 0, 255,
    90, 0, 0, 255, 100, 0, 0, 255, 110, 0, 0, 255, 120, 0, 0, 255,
    130, 0, 0, 255, 140, 0, 0, 255, 150, 0, 0, 255, 160, 0, 0, 255,
  ]);
});
