import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("app shell mounts the notification copy button enhancement next to the toaster", () => {
  const appShell = readSource("src/components/app-shell.tsx");

  assert.match(
    appShell,
    /import \{ NotificationCopyButtons \} from "@\/components\/notification-copy-buttons"/,
    "AppShell should import the global notification copy-button enhancement",
  );
  assert.match(
    appShell,
    /<NotificationCopyButtons\s*\/>\s*<Toaster/,
    "copy-button enhancement should mount immediately before the Sonner Toaster",
  );
  assert.match(appShell, /toast: "!pr-20"/, "toasts need room for both copy and close buttons");
});

test("notification copy enhancement inserts a copy button immediately before Sonner close buttons", () => {
  const componentPath = "src/components/notification-copy-buttons.tsx";
  assert.equal(existsSync(join(rootDir, componentPath)), true, "notification copy component should exist");
  const source = readSource(componentPath);

  assert.match(source, /querySelectorAll(?:<HTMLElement>)?\(["']\[data-sonner-toast\]["']\)/, "component should inspect Sonner toast nodes");
  assert.match(source, /querySelector(?:<HTMLElement>)?\(["']\[data-close-button\]["']\)/, "component should find each Sonner close button");
  assert.match(source, /data-notification-copy-button/, "copy buttons should be marked for deduping");
  assert.match(source, /insertBefore\(copyButton,\s*closeButton\)/, "copy button should sit immediately before the close button in DOM order");
  assert.match(source, /aria-label",\s*"复制通知信息"/, "copy button needs an accessible label");
  assert.match(source, /cloneNode\(true\)/, "copied text should clone toast contents before filtering controls");
  assert.match(source, /navigator\.clipboard\.writeText/, "copy button should copy notification text to the clipboard");
  assert.match(source, /const copied = document\.execCommand\("copy"\)/, "fallback copy should check whether the browser copy command succeeded");
  assert.match(source, /if \(!copied\) \{[\s\S]*Clipboard copy failed/, "fallback copy should surface copy failures instead of showing a false success state");
  assert.match(source, /style\.right\s*=\s*"2\.25rem"/, "copy button should be visually placed to the left of the close button");
  assert.match(source, /button\.isConnected/, "component should clean up React roots for toast copy buttons after their toast is removed");
});
