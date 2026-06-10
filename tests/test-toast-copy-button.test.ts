import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("global notification toasts expose a copy button", () => {
  const source = readSource("src/components/app-shell.tsx");

  assert.match(source, /ToastCopyButtons/, "AppShell should install global toast copy controls");
  assert.match(source, /data-toast-copy-button/, "copy buttons should be marked for deduping");
  assert.match(source, /\[data-sonner-toast\]/, "copy controls should attach to Sonner toast elements");
  assert.match(source, /\[data-title\]/, "copy text should include the toast title");
  assert.match(source, /\[data-description\]/, "copy text should include the toast description");
  assert.match(source, /navigator\.clipboard\.writeText/, "copy controls should use the Clipboard API when available");
});
