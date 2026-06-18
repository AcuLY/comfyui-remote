import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { fallbackImages } from "./fallback-images";
import { isRenderableLocalImagePath } from "./local-image-files";

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

function restoreOutputBase(previousOutputBase: string | undefined) {
  if (previousOutputBase === undefined) {
    delete process.env.OUTPUT_BASE_PATH;
  } else {
    process.env.OUTPUT_BASE_PATH = previousOutputBase;
  }
}

test("fallback image helpers do not scan repo data/images unless OUTPUT_BASE_PATH is configured", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  delete process.env.OUTPUT_BASE_PATH;

  try {
    assert.deepEqual(fallbackImages(), []);
    assert.equal(isRenderableLocalImagePath("data/images/sample/preview.png"), false);
  } finally {
    restoreOutputBase(previousOutputBase);
  }
});

test("fallbackImages skips zero-byte files when scanning local previews", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  const root = join(tmpdir(), `design-demo-fallback-images-${process.pid}`);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "sample"), { recursive: true });
  writeFileSync(join(root, "sample", "empty.jpg"), "");
  writeFileSync(join(root, "sample", "preview.png"), TWO_BY_TWO_PNG_HEADER);
  process.env.OUTPUT_BASE_PATH = root;

  try {
    const images = fallbackImages();

    assert.equal(images.length, 1);
    assert.equal(images[0]?.src, "/api/images/sample/preview.png");
  } finally {
    if (previousOutputBase === undefined) {
      delete process.env.OUTPUT_BASE_PATH;
    } else {
      process.env.OUTPUT_BASE_PATH = previousOutputBase;
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test("fallbackImages skips 1x1 placeholder files when scanning local previews", () => {
  const previousOutputBase = process.env.OUTPUT_BASE_PATH;
  const root = join(tmpdir(), `design-demo-fallback-placeholder-images-${process.pid}`);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "sample"), { recursive: true });
  writeFileSync(join(root, "sample", "tiny.png"), ONE_BY_ONE_PNG);
  writeFileSync(join(root, "sample", "tiny.jpg"), ONE_BY_ONE_JPEG);
  writeFileSync(join(root, "sample", "preview.png"), TWO_BY_TWO_PNG_HEADER);
  process.env.OUTPUT_BASE_PATH = root;

  try {
    const images = fallbackImages();

    assert.equal(images.length, 1);
    assert.equal(images[0]?.src, "/api/images/sample/preview.png");
  } finally {
    if (previousOutputBase === undefined) {
      delete process.env.OUTPUT_BASE_PATH;
    } else {
      process.env.OUTPUT_BASE_PATH = previousOutputBase;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
