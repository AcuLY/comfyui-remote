import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { imageFromRow } from "./row-shaping";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const ONE_BY_ONE_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFBABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==",
  "base64",
);
const TWO_BY_TWO_PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x02,
  0x08, 0x06, 0x00, 0x00, 0x00,
]);

test("imageFromRow ignores missing or zero-byte local preview files", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  const root = join(tmpdir(), `design-demo-images-${process.pid}`);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "sample"), { recursive: true });
  writeFileSync(join(root, "sample", "empty.jpg"), "");
  writeFileSync(join(root, "sample", "preview.png"), TWO_BY_TWO_PNG_HEADER);
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

    const image = imageFromRow({ id: "preview", filePath: "data/images/sample/preview.png", reviewStatus: "kept" }, 1);

    assert.ok(image, "non-empty files should still become demo thumbnails");
    assert.equal(image.src, "/api/images/sample/preview.png");
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

test("imageFromRow ignores 1x1 local placeholder previews", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  const root = join(tmpdir(), `design-demo-placeholder-images-${process.pid}`);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "sample"), { recursive: true });
  writeFileSync(join(root, "sample", "tiny.png"), ONE_BY_ONE_PNG);
  writeFileSync(join(root, "sample", "tiny-thumb.jpg"), ONE_BY_ONE_JPEG);
  writeFileSync(join(root, "sample", "preview.png"), TWO_BY_TWO_PNG_HEADER);
  process.env.OUTPUT_BASE_PATH = root;

  try {
    assert.equal(
      imageFromRow({ id: "tiny", thumbPath: "sample/tiny-thumb.jpg", filePath: "sample/tiny.png", reviewStatus: "pending" }, 0),
      null,
      "1x1 image placeholders should not become visible demo thumbnails",
    );

    const image = imageFromRow({ id: "preview", filePath: "sample/preview.png", reviewStatus: "kept" }, 1);

    assert.ok(image, "larger local image previews should still become demo thumbnails");
    assert.equal(image.src, "/api/images/sample/preview.png");
  } finally {
    if (previousOutputBase === undefined) {
      delete process.env.OUTPUT_BASE_PATH;
    } else {
      process.env.OUTPUT_BASE_PATH = previousOutputBase;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
