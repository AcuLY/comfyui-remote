import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { imageFromRow } from "./row-shaping";

test("imageFromRow ignores missing or zero-byte local preview files", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  const root = join(tmpdir(), `design-demo-images-${process.pid}`);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "sample"), { recursive: true });
  writeFileSync(join(root, "sample", "empty.jpg"), "");
  writeFileSync(join(root, "sample", "preview.jpg"), "not-empty");
  process.env.OUTPUT_BASE_PATH = root;

  try {
    assert.equal(
      imageFromRow({ id: "empty", filePath: "sample/empty.jpg", reviewStatus: "pending" }, 0),
      null,
      "zero-byte files should not become visible demo thumbnails",
    );
    assert.equal(
      imageFromRow({ id: "missing", filePath: "sample/missing.jpg", reviewStatus: "pending" }, 0),
      null,
      "missing files should not become visible demo thumbnails",
    );

    const image = imageFromRow({ id: "preview", filePath: "data/images/sample/preview.jpg", reviewStatus: "kept" }, 1);

    assert.ok(image, "non-empty files should still become demo thumbnails");
    assert.equal(image.src, "/api/images/sample/preview.jpg");
    assert.equal(image.status, "kept");
  } finally {
    if (previousOutputBase === undefined) {
      delete process.env.OUTPUT_BASE_PATH;
    } else {
      process.env.OUTPUT_BASE_PATH = previousOutputBase;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
