import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));

function sourceFor(relativePath: string) {
  return readFileSync(resolve(testDir, relativePath), "utf8");
}

function imgTagSource(source: string) {
  const match = source.match(/<img[\s\S]*?\/>/);
  assert.ok(match, "media component should render an img tag");
  return match[0];
}

test("small thumbnails expose meaningful alt text and intrinsic dimensions", () => {
  const imgTag = imgTagSource(sourceFor("image-thumb-small/index.tsx"));

  assert.match(imgTag, /alt=\{image\.label/, "small thumbnails should use the image label for alt text");
  assert.match(imgTag, /width=\{image\.width/, "small thumbnails should forward image width metadata");
  assert.match(imgTag, /height=\{image\.height/, "small thumbnails should forward image height metadata");
});

test("medium thumbnails expose meaningful alt text and intrinsic dimensions", () => {
  const imgTag = imgTagSource(sourceFor("image-thumb-medium/index.tsx"));

  assert.match(imgTag, /alt=\{image\.label/, "medium thumbnails should use the image label for alt text");
  assert.match(imgTag, /width=\{image\.width/, "medium thumbnails should forward image width metadata");
  assert.match(imgTag, /height=\{image\.height/, "medium thumbnails should forward image height metadata");
});

test("preview frames expose meaningful alt text and intrinsic dimensions", () => {
  const imgTag = imgTagSource(sourceFor("image-preview-frame/index.tsx"));

  assert.match(imgTag, /alt=\{image\.label/, "preview images should use the image label for alt text");
  assert.match(imgTag, /width=\{image\.width/, "preview images should forward image width metadata");
  assert.match(imgTag, /height=\{image\.height/, "preview images should forward image height metadata");
});
