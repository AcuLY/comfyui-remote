import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("global notification toasts expose a copy button", () => {
  const appShellSource = readSource("src/components/app-shell.tsx");
  const source = readSource("src/components/notification-copy-buttons.tsx");

  assert.match(appShellSource, /NotificationCopyButtons/, "AppShell should install global toast copy controls");
  assert.match(source, /data-notification-copy-button/, "copy buttons should be marked for deduping");
  assert.match(source, /\[data-sonner-toast\]/, "copy controls should attach to Sonner toast elements");
  assert.match(source, /cloneNode\(true\)/, "copy text should clone toast contents before filtering controls");
  assert.match(source, /navigator\.clipboard\.writeText/, "copy controls should use the Clipboard API when available");
});
