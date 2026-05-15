import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appShellSource = readFileSync(resolve(testDir, "../../shell/app-shell.tsx"), "utf8");

test("DemoFeedbackProvider inherits design demo theme variables from the shell", () => {
  const shellStart = appShellSource.indexOf("<div className={cx(s.shell");
  const providerStart = appShellSource.indexOf("<DemoFeedbackProvider>");

  assert.notEqual(shellStart, -1, "App shell should render the themed shell container");
  assert.notEqual(providerStart, -1, "App shell should render DemoFeedbackProvider");
  assert.ok(
    shellStart < providerStart,
    "DemoFeedbackProvider should be inside the themed shell so fixed toasts inherit --demo-* variables",
  );
});
