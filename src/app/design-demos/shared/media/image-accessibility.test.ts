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

test("clickable media previews include the concrete image label in their accessible names", () => {
  const previewFrameSource = sourceFor("image-preview-frame/index.tsx");
  const mediumThumbSource = sourceFor("image-thumb-medium/index.tsx");

  assert.match(
    previewFrameSource,
    /aria-label=\{`打开图片预览：\$\{image\.label\}`\}/,
    "preview frame buttons should describe the exact image they open",
  );
  assert.match(
    mediumThumbSource,
    /aria-label=\{`查看图片：\$\{image\.label\}`\}/,
    "medium thumbnail buttons should describe the exact image they open",
  );
  assert.doesNotMatch(previewFrameSource, /Open image preview/, "preview buttons should not expose English placeholder labels");
  assert.doesNotMatch(mediumThumbSource, /aria-label="查看图片"/, "thumbnail buttons should not use a generic repeated label");
});

test("media image components fall back to icons after load failures", () => {
  const components = [
    sourceFor("image-thumb-small/index.tsx"),
    sourceFor("image-thumb-medium/index.tsx"),
    sourceFor("image-preview-frame/index.tsx"),
  ];

  for (const source of components) {
    assert.match(source, /loadFailed/, "media components should track image load failure state");
    assert.match(source, /onError=\{handleImageError\}/, "media images should switch to fallback content on load errors");
    assert.match(source, /onLoad=\{handleImageLoad\}/, "media images should detect zero-byte image responses that finish as load events");
    assert.match(source, /setInterval/, "media components should keep checking briefly after hydration for late broken image completion");
    assert.match(source, /naturalWidth === 0/, "media components should catch images that failed before React hydration");
    assert.match(source, /!loadFailed/, "media components should stop rendering the failing img after an error");
  }
});

test("medium list expand chevrons are decorative", () => {
  const listSource = sourceFor("image-list-medium/index.tsx");

  assert.match(
    listSource,
    /<ChevronUp className=\{s\.icon\} aria-hidden="true" \/>/,
    "expanded-state chevron should be hidden from assistive tech because the button text carries the state",
  );
  assert.match(
    listSource,
    /<ChevronDown className=\{s\.icon\} aria-hidden="true" \/>/,
    "collapsed-state chevron should be hidden from assistive tech because the button text carries the action",
  );
});
