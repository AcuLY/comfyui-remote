import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { fallbackImages } from "./fallback-images";

test("fallbackImages skips zero-byte files when scanning local previews", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  const root = join(tmpdir(), `design-demo-fallback-images-${process.pid}`);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "sample"), { recursive: true });
  writeFileSync(join(root, "sample", "empty.jpg"), "");
  writeFileSync(join(root, "sample", "preview.jpg"), "not-empty");
  process.env.OUTPUT_BASE_PATH = root;

  try {
    const images = fallbackImages();

    assert.equal(images.length, 1);
    assert.equal(images[0]?.src, "/api/images/sample/preview.jpg");
  } finally {
    if (previousOutputBase === undefined) {
      delete process.env.OUTPUT_BASE_PATH;
    } else {
      process.env.OUTPUT_BASE_PATH = previousOutputBase;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
